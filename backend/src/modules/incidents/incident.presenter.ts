import { UserDocument } from '../users/user.model';

/**
 * Presenters decide WHO sees WHAT. Controllers never return raw documents.
 *  - marker  : minimal, safe to push over sockets / show on a map
 *  - user    : the reporter's own view (no responder identity, no internal notes, no raw AI output)
 *  - authority: operational view; reporter phone only for the assigned responder
 */
const idOf = (v: any) => String(v?._id ?? v);
const coords = (loc: any) => (loc?.coordinates ? { lat: loc.coordinates[1], lng: loc.coordinates[0] } : null);

export const toMarker = (i: any) => ({
  id: idOf(i),
  reference: i.reference,
  category: i.category,
  severity: i.severity,
  status: i.status,
  location: coords(i.location),
  accuracyM: i.locationAccuracyM ?? null,
  createdAt: i.createdAt,
  updatedAt: i.updatedAt,
});

export const toStatusEvent = (i: any) => ({
  id: idOf(i),
  reference: i.reference,
  status: i.status,
  responderAssigned: !!i.assignedTo,
  updatedAt: i.updatedAt,
});

export function presentForUser(i: any) {
  const ai = i.ai ?? {};
  const completed = ai.status === 'completed' && ai.briefing;
  return {
    id: idOf(i),
    reference: i.reference,
    category: i.category,
    severity: i.severity,
    status: i.status,
    description: i.description ?? null,
    additionalInfo: (i.additionalInfo ?? []).map((a: any) => ({ text: a.text, at: a.at })),
    location: coords(i.location),
    locationAccuracyM: i.locationAccuracyM ?? null,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
    acknowledgedAt: i.acknowledgedAt ?? null,
    responderAssigned: !!i.assignedTo,
    assignedAt: i.assignedAt ?? null,
    resolvedAt: i.resolvedAt ?? null,
    timeline: (i.timeline ?? []).map((t: any) => ({ status: t.status, at: t.at })),
    contactNotification: { status: i.contactNotification?.status ?? 'pending', updatedAt: i.contactNotification?.updatedAt ?? null },
    // AI is optional enrichment. The SOS itself never depends on it.
    ai: {
      status: ai.status ?? 'pending',
      guidance: completed ? ai.briefing.userGuidance ?? [] : [],
      sources: completed ? ai.briefing.sources ?? [] : [],
      disclaimer: completed ? ai.briefing.disclaimer ?? null : null,
      completedAt: ai.completedAt ?? null,
    },
  };
}

export function presentForAuthority(i: any, viewer: UserDocument) {
  const contactVisible = !!i.assignedTo && idOf(i.assignedTo) === String(viewer._id);
  const reporter = i.reporter && i.reporter.name ? i.reporter : null;
  return {
    ...toMarker(i),
    description: i.description ?? null,
    additionalInfo: i.additionalInfo ?? [],
    address: i.address ?? null,
    clientTimestamp: i.clientTimestamp ?? null,
    reporter: reporter
      ? { id: idOf(reporter), name: reporter.name, ...(contactVisible ? { phone: reporter.phone } : {}) }
      : { id: idOf(i.reporter) },
    contactVisible,
    acknowledgedBy: i.acknowledgedBy ? idOf(i.acknowledgedBy) : null,
    acknowledgedAt: i.acknowledgedAt ?? null,
    assignedTo: i.assignedTo
      ? { id: idOf(i.assignedTo), name: i.assignedTo.name ?? undefined, badgeId: i.assignedTo.badgeId ?? undefined }
      : null,
    assignedAt: i.assignedAt ?? null,
    startedAt: i.startedAt ?? null,
    resolvedAt: i.resolvedAt ?? null,
    resolutionNote: i.resolutionNote ?? null,
    timeline: i.timeline ?? [],
    trail: i.trail ?? [],
    contactNotification: i.contactNotification ?? { status: 'pending' },
    ai: {
      status: i.ai?.status ?? 'pending',
      attempts: i.ai?.attempts ?? 0,
      requestedAt: i.ai?.requestedAt ?? null,
      completedAt: i.ai?.completedAt ?? null,
      error: i.ai?.error ?? null,
      briefing: i.ai?.status === 'completed' ? i.ai.briefing : null,
    },
  };
}
