import crypto from 'crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';
import { audit } from '../audit/audit.service';
import { EmergencyContact } from '../emergency-contacts/contact.model';
import { DigitalId } from './digitalId.model';

const router = Router();

const upsertSchema = z.object({
  fullName: z.string().min(2).max(100),
  dateOfBirth: z.coerce.date().optional(),
  gender: z.string().max(20).optional(),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),
  allergies: z.array(z.string().max(60)).max(20).optional(),
  medicalConditions: z.array(z.string().max(60)).max(20).optional(),
  govIdType: z.string().max(30).optional(),
  govIdLast4: z.string().regex(/^\d{4}$/).optional(),
  photoUrl: z.string().url().optional(),
});

// Public: responders scan a QR that points at this link. Only life-saving fields are exposed.
router.get(
  '/verify/:token',
  rateLimit({ windowMs: 60 * 1000, limit: 20 }),
  asyncHandler(async (req, res) => {
    const id = await DigitalId.findOne({ shareToken: req.params.token, shareEnabled: true });
    if (!id || (id.shareExpiresAt && id.shareExpiresAt < new Date())) throw new ApiError(404, 'Link invalid or expired');
    await audit(req, { action: 'digital_id.verify_scan', targetType: 'DigitalId', targetId: id._id });
    const contacts = await EmergencyContact.find({ user: id.user }).select('name phone relationship -_id');
    res.json({
      success: true,
      data: {
        fullName: id.fullName,
        bloodGroup: id.bloodGroup,
        allergies: id.allergies,
        medicalConditions: id.medicalConditions,
        emergencyContacts: contacts,
      },
    });
  })
);

router.use(authenticate, authorize('user'));

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const data = await DigitalId.findOne({ user: req.user!._id });
    res.json({ success: true, data });
  })
);

router.put(
  '/me',
  validate({ body: upsertSchema }),
  asyncHandler(async (req, res) => {
    const data = await DigitalId.findOneAndUpdate({ user: req.user!._id }, { ...req.body, user: req.user!._id }, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    });
    res.json({ success: true, data });
  })
);

// Create / rotate the shareable QR link (default valid for 24h)
router.post(
  '/me/share',
  validate({ body: z.object({ hours: z.number().int().min(1).max(168).default(24) }) }),
  asyncHandler(async (req, res) => {
    const doc = await DigitalId.findOne({ user: req.user!._id });
    if (!doc) throw new ApiError(404, 'Create your digital ID first');
    doc.shareToken = crypto.randomBytes(24).toString('hex');
    doc.shareEnabled = true;
    doc.shareExpiresAt = new Date(Date.now() + req.body.hours * 3600 * 1000);
    await doc.save();
    await audit(req, { action: 'digital_id.share_created', targetType: 'DigitalId', targetId: doc._id });
    res.json({ success: true, data: { shareToken: doc.shareToken, expiresAt: doc.shareExpiresAt } });
  })
);

router.delete(
  '/me/share',
  asyncHandler(async (req, res) => {
    await DigitalId.updateOne({ user: req.user!._id }, { shareEnabled: false, $unset: { shareToken: 1 } });
    res.json({ success: true });
  })
);

export default router;
