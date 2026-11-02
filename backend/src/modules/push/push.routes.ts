import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { pushEnabled } from './push.service';
import { PushSubscription } from './pushSubscription.model';

const router = Router();
router.use(authenticate);

// The browser needs the public VAPID key to subscribe. `enabled:false` → hide the "enable notifications" button.
router.get('/public-key', (_req, res) =>
  res.json({ success: true, data: { enabled: pushEnabled(), publicKey: pushEnabled() ? env.VAPID_PUBLIC_KEY : null } })
);

const subscribeSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().min(10), auth: z.string().min(5) }),
});

router.post(
  '/subscribe',
  validate({ body: subscribeSchema }),
  asyncHandler(async (req, res) => {
    // one browser = one endpoint; on a shared device it moves to the account that subscribed last
    await PushSubscription.findOneAndUpdate(
      { endpoint: req.body.endpoint },
      { user: req.user!._id, keys: req.body.keys, userAgent: req.headers['user-agent'] },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({ success: true });
  })
);

router.delete(
  '/subscribe',
  validate({ body: z.object({ endpoint: z.string().url() }) }),
  asyncHandler(async (req, res) => {
    await PushSubscription.deleteOne({ endpoint: req.body.endpoint, user: req.user!._id });
    res.json({ success: true });
  })
);

export default router;
