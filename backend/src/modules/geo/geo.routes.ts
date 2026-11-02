import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { latSchema, lngSchema } from '../../utils/geo';
import { reverseGeocode, searchPlaces } from './geocoder.service';

const router = Router();
router.use(authenticate, rateLimit({ windowMs: 60 * 1000, limit: 30, keyGenerator: (req) => String(req.user?._id) }));

// coordinates → address
router.get(
  '/reverse',
  validate({ query: z.object({ lat: latSchema, lng: lngSchema }) }),
  asyncHandler(async (req, res) => {
    const { lat, lng } = req.query as unknown as { lat: number; lng: number };
    res.json({ success: true, data: await reverseGeocode(lat, lng), meta: { source: 'OpenStreetMap Nominatim' } });
  })
);

// text → coordinates
router.get(
  '/search',
  validate({ query: z.object({ q: z.string().min(3).max(200), limit: z.coerce.number().int().min(1).max(10).default(5) }) }),
  asyncHandler(async (req, res) => {
    const { q, limit } = req.query as unknown as { q: string; limit: number };
    res.json({ success: true, data: await searchPlaces(q, limit), meta: { source: 'OpenStreetMap Nominatim' } });
  })
);

export default router;
