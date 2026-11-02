import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';
import { latSchema, lngSchema, objectId, toPoint } from '../../utils/geo';
import { broadcast } from '../../sockets';
import { audit } from '../audit/audit.service';
import { Alert } from './alert.model';

const router = Router();
router.use(authenticate);

const createSchema = z
  .object({
    title: z.string().min(3).max(120),
    message: z.string().min(3).max(1000),
    severity: z.enum(['info', 'warning', 'critical']).default('info'),
    lat: latSchema.optional(),
    lng: lngSchema.optional(),
    radiusM: z.number().min(50).max(50000).optional(),
    expiresInHours: z.number().min(1).max(720).optional(),
  })
  .refine((v) => (v.lat === undefined) === (v.lng === undefined), { message: 'Provide both lat and lng' });

const listQuery = z.object({ lat: latSchema.optional(), lng: lngSchema.optional() });

// Active alerts. With lat/lng → city-wide alerts + alerts whose area covers the point.
router.get(
  '/',
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const { lat, lng } = req.query as unknown as z.infer<typeof listQuery>;
    const now = new Date();
    const base = { active: true, $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }] };
    let data = await Alert.find(base).sort({ createdAt: -1 }).limit(100);

    if (lat !== undefined && lng !== undefined) {
      data = data.filter((a) => {
        if (!a.center || !a.radiusM) return true; // city-wide
        const [aLng, aLat] = a.center.coordinates as number[];
        return haversineM(lat, lng, aLat, aLng) <= a.radiusM;
      });
    }
    res.json({ success: true, data });
  })
);

router.post(
  '/',
  authorize('authority'),
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const { lat, lng, expiresInHours, ...rest } = req.body;
    const alert = await Alert.create({
      ...rest,
      center: lat !== undefined ? toPoint(lat, lng) : undefined,
      expiresAt: expiresInHours ? new Date(Date.now() + expiresInHours * 3600 * 1000) : undefined,
      createdBy: req.user!._id,
    });
    await audit(req, { action: 'alert.create', targetType: 'Alert', targetId: alert._id, meta: { severity: alert.severity } });
    broadcast('alert:new', alert); // public safety info only; clients filter by area
    res.status(201).json({ success: true, data: alert });
  })
);

router.delete(
  '/:id',
  authorize('authority'),
  validate({ params: z.object({ id: objectId }) }),
  asyncHandler(async (req, res) => {
    const alert = await Alert.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
    if (!alert) throw new ApiError(404, 'Alert not found');
    await audit(req, { action: 'alert.close', targetType: 'Alert', targetId: alert._id });
    broadcast('alert:closed', { id: alert._id });
    res.json({ success: true });
  })
);

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export default router;
