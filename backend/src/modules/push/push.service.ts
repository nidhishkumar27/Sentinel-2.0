import webpush from 'web-push';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { User } from '../users/user.model';
import { PushSubscription } from './pushSubscription.model';

let enabled = false;
if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  enabled = true;
} else {
  logger.info('Web push disabled (set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY to enable)');
}

export const pushEnabled = () => enabled;

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>; // keep non-sensitive: push travels through third-party push services
}

export async function sendPushToUsers(userIds: unknown[], payload: PushPayload) {
  if (!enabled || !userIds.length) return;
  const subs: any[] = await PushSubscription.find({ user: { $in: userIds } });
  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } }, body, { TTL: 3600, urgency: 'high' });
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) await PushSubscription.deleteOne({ _id: s._id }); // browser unsubscribed
        else logger.warn('push failed', e?.statusCode ?? e?.message);
      }
    })
  );
}

export async function sendPushToAuthorities(payload: PushPayload) {
  if (!enabled) return;
  const ids = await User.find({ role: 'authority', isActive: true }).distinct('_id');
  await sendPushToUsers(ids, payload);
}
