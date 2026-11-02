import { emitToAuthorities, emitToUser } from '../../sockets';
import { logger } from '../../utils/logger';
import { EmergencyContact } from '../emergency-contacts/contact.model';
import { sendPushToAuthorities, sendPushToUsers } from '../push/push.service';
import { User } from '../users/user.model';
import { Notification } from './notification.model';

interface Payload {
  title: string;
  body: string;
  type?: 'sos' | 'incident_update' | 'assignment' | 'alert' | 'system';
  data?: Record<string, unknown>;
}

export type ContactNotificationStatus = 'no_contacts' | 'sent' | 'partial' | 'unavailable' | 'failed';
export interface ContactNotificationSummary {
  status: ContactNotificationStatus;
  total: number;
  inApp: number;
  sms: number;
}

export async function notifyUser(userId: unknown, p: Payload) {
  const n = await Notification.create({ user: userId, ...p });
  emitToUser(userId, 'notification:new', { id: n._id, type: n.type, title: n.title, createdAt: (n as any).createdAt });
  sendPushToUsers([userId], { title: p.title, body: p.body, data: { type: p.type, ...p.data } }).catch((e) => logger.warn('push failed', e?.message));
  return n;
}

export async function notifyAuthorities(p: Payload) {
  const authorities = await User.find({ role: 'authority', isActive: true }).select('_id');
  if (!authorities.length) return;
  await Notification.insertMany(authorities.map((a) => ({ user: a._id, ...p })));
  emitToAuthorities('notification:new', { type: p.type, title: p.title });
  const incidentId = p.data?.incidentId;
  sendPushToAuthorities({
    title: p.title,
    body: p.body,
    data: { type: p.type, ...p.data, url: incidentId ? `/authority/incidents/${String(incidentId)}` : '/authority' },
  }).catch((e) => logger.warn('push failed', e?.message));
}

/**
 * Notify emergency contacts and report what REALLY happened, so the UI never claims
 * "contacts notified" when nothing was delivered.
 * - Contact is also a Sentinel user  → in-app notification (delivered)
 * - Otherwise → SMS via sendSms(); the stub returns 'unavailable' until a provider is wired up.
 */
export async function dispatchToContacts(userId: unknown, userName: string, p: Payload): Promise<ContactNotificationSummary> {
  const contacts = await EmergencyContact.find({ user: userId });
  if (!contacts.length) return { status: 'no_contacts', total: 0, inApp: 0, sms: 0 };

  const registered = await User.find({ phone: { $in: contacts.map((c) => c.phone) } }).select('_id phone');
  const byPhone = new Map(registered.map((u) => [u.phone, u._id]));

  let inApp = 0;
  let sms = 0;
  let unavailable = 0;
  for (const c of contacts) {
    const uid = byPhone.get(c.phone);
    if (uid) {
      await notifyUser(uid, p).then(() => inApp++).catch(() => undefined);
      continue;
    }
    const result = await sendSms(c.phone, `${userName}: ${p.body}`);
    if (result === 'sent') sms++;
    else if (result === 'unavailable') unavailable++;
  }

  const delivered = inApp + sms;
  const status: ContactNotificationStatus =
    delivered === contacts.length ? 'sent' : delivered > 0 ? 'partial' : unavailable > 0 ? 'unavailable' : 'failed';
  return { status, total: contacts.length, inApp, sms };
}

async function sendSms(to: string, message: string): Promise<'sent' | 'unavailable' | 'failed'> {
  // TODO: integrate an SMS provider (Twilio / MSG91 / Fast2SMS) and return 'sent' on confirmed delivery.
  logger.info(`[SMS provider not configured] to=${to} msg="${message}"`);
  return 'unavailable';
}
