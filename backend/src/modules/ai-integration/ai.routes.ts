import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { AI_PATHS, aiPost } from '../../services/aiEngine.client';
import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';
import { latSchema, lngSchema, objectId } from '../../utils/geo';
import { audit } from '../audit/audit.service';
import { OPEN_STATUSES } from '../incidents/incident.constants';
import { Incident } from '../incidents/incident.model';
import { answerSchema, riskSchema } from './ai.schemas';
import { buildAreaContext, buildIncidentContext } from './context.builder';

/**
 * All AI answers are validated against a schema before reaching a client.
 * If the AI engine is down → 503 { code: 'AI_UNAVAILABLE' } and the UI shows its failure state.
 * The core SOS workflow never calls these endpoints.
 */
const router = Router();
router.use(authenticate, rateLimit({ windowMs: 60 * 1000, limit: 20, keyGenerator: (req) => String(req.user?._id) }));

const validated = <T extends z.ZodTypeAny>(schema: T, raw: unknown): z.infer<T> => {
  const r = schema.safeParse(raw);
  if (!r.success) throw new ApiError(502, 'AI response failed validation', r.error.flatten(), 'AI_INVALID_RESPONSE');
  return r.data;
};

// ---- User: safety assistant. Permitted context ONLY: question, optional location, own open incident (category/status) ----
router.post(
  '/assistant',
  authorize('user'),
  validate({ body: z.object({ message: z.string().min(1).max(1000), lat: latSchema.optional(), lng: lngSchema.optional() }) }),
  asyncHandler(async (req, res) => {
    const { message, lat, lng } = req.body;
    const open = await Incident.findOne({ reporter: req.user!._id, status: { $in: OPEN_STATUSES } }).select('category status description');
    const raw = await aiPost(
      AI_PATHS.rag,
      {
        query: message,
        context: {
          audience: 'user',
          location: lat !== undefined ? { lat, lng } : null,
          openIncident: open ? { category: open.category, status: open.status, description: open.description ?? null } : null,
        },
      },
      { requestId: req.id }
    );
    res.json({ success: true, data: validated(answerSchema, raw), meta: { advisory: true } });
  })
);

// ---- Risk assessment (advisory). Not used for dispatch or routing. ----
router.post(
  '/risk',
  validate({ body: z.object({ lat: latSchema, lng: lngSchema }) }),
  asyncHandler(async (req, res) => {
    const { lat, lng } = req.body;
    const raw = await aiPost(AI_PATHS.risk, { context: await buildAreaContext(lat, lng) }, { requestId: req.id });
    res.json({
      success: true,
      data: validated(riskSchema, raw),
      meta: { advisory: true, notice: 'AI-assisted estimate. Not verified. Not used for emergency routing.' },
    });
  })
);

// ---- Authority copilot. Grounded in an incident when incidentId is given. Context never includes reporter PII. ----
router.post(
  '/copilot',
  authorize('authority'),
  validate({ body: z.object({ message: z.string().min(1).max(2000), incidentId: objectId.optional() }) }),
  asyncHandler(async (req, res) => {
    let context: unknown = { audience: 'authority', incident: null };
    if (req.body.incidentId) {
      const incident = await Incident.findById(req.body.incidentId);
      if (!incident) throw new ApiError(404, 'Incident not found');
      context = { audience: 'authority', ...(await buildIncidentContext(incident)) };
    }
    await audit(req, { action: 'ai.copilot_query', targetType: 'Incident', targetId: req.body.incidentId, meta: { messageLength: req.body.message.length } });
    const raw = await aiPost(AI_PATHS.copilot, { message: req.body.message, context }, { requestId: req.id });
    res.json({ success: true, data: validated(answerSchema, raw), meta: { advisory: true } });
  })
);

export default router;
