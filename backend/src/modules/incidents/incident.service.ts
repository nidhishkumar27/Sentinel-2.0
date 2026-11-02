import { randomBytes } from 'crypto';
import { ApiError } from '../../utils/ApiError';
import { toPoint } from '../../utils/geo';
import { User, UserDocument } from '../users/user.model';
import { OPEN_STATUSES, Status, TRANSITIONS, Category, canTransition, deriveSeverity } from './incident.constants';
import { Incident } from './incident.model';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
export function generateReference(now = new Date()) {
  const d = now.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Array.from(randomBytes(6), (b) => ALPHABET[b % ALPHABET.length]).join('');
  return `SNT-${d}-${suffix}`;
}

export interface CreateInput {
  category: Category;
  description?: string;
  address?: string;
  lat: number;
  lng: number;
  accuracyM?: number;
  clientTimestamp?: Date;
  clientRequestId?: string;
}

/**
 * Creates the incident using ONLY the database. No AI, weather or SMS call happens here,
 * so an outage of any of them can never prevent an SOS from being recorded.
 */
export async function createIncident(user: UserDocument, input: CreateInput) {
  if (input.clientRequestId) {
    const existing = await Incident.findOne({ reporter: user._id, clientRequestId: input.clientRequestId });
    if (existing) return { incident: existing, duplicate: true };
  }
  // one open incident per category per user; the app should add details to it instead
  const open = await Incident.findOne({ reporter: user._id, category: input.category, status: { $in: OPEN_STATUSES } });
  if (open) return { incident: open, duplicate: true };

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const incident = await Incident.create({
        reference: generateReference(),
        clientRequestId: input.clientRequestId,
        reporter: user._id,
        category: input.category,
        severity: deriveSeverity(input.category),
        description: input.description,
        address: input.address,
        location: toPoint(input.lat, input.lng),
        locationAccuracyM: input.accuracyM,
        clientTimestamp: input.clientTimestamp,
        timeline: [{ status: 'created', action: 'created', by: user._id, at: new Date() }],
      });
      User.updateOne({ _id: user._id }, { lastLocation: toPoint(input.lat, input.lng), lastLocationAt: new Date() }).catch(() => undefined);
      return { incident, duplicate: false };
    } catch (err: any) {
      if (err?.code === 11000) {
        if (err.keyPattern?.reference) continue; // reference collision → regenerate
        if (err.keyPattern?.clientRequestId) {
          const existing = await Incident.findOne({ reporter: user._id, clientRequestId: input.clientRequestId });
          if (existing) return { incident: existing, duplicate: true };
        }
      }
      throw err;
    }
  }
  throw new ApiError(500, 'Could not allocate an incident reference');
}

const ACTION: Record<Status, string> = {
  created: 'created',
  acknowledged: 'acknowledged',
  assigned: 'assigned',
  in_progress: 'work_started',
  resolved: 'resolved',
  cancelled: 'cancelled',
};

interface TransitionInput {
  to: Status;
  actor: UserDocument;
  note?: string;
  assigneeId?: string;
}

/** The only place where incident status changes. Enforces the state machine, ownership and concurrency. */
export async function transitionIncident(incidentId: string, input: TransitionInput) {
  const incident = await Incident.findById(incidentId);
  if (!incident) throw new ApiError(404, 'Incident not found');

  const from = incident.status as Status;
  const { to, actor } = input;
  if (!canTransition(from, to))
    throw new ApiError(409, `Cannot move incident from "${from}" to "${to}"`, { allowed: TRANSITIONS[from] }, 'INVALID_TRANSITION');

  // ownership: once assigned, only the assignee drives the incident forward
  if ((to === 'in_progress' || to === 'resolved') && incident.assignedTo && String(incident.assignedTo) !== String(actor._id))
    throw new ApiError(403, 'Only the assigned responder can update this incident', undefined, 'NOT_ASSIGNEE');

  const now = new Date();
  const set: Record<string, unknown> = { status: to };
  switch (to) {
    case 'acknowledged':
      set.acknowledgedBy = actor._id;
      set.acknowledgedAt = now;
      break;
    case 'assigned': {
      if (!input.assigneeId) throw new ApiError(400, 'assigneeId is required', undefined, 'VALIDATION_FAILED');
      const assignee = await User.findOne({ _id: input.assigneeId, role: 'authority', isActive: true });
      if (!assignee) throw new ApiError(404, 'Responder not found');
      set.assignedTo = assignee._id;
      set.assignedAt = now;
      if (!incident.acknowledgedBy) {
        set.acknowledgedBy = actor._id; // assigning implies acknowledging
        set.acknowledgedAt = now;
      }
      break;
    }
    case 'in_progress':
      set.startedAt = now;
      break;
    case 'resolved':
      set.resolvedAt = now;
      if (input.note) set.resolutionNote = input.note;
      break;
    case 'cancelled':
      set.cancelledAt = now;
      break;
  }

  // compare-and-set on the previous status: two responders racing cannot both win
  const updated = await Incident.findOneAndUpdate(
    { _id: incidentId, status: from },
    { $set: set, $push: { timeline: { status: to, action: ACTION[to], note: input.note, by: actor._id, at: now } } },
    { new: true }
  );
  if (!updated) throw new ApiError(409, 'Incident was changed by someone else. Refresh and try again.', undefined, 'CONFLICT');
  return { incident: updated, from };
}

export async function addIncidentDetails(incidentId: string, reporterId: unknown, text: string) {
  const incident = await Incident.findOne({ _id: incidentId, reporter: reporterId });
  if (!incident) throw new ApiError(404, 'Incident not found');
  if (!OPEN_STATUSES.includes(incident.status as Status)) throw new ApiError(409, `Incident is ${incident.status}`, undefined, 'INCIDENT_CLOSED');
  if (incident.additionalInfo.length >= 20) throw new ApiError(400, 'Too many updates on this incident', undefined, 'LIMIT_REACHED');
  incident.additionalInfo.push({ text, at: new Date() });
  await incident.save();
  return incident;
}
