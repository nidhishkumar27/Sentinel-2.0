import { describe, expect, it } from 'vitest';
import { answerSchema, briefingSchema, riskSchema } from '../../src/modules/ai-integration/ai.schemas';

describe('AI response validation', () => {
  it('accepts a minimal briefing and fills defaults', () => {
    const r = briefingSchema.parse({ summary: 'Medical emergency reported.' });
    expect(r.nextSteps).toEqual([]);
    expect(r.userGuidance).toEqual([]);
    expect(r.insufficientEvidence).toBe(false);
  });

  it('rejects a briefing without a summary and strips unknown fields', () => {
    expect(briefingSchema.safeParse({ nextSteps: ['x'] }).success).toBe(false);
    expect((briefingSchema.parse({ summary: 's', secret: 'x' }) as any).secret).toBeUndefined();
  });

  it('rejects unknown risk levels and out-of-range scores', () => {
    expect(riskSchema.safeParse({ level: 'extreme' }).success).toBe(false);
    expect(riskSchema.safeParse({ level: 'high', score: 3 }).success).toBe(false);
    expect(riskSchema.safeParse({ level: 'unknown', score: null }).success).toBe(true);
  });

  it('validates answers shared by assistant and copilot', () => {
    expect(answerSchema.parse({ answer: 'Call local emergency services.' }).fallback).toBe(false);
    expect(answerSchema.safeParse({}).success).toBe(false);
  });
});
