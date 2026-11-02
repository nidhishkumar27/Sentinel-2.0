import { env } from '../../config/env';
import { AI_PATHS, aiPost } from '../../services/aiEngine.client';
import { emitToAuthorities, emitToUser } from '../../sockets';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';
import { Incident } from '../incidents/incident.model';
import { briefingSchema } from './ai.schemas';
import { buildIncidentContext } from './context.builder';

/**
 * AI enrichment runs AFTER the SOS response has been sent, in the background:
 *   pending → processing → completed | (retry → pending) | unavailable | failed
 * Retries use exponential backoff. State lives in MongoDB (incident.ai), so after a restart
 * resumePendingBriefings() picks unfinished work up again.
 */
export function enqueueBriefing(incidentId: unknown, delayMs = 0) {
  const t = setTimeout(() => {
    runBriefing(String(incidentId)).catch((e) => logger.error('briefing crashed', e));
  }, delayMs);
  t.unref?.();
}

async function runBriefing(id: string) {
  // atomic claim: only one worker can move pending → processing
  const claimed: any = await Incident.findOneAndUpdate(
    { _id: id, 'ai.status': 'pending', status: { $ne: 'cancelled' } },
    { $set: { 'ai.status': 'processing', 'ai.requestedAt': new Date() }, $inc: { 'ai.attempts': 1 } },
    { new: true }
  );
  if (!claimed) return;

  try {
    const context = await buildIncidentContext(claimed);
    const raw = await aiPost(AI_PATHS.briefing, { context }, { requestId: `briefing-${claimed.reference}` });
    const parsed = briefingSchema.safeParse(raw);
    if (!parsed.success)
      throw new ApiError(502, 'AI response failed validation', parsed.error.flatten(), 'AI_INVALID_RESPONSE');

    await Incident.updateOne(
      { _id: id },
      { $set: { 'ai.status': 'completed', 'ai.completedAt': new Date(), 'ai.briefing': parsed.data }, $unset: { 'ai.error': 1 } }
    );
    announce(claimed, 'completed');
  } catch (e) {
    const err = e as ApiError;
    const attempts: number = claimed.ai?.attempts ?? 1;
    const retryable = err.code === 'AI_UNAVAILABLE' || err.code === 'AI_UPSTREAM_ERROR';

    if (retryable && attempts < env.AI_MAX_RETRIES) {
      await Incident.updateOne({ _id: id }, { $set: { 'ai.status': 'pending', 'ai.error': { code: err.code, message: err.message } } });
      enqueueBriefing(id, env.AI_RETRY_BASE_MS * 2 ** (attempts - 1));
      return;
    }
    const status = err.code === 'AI_UNAVAILABLE' ? 'unavailable' : 'failed';
    await Incident.updateOne({ _id: id }, { $set: { 'ai.status': status, 'ai.error': { code: err.code ?? 'ERROR', message: err.message } } });
    announce(claimed, status);
  }
}

function announce(incident: any, status: string) {
  const payload = { id: String(incident._id), reference: incident.reference, aiStatus: status };
  emitToAuthorities('incident:ai_updated', payload);
  emitToUser(incident.reporter, 'incident:ai_updated', payload);
}

/** Manual retry (authority) or startup recovery. */
export async function requeueBriefing(incidentId: string) {
  await Incident.updateOne({ _id: incidentId }, { $set: { 'ai.status': 'pending', 'ai.attempts': 0 }, $unset: { 'ai.error': 1 } });
  enqueueBriefing(incidentId);
}

export async function resumePendingBriefings() {
  await Incident.updateMany({ 'ai.status': 'processing' }, { $set: { 'ai.status': 'pending' } });
  const pending = await Incident.find({ 'ai.status': 'pending', status: { $nin: ['cancelled', 'resolved'] } }).select('_id').limit(200);
  pending.forEach((p, i) => enqueueBriefing(p._id, i * 250));
  if (pending.length) logger.info(`Resuming ${pending.length} pending AI briefings`);
}
