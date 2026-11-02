import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';
import { objectId, paginationSchema } from '../../utils/geo';
import { Notification } from './notification.model';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  validate({ query: paginationSchema }),
  asyncHandler(async (req, res) => {
    const { page, limit } = req.query as unknown as z.infer<typeof paginationSchema>;
    const filter = { user: req.user!._id };
    const [data, total, unread] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Notification.countDocuments(filter),
      Notification.countDocuments({ ...filter, read: false }),
    ]);
    res.json({ success: true, data, meta: { page, limit, total, unread } });
  })
);

router.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    await Notification.updateMany({ user: req.user!._id, read: false }, { read: true });
    res.json({ success: true });
  })
);

router.patch(
  '/:id/read',
  validate({ params: z.object({ id: objectId }) }),
  asyncHandler(async (req, res) => {
    const n = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user!._id }, { read: true }, { new: true });
    if (!n) throw new ApiError(404, 'Notification not found');
    res.json({ success: true, data: n });
  })
);

export default router;
