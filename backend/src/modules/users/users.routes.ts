import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { latSchema, lngSchema, toPoint } from '../../utils/geo';
import { User } from './user.model';

const router = Router();
router.use(authenticate);

router.get('/me', (req, res) => res.json({ success: true, data: req.user }));

router.patch(
  '/me',
  validate({ body: z.object({ name: z.string().min(2).max(80).optional(), phone: z.string().min(7).max(20).optional() }) }),
  asyncHandler(async (req, res) => {
    Object.assign(req.user!, req.body);
    await req.user!.save();
    res.json({ success: true, data: req.user });
  })
);

router.patch(
  '/me/location',
  validate({ body: z.object({ lat: latSchema, lng: lngSchema }) }),
  asyncHandler(async (req, res) => {
    req.user!.lastLocation = toPoint(req.body.lat, req.body.lng) as any;
    req.user!.lastLocationAt = new Date();
    await req.user!.save();
    res.json({ success: true });
  })
);

// For the assignments screen (authority picks a responder)
router.get(
  '/authorities',
  authorize('authority'),
  asyncHandler(async (_req, res) => {
    const data = await User.find({
  role: 'authority',
  isActive: true,
}).select('name email phone badgeId department');
    res.json({ success: true, data });
  })
);

export default router;
