import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';
import { objectId } from '../../utils/geo';
import { EmergencyContact } from './contact.model';

const MAX_CONTACTS = 5;
const router = Router();
router.use(authenticate, authorize('user'));

const body = z.object({
  name: z.string().min(2).max(80),
  phone: z.string().min(7).max(20),
  relationship: z.string().max(40).optional(),
  isPrimary: z.boolean().optional(),
});
const idParams = z.object({ id: objectId });

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const data = await EmergencyContact.find({ user: req.user!._id }).sort({ isPrimary: -1, createdAt: 1 });
    res.json({ success: true, data });
  })
);

router.post(
  '/',
  validate({ body }),
  asyncHandler(async (req, res) => {
    const count = await EmergencyContact.countDocuments({ user: req.user!._id });
    if (count >= MAX_CONTACTS) throw new ApiError(400, `You can save up to ${MAX_CONTACTS} emergency contacts`);
    if (req.body.isPrimary || count === 0) {
      await EmergencyContact.updateMany({ user: req.user!._id }, { isPrimary: false });
      req.body.isPrimary = true;
    }
    const data = await EmergencyContact.create({ ...req.body, user: req.user!._id });
    res.status(201).json({ success: true, data });
  })
);

router.put(
  '/:id',
  validate({ params: idParams, body: body.partial() }),
  asyncHandler(async (req, res) => {
    if (req.body.isPrimary) await EmergencyContact.updateMany({ user: req.user!._id }, { isPrimary: false });
    const data = await EmergencyContact.findOneAndUpdate({ _id: req.params.id, user: req.user!._id }, req.body, {
      new: true,
    });
    if (!data) throw new ApiError(404, 'Contact not found');
    res.json({ success: true, data });
  })
);

router.delete(
  '/:id',
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    const data = await EmergencyContact.findOneAndDelete({ _id: req.params.id, user: req.user!._id });
    if (!data) throw new ApiError(404, 'Contact not found');
    res.json({ success: true });
  })
);

export default router;
