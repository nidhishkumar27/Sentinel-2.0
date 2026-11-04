import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';
import { latSchema, lngSchema, objectId, paginationSchema, toPoint } from '../../utils/geo';
import { logger } from '../../utils/logger';
import { emitToAuthorities, emitToUser } from '../../sockets';
import { AuditLog } from '../audit/audit.model';
import { audit } from '../audit/audit.service';
import { enqueueBriefing, requeueBriefing } from '../ai-integration/briefing.service';
import { enrichIncidentAddress } from '../geo/geocoder.service';
import { DigitalId } from '../digital-id/digitalId.model';
import { EmergencyContact } from '../emergency-contacts/contact.model';
import { dispatchToContacts, notifyAuthorities, notifyUser } from '../notifications/notifications.service';
import { UserDocument } from '../users/user.model';
import { CATEGORIES, OPEN_STATUSES, STATUSES } from './incident.constants';
import { Incident } from './incident.model';
import { presentForAuthority, presentForUser, toMarker, toStatusEvent } from './incident.presenter';
import { addIncidentDetails, createIncident, transitionIncident } from './incident.service';

const router = Router();
router.use(authenticate);

const idParams = z.object({ id: objectId });
const sosLimiter = rateLimit({ windowMs: 60 * 1000, limit: 10, keyGenerator: (req) => String(req.user?._id), standardHeaders: true, legacyHeaders: false });

const createSchema = z.object({
  category: z.enum(CATEGORIES),
  description: z.string().max(1000).optional(),
  address: z.string().max(300).optional(),
  lat: latSchema,
  lng: lngSchema,
  accuracyM: z.number().min(0).max(100000).optional(),
  clientTimestamp: z.coerce.date().optional(),
  clientRequestId: z.string().min(8).max(100).optional(),
});

const listQuery = paginationSchema
  .extend({
    category: z.enum(CATEGORIES).optional(),
    status: z.enum(STATUSES).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    updatedAfter: z.coerce.date().optional(), // REST fallback when the socket is down
    lat: latSchema.optional(),
    lng: lngSchema.optional(),
    radiusKm: z.coerce.number().min(0.1).max(200).default(10),
  })
  .refine((v) => (v.lat === undefined) === (v.lng === undefined), { message: 'Provide both lat and lng' });


/** Populate AFTER sockets/notifications ran (they need the raw ObjectId), only for the HTTP response. */
const withPeople = (i: any) =>
  i.populate([
    { path: 'reporter', select: 'name phone' },
    { path: 'assignedTo', select: 'name badgeId' },
  ]);

/** Push minimal, non-sensitive updates. Details are always fetched through the REST API (permission-checked). */
function publishUpdate(i: any) {
  emitToAuthorities('incident:updated', toMarker(i));
  emitToUser(i.reporter, 'incident:updated', toStatusEvent(i));
}

/** Everything that happens after the SOS is safely stored. Nothing here can fail the request. */
function afterCreate(incident: any, user: UserDocument) {
  emitToAuthorities('incident:created', toMarker(incident));

  notifyAuthorities({
    title: `New ${incident.category} emergency`,
    body: `Incident ${incident.reference} (${incident.severity}) was reported`,
    type: 'sos',
    data: { incidentId: incident._id },
  }).catch((e) => logger.error('notifyAuthorities failed', e));

  dispatchToContacts(user._id, user.name, {
    title: 'Emergency alert',
    body: `${user.name} triggered an SOS for ${incident.category}. Reference: ${incident.reference}. Location: ${incident.address ?? `${incident.location.coordinates[1]}, ${incident.location.coordinates[0]}`}.`,
    type: 'sos',
    data: { incidentId: incident._id },
  })
    .then(async (summary) => {
      await Incident.updateOne({ _id: incident._id }, { $set: { contactNotification: { ...summary, updatedAt: new Date() } } });
      emitToUser(user._id, 'incident:contacts_updated', { id: String(incident._id), contactNotification: summary.status });
    })
    .catch(async (e) => {
      logger.error('dispatchToContacts failed', e);
      await Incident.updateOne({ _id: incident._id }, { $set: { 'contactNotification.status': 'failed', 'contactNotification.updatedAt': new Date() } });
    });

  if (!incident.address) enrichIncidentAddress(incident._id).catch((e) => logger.warn('address enrichment failed', e?.message));
  enqueueBriefing(incident._id); // AI enrichment: optional and asynchronous
}

// =====================================================================================
// USER
// =====================================================================================

router.post(
  '/',
  authorize('user'),
  sosLimiter,
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const { incident, duplicate } = await createIncident(req.user!, req.body);
    if (!duplicate) {
      await audit(req, { action: 'incident.create', targetType: 'Incident', targetId: incident._id, meta: { category: incident.category } });
      afterCreate(incident, req.user!);
    }
    // 201 = newly recorded. 200 + meta.duplicate = an open incident (or same clientRequestId) already existed.
    res.status(duplicate ? 200 : 201).json({ success: true, data: presentForUser(incident), meta: { duplicate } });
  })
);

router.get(
  '/mine',
  authorize('user'),
  validate({ query: paginationSchema.extend({ status: z.enum(STATUSES).optional() }) }),
  asyncHandler(async (req, res) => {
    const { page, limit, status } = req.query as unknown as { page: number; limit: number; status?: string };
    const filter: Record<string, unknown> = { reporter: req.user!._id };
    if (status) filter.status = status;
    const [rows, total] = await Promise.all([
      Incident.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Incident.countDocuments(filter),
    ]);
    res.json({ success: true, data: rows.map(presentForUser), meta: { page, limit, total } });
  })
);

router.post(
  '/:id/details',
  authorize('user'),
  validate({ params: idParams, body: z.object({ text: z.string().min(1).max(1000) }) }),
  asyncHandler(async (req, res) => {
    const incident = await addIncidentDetails(req.params.id, req.user!._id, req.body.text);
    emitToAuthorities('incident:updated', toMarker(incident));
    res.json({ success: true, data: presentForUser(incident) });
  })
);

router.post(
  '/:id/location',
  authorize('user'),
  validate({ params: idParams, body: z.object({ lat: latSchema, lng: lngSchema, accuracyM: z.number().min(0).optional() }) }),
  asyncHandler(async (req, res) => {
    const { lat, lng, accuracyM } = req.body;
    const incident = await Incident.findOneAndUpdate(
      { _id: req.params.id, reporter: req.user!._id, status: { $in: OPEN_STATUSES } },
      {
        $set: { location: toPoint(lat, lng), locationAccuracyM: accuracyM },
        $push: { trail: { $each: [{ coordinates: [lng, lat], accuracyM, at: new Date() }], $slice: -100 } },
      },
      { new: true }
    );
    if (!incident) throw new ApiError(404, 'No open incident found');
    emitToAuthorities('incident:location', { id: String(incident._id), lat, lng, accuracyM: accuracyM ?? null, at: new Date().toISOString() });
    res.json({ success: true });
  })
);

router.patch(
  '/:id/cancel',
  authorize('user'),
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    const owned = await Incident.exists({ _id: req.params.id, reporter: req.user!._id });
    if (!owned) throw new ApiError(404, 'Incident not found');
    const { incident } = await transitionIncident(req.params.id, { to: 'cancelled', actor: req.user!, note: 'Cancelled by reporter' });
    await audit(req, { action: 'incident.cancel', targetType: 'Incident', targetId: incident._id });
    publishUpdate(incident);
    res.json({ success: true, data: presentForUser(incident) });
  })
);

// =====================================================================================
// AUTHORITY  (static routes first, then /:id)
// =====================================================================================

router.get(
  '/',
  authorize('authority'),
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof listQuery>;
    const filter: Record<string, any> = {};
    if (q.status) filter.status = q.status;
    if (q.category) filter.category = q.category;
    if (q.from || q.to) filter.createdAt = { ...(q.from && { $gte: q.from }), ...(q.to && { $lte: q.to }) };
    if (q.updatedAfter) filter.updatedAt = { $gt: q.updatedAfter };
    if (q.lat !== undefined && q.lng !== undefined)
      filter.location = { $geoWithin: { $centerSphere: [[q.lng, q.lat], q.radiusKm / 6378.1] } };

    const [rows, total] = await Promise.all([
      Incident.find(filter)
        .populate('reporter', 'name phone')
        .populate('assignedTo', 'name badgeId')
        .sort({ createdAt: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit),
      Incident.countDocuments(filter),
    ]);
    res.json({
      success: true,
      data: rows.map((r) => presentForAuthority(r, req.user!)),
      meta: { page: q.page, limit: q.limit, total, serverTime: new Date().toISOString() },
    });
  })
);

// Live map: minimal markers for every open incident
router.get(
  '/map-markers',
  authorize('authority'),
  asyncHandler(async (_req, res) => {
    const rows = await Incident.find({ status: { $in: OPEN_STATUSES } }).sort({ createdAt: -1 }).limit(500);
    res.json({ success: true, data: rows.map(toMarker), meta: { serverTime: new Date().toISOString() } });
  })
);

router.get(
  '/assigned/me',
  authorize('authority'),
  asyncHandler(async (req, res) => {
    const rows = await Incident.find({ assignedTo: req.user!._id, status: { $in: ['assigned', 'in_progress'] } })
      .populate('reporter', 'name phone')
      .populate('assignedTo', 'name badgeId')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: rows.map((r) => presentForAuthority(r, req.user!)) });
  })
);

router.get(
  '/analytics/summary',
  authorize('authority'),
  asyncHandler(async (_req, res) => {
    const since = new Date(Date.now() - 14 * 24 * 3600 * 1000);
    const [byStatus, byCategory, perDay, timings, byAi] = await Promise.all([
      Incident.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Incident.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
      Incident.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Incident.aggregate([
        {
          $group: {
            _id: null,
            avgAckMs: { $avg: { $cond: [{ $ifNull: ['$acknowledgedAt', false] }, { $subtract: ['$acknowledgedAt', '$createdAt'] }, null] } },
            avgResolveMs: { $avg: { $cond: [{ $ifNull: ['$resolvedAt', false] }, { $subtract: ['$resolvedAt', '$createdAt'] }, null] } },
          },
        },
      ]),
      Incident.aggregate([{ $group: { _id: '$ai.status', count: { $sum: 1 } } }]),
    ]);
    const toMap = (rows: any[]) => Object.fromEntries(rows.map((r) => [r._id, r.count]));
    const t = timings[0] ?? {};
    const mins = (ms?: number | null) => (ms == null ? null : Math.round(ms / 60000));
    const status = toMap(byStatus);
    res.json({
      success: true,
      data: {
        openIncidents: OPEN_STATUSES.reduce((n, s) => n + (status[s] ?? 0), 0),
        byStatus: status,
        byCategory: toMap(byCategory),
        perDay: perDay.map((r) => ({ date: r._id, count: r.count })),
        avgAcknowledgeMinutes: mins(t.avgAckMs),
        avgResolutionMinutes: mins(t.avgResolveMs),
        aiEnrichment: toMap(byAi),
      },
      meta: { generatedAt: new Date().toISOString() },
    });
  })
);

// ---- lifecycle actions ----
router.patch(
  '/:id/acknowledge',
  authorize('authority'),
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    const { incident, from } = await transitionIncident(req.params.id, { to: 'acknowledged', actor: req.user! });
    await audit(req, { action: 'incident.acknowledge', targetType: 'Incident', targetId: incident._id, meta: { from } });
    publishUpdate(incident);
    notifyUser(incident.reporter, { title: 'Request acknowledged', body: 'Responders have seen your emergency request.', type: 'incident_update', data: { incidentId: incident._id } }).catch(() => undefined);
    res.json({ success: true, data: presentForAuthority(await withPeople(incident), req.user!) });
  })
);

router.patch(
  '/:id/assign',
  authorize('authority'),
  validate({ params: idParams, body: z.object({ assigneeId: objectId, note: z.string().max(300).optional() }) }),
  asyncHandler(async (req, res) => {
    const { incident, from } = await transitionIncident(req.params.id, { to: 'assigned', actor: req.user!, assigneeId: req.body.assigneeId, note: req.body.note });
    await audit(req, { action: 'incident.assign', targetType: 'Incident', targetId: incident._id, meta: { from, assigneeId: req.body.assigneeId } });
    publishUpdate(incident);
    notifyUser(req.body.assigneeId, { title: 'New assignment', body: `Incident ${incident.reference} has been assigned to you`, type: 'assignment', data: { incidentId: incident._id } }).catch(() => undefined);
    notifyUser(incident.reporter, { title: 'Responder assigned', body: 'A responder has been assigned to your request.', type: 'incident_update', data: { incidentId: incident._id } }).catch(() => undefined);
    res.json({ success: true, data: presentForAuthority(await withPeople(incident), req.user!) });
  })
);

router.patch(
  '/:id/status',
  authorize('authority'),
  validate({ params: idParams, body: z.object({ status: z.enum(['in_progress', 'resolved']), note: z.string().max(500).optional() }) }),
  asyncHandler(async (req, res) => {
    const { incident, from } = await transitionIncident(req.params.id, { to: req.body.status, actor: req.user!, note: req.body.note });
    await audit(req, { action: `incident.${req.body.status}`, targetType: 'Incident', targetId: incident._id, meta: { from } });
    publishUpdate(incident);
    notifyUser(incident.reporter, {
      title: 'Request update',
      body: req.body.status === 'resolved' ? 'Your emergency request was marked resolved.' : 'A responder is working on your request.',
      type: 'incident_update',
      data: { incidentId: incident._id },
    }).catch(() => undefined);
    res.json({ success: true, data: presentForAuthority(await withPeople(incident), req.user!) });
  })
);

// ---- sensitive data: assigned responder only, while the incident is open, always audited ----
router.get(
  '/:id/responder-info',
  authorize('authority'),
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    const incident: any = await Incident.findById(req.params.id).populate('reporter', 'name phone');
    if (!incident) throw new ApiError(404, 'Incident not found');
    if (!incident.assignedTo || String(incident.assignedTo) !== String(req.user!._id))
      throw new ApiError(403, 'Only the assigned responder can view this information', undefined, 'NOT_ASSIGNEE');
    if (!OPEN_STATUSES.includes(incident.status)) throw new ApiError(403, 'Incident is closed', undefined, 'INCIDENT_CLOSED');

    const [digitalId, contacts] = await Promise.all([
      DigitalId.findOne({ user: incident.reporter._id }),
      EmergencyContact.find({ user: incident.reporter._id }).select('name phone relationship -_id'),
    ]);
    await audit(req, { action: 'incident.responder_info_view', targetType: 'Incident', targetId: incident._id });
    res.json({
      success: true,
      data: {
        reporter: { name: incident.reporter.name, phone: incident.reporter.phone },
        medical: digitalId ? { bloodGroup: digitalId.bloodGroup, allergies: digitalId.allergies, conditions: digitalId.medicalConditions } : null,
        emergencyContacts: contacts,
      },
    });
  })
);

router.get(
  '/:id/history',
  authorize('authority'),
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    const incident = await Incident.findById(req.params.id).select('timeline reference');
    if (!incident) throw new ApiError(404, 'Incident not found');
    const trail = await AuditLog.find({ targetType: 'Incident', targetId: req.params.id }).sort({ createdAt: 1 }).select('-__v');
    res.json({ success: true, data: { reference: incident.reference, timeline: incident.timeline, audit: trail } });
  })
);

router.post(
  '/:id/ai/retry',
  authorize('authority'),
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    if (!(await Incident.exists({ _id: req.params.id }))) throw new ApiError(404, 'Incident not found');
    await requeueBriefing(req.params.id);
    await audit(req, { action: 'incident.ai_retry', targetType: 'Incident', targetId: req.params.id });
    res.status(202).json({ success: true });
  })
);

// ---- shared: reporter (own incident) or authority ----
router.get(
  '/:id',
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    const incident: any = await Incident.findById(req.params.id).populate('reporter', 'name phone').populate('assignedTo', 'name badgeId');
    if (!incident) throw new ApiError(404, 'Incident not found');

    if (req.user!.role === 'authority') {
      await audit(req, { action: 'incident.view', targetType: 'Incident', targetId: incident._id });
      return res.json({ success: true, data: presentForAuthority(await withPeople(incident), req.user!) });
    }
    if (String(incident.reporter._id) !== String(req.user!._id)) throw new ApiError(403, 'You do not have access to this incident');
    res.json({ success: true, data: presentForUser(incident) });
  })
);

export default router;
