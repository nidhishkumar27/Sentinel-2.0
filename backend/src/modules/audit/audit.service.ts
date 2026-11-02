import { Request } from 'express';
import { logger } from '../../utils/logger';
import { UserDocument } from '../users/user.model';
import { AuditLog } from './audit.model';

interface AuditEntry {
  action: string;
  targetType?: string;
  targetId?: unknown;
  actor?: UserDocument | null;
  meta?: Record<string, unknown>;
}

/** Append-only audit trail. Never throws: an audit failure must not break an emergency workflow. */
export async function audit(req: Request | null, e: AuditEntry) {
  try {
    const actor = e.actor ?? req?.user;
    await AuditLog.create({
      actor: actor?._id,
      actorRole: actor?.role,
      action: e.action,
      targetType: e.targetType,
      targetId: e.targetId !== undefined ? String(e.targetId) : undefined,
      ip: req?.ip,
      requestId: req?.id,
      meta: e.meta,
    });
  } catch (err) {
    logger.error('audit write failed', err);
  }
}
