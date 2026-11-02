import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';
import { latSchema, lngSchema, objectId, paginationSchema, toPoint } from '../../utils/geo';
import { audit } from '../audit/audit.service';
import { Incident } from '../incidents/incident.model';
import { SafetyZone, ZONE_CATEGORIES } from './zone.model';
import { importFacilitiesFromOSM } from './facilities.import';
import { findNearbyResources } from './zones.service';

const router = Router();
router.use(authenticate);

const nearbyQuery = z.object({
  lat: latSchema,
  lng: lngSchema,
  radius: z.coerce.number().min(100).max(50000).default(3000), // metres
  category: z.enum(ZONE_CATEGORIES).optional(),
  verifiedOnly: z.enum(['true', 'false']).default('true'),
});

// Facilities and zones around a point, nearest first, with distance. Verified data only by default.
router.get(
  '/nearby',
  validate({ query: nearbyQuery }),
  asyncHandler(async (req, res) => {
    const { lat, lng, radius, category, verifiedOnly } = req.query as unknown as z.infer<typeof nearbyQuery>;
    const data = await findNearbyResources(lat, lng, {
      radiusM: radius,
      categories: category ? [category] : undefined,
      verifiedOnly: verifiedOnly === 'true',
    });
    res.json({ success: true, data, meta: { fetchedAt: new Date().toISOString() } });
  })
);

// Anonymised incident density (no reporter data), grouped to ~100 m cells
router.get(
  '/heatmap',
  validate({ query: z.object({ days: z.coerce.number().int().min(1).max(90).default(30) }) }),
  asyncHandler(async (req, res) => {
    const days = Number(req.query.days);
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);
    const cells = await Incident.aggregate([
      { $match: { createdAt: { $gte: since }, status: { $ne: 'cancelled' } } },
      {
        $group: {
          _id: {
            lat: { $round: [{ $arrayElemAt: ['$location.coordinates', 1] }, 3] },
            lng: { $round: [{ $arrayElemAt: ['$location.coordinates', 0] }, 3] },
          },
          count: { $sum: 1 },
        },
      },
      { $project: { _id: 0, lat: '$_id.lat', lng: '$_id.lng', weight: '$count' } },
      { $limit: 2000 },
    ]);
    res.json({ success: true, data: cells, meta: { days, generatedAt: new Date().toISOString() } });
  })
);

const zoneBody = z.object({
  name: z.string().min(2).max(120),
  category: z.enum(ZONE_CATEGORIES),
  lat: latSchema,
  lng: lngSchema,
  radiusM: z.number().min(20).max(5000).optional(),
  phone: z.string().max(20).optional(),
  notes: z.string().max(500).optional(),
});

router.post(
  '/zones',
  authorize('authority'),
  validate({ body: zoneBody }),
  asyncHandler(async (req, res) => {
    const { lat, lng, ...rest } = req.body;
    // entries created by authorised personnel count as verified; bulk imports should set verified:false
    const data = await SafetyZone.create({
      ...rest, location: toPoint(lat, lng), verified: true, source: 'authority', lastVerifiedAt: new Date(), createdBy: req.user!._id,
    });
    await audit(req, { action: 'zone.create', targetType: 'SafetyZone', targetId: data._id, meta: { category: data.category } });
    res.status(201).json({ success: true, data });
  })
);

router.delete(
  '/zones/:id',
  authorize('authority'),
  validate({ params: z.object({ id: objectId }) }),
  asyncHandler(async (req, res) => {
    const zone = await SafetyZone.findByIdAndDelete(req.params.id);
    if (!zone) throw new ApiError(404, 'Zone not found');
    await audit(req, { action: 'zone.delete', targetType: 'SafetyZone', targetId: zone._id });
    res.json({ success: true });
  })
);

// ---------- facility data management (authority) ----------
const importBody = z.object({
  lat: latSchema,
  lng: lngSchema,
  radiusM: z.number().min(500).max(20000).default(5000),
  verify: z.boolean().default(false), // true = mark imported rows verified immediately (only after you trust the source)
});

// Pull hospitals / police / fire stations / shelters around a point from OpenStreetMap (idempotent)
router.post(
  '/import',
  authorize('authority'),
  rateLimit({ windowMs: 3600 * 1000, limit: 5, keyGenerator: (req) => String(req.user?._id) }),
  validate({ body: importBody }),
  asyncHandler(async (req, res) => {
    const result = await importFacilitiesFromOSM(req.body, { verify: req.body.verify, createdBy: req.user!._id });
    await audit(req, { action: 'zone.import', targetType: 'SafetyZone', meta: { ...req.body, ...result } });
    res.json({ success: true, data: result, meta: { source: 'OpenStreetMap (Overpass)' } });
  })
);

const zonesQuery = paginationSchema.extend({
  verified: z.enum(['true', 'false']).optional(),
  category: z.enum(ZONE_CATEGORIES).optional(),
});

// Review queue: list zones incl. unverified ones
router.get(
  '/zones',
  authorize('authority'),
  validate({ query: zonesQuery }),
  asyncHandler(async (req, res) => {
    const { page, limit, verified, category } = req.query as unknown as z.infer<typeof zonesQuery>;
    const filter: Record<string, unknown> = {};
    if (verified) filter.verified = verified === 'true';
    if (category) filter.category = category;
    const [data, total] = await Promise.all([
      SafetyZone.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      SafetyZone.countDocuments(filter),
    ]);
    res.json({ success: true, data, meta: { page, limit, total } });
  })
);

router.patch(
  '/zones/:id/verify',
  authorize('authority'),
  validate({ params: z.object({ id: objectId }) }),
  asyncHandler(async (req, res) => {
    const zone = await SafetyZone.findByIdAndUpdate(req.params.id, { verified: true, lastVerifiedAt: new Date() }, { new: true });
    if (!zone) throw new ApiError(404, 'Zone not found');
    await audit(req, { action: 'zone.verify', targetType: 'SafetyZone', targetId: zone._id });
    res.json({ success: true, data: zone });
  })
);

// Verify everything from one source (e.g. after reviewing an OSM import)
router.post(
  '/zones/verify-bulk',
  authorize('authority'),
  validate({ body: z.object({ source: z.string().min(1), category: z.enum(ZONE_CATEGORIES).optional() }) }),
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = { source: req.body.source, verified: false };
    if (req.body.category) filter.category = req.body.category;
    const r = await SafetyZone.updateMany(filter, { verified: true, lastVerifiedAt: new Date() });
    await audit(req, { action: 'zone.verify_bulk', targetType: 'SafetyZone', meta: { ...req.body, modified: r.modifiedCount } });
    res.json({ success: true, data: { verified: r.modifiedCount } });
  })
);

export default router;
