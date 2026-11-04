import axios from 'axios';
import { env } from '../../config/env';
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
 * Registered contacts get an in-app notification as well as an SMS. Every saved contact
 * receives an SMS attempt, whether or not they have a Sentinel account.
 */
export async function dispatchToContacts(userId: unknown, userName: string, p: Payload): Promise<ContactNotificationSummary> {
  const contacts = await EmergencyContact.find({ user: userId });
  if (!contacts.length) return { status: 'no_contacts', total: 0, inApp: 0, sms: 0 };

  const registered = await User.find({ phone: { $in: contacts.map((c) => c.phone) } }).select('_id phone');
  const byPhone = new Map(registered.map((u) => [u.phone, u._id]));

  let inApp = 0;
  let sms = 0;
  let unavailable = 0;
  let notifiedContacts = 0;
  for (const c of contacts) {
    const uid = byPhone.get(c.phone);
    let inAppDelivered = false;
    if (uid) {
      inAppDelivered = await notifyUser(uid, p).then(() => { inApp++; return true; }).catch(() => false);
    }
    const result = await sendSms(c.phone, `${userName}: ${p.body}`);
    if (result === 'sent') sms++;
    else if (result === 'unavailable') unavailable++;
    if (inAppDelivered || result === 'sent') notifiedContacts++;
  }

  const status: ContactNotificationStatus =
    notifiedContacts === contacts.length ? 'sent' : notifiedContacts > 0 ? 'partial' : unavailable > 0 ? 'unavailable' : 'failed';
  return { status, total: contacts.length, inApp, sms };
}

async function sendSms(to: string, message: string): Promise<'sent' | 'unavailable' | 'failed'> {
  const { FAST2SMS_API_KEY } = env;
  if (!FAST2SMS_API_KEY) {
    logger.warn('Fast2SMS is not configured; emergency contact SMS was not sent');
    return 'unavailable';
  }
  const digits = to.replace(/\D/g, '');
  const recipient = digits.startsWith('91') && digits.length === 12 ? digits.slice(2) : digits;
  if (!/^\d{10}$/.test(recipient)) {
    logger.warn('Fast2SMS requires an Indian 10-digit emergency contact number (optionally prefixed with +91)');
    return 'failed';
  }

  const url = 'https://www.fast2sms.com/dev/bulkV2';
  try {
    const response = await axios.post(url, { route: 'q', message, numbers: recipient }, {
      headers: { Authorization: FAST2SMS_API_KEY, Accept: 'application/json', 'Content-Type': 'application/json' },
      timeout: 10000,
    });
    if (response.data?.return !== true) {
      logger.warn('Fast2SMS did not accept emergency contact SMS', { statusCode: response.data?.status_code });
      return 'failed';
    }
    return 'sent';
  } catch (error: any) {
    logger.warn('Fast2SMS could not accept emergency contact SMS', {
      status: error?.response?.status,
      statusCode: error?.response?.data?.status_code,
    });
    return 'failed';
  }
}
