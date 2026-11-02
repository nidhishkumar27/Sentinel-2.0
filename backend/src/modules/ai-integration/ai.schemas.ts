import { z } from 'zod';

export const sourceSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  documentType: z.string().optional(), // sop | advisory | first_aid | ...
  section: z.string().optional(),
  url: z.string().optional(),
  score: z.number().optional(),
});

/** SOS briefing returned by the AI engine (stored on the incident as `ai.briefing`). */
export const briefingSchema = z.object({
  summary: z.string().max(4000), // must be based only on supplied facts
  procedures: z.array(z.object({ title: z.string(), steps: z.array(z.string()).default([]), sourceId: z.string().optional() })).default([]),
  nextSteps: z.array(z.string()).default([]), // for authorities
  userGuidance: z.array(z.string()).default([]), // safe to show to the reporter
  uncertainties: z.array(z.string()).default([]),
  sources: z.array(sourceSchema).default([]),
  insufficientEvidence: z.boolean().default(false),
  model: z.string().optional(),
  generatedAt: z.string().optional(),
  disclaimer: z.string().optional(),
});

/** Risk assessment: advisory only. Never used for routing or dispatch decisions. */
export const riskSchema = z.object({
  level: z.enum(['low', 'medium', 'high', 'unknown']),
  score: z.number().min(0).max(1).nullable().optional(),
  signals: z.array(z.object({ name: z.string(), detail: z.string().optional(), contribution: z.string().optional() })).default([]),
  deterministicRules: z.array(z.object({ rule: z.string(), triggered: z.boolean() })).default([]),
  missingData: z.array(z.string()).default([]),
  uncertainty: z.string().optional(),
  generatedAt: z.string().optional(),
  disclaimer: z.string().optional(),
});

/** Shared by the user safety assistant (RAG) and the authority copilot. */
export const answerSchema = z.object({
  answer: z.string().max(8000),
  sources: z.array(sourceSchema).default([]),
  insufficientEvidence: z.boolean().default(false),
  suggestedActions: z.array(z.string()).default([]),
  fallback: z.boolean().default(false), // true when the AI engine returned its safe fallback answer
  disclaimer: z.string().optional(),
  generatedAt: z.string().optional(),
});

export type Briefing = z.infer<typeof briefingSchema>;
