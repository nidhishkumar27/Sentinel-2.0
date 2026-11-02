import { describe, expect, it } from 'vitest';
import { presentForAuthority, presentForUser, toMarker } from '../../src/modules/incidents/incident.presenter';

const base: any = {
  _id: 'inc1',
  reference: 'SNT-20261014-ABCDEF',
  category: 'medical',
  severity: 'critical',
  status: 'assigned',
  description: 'chest pain',
  location: { type: 'Point', coordinates: [74.85, 12.91] },
  reporter: { _id: 'u1', name: 'Asha', phone: '+911234567890' },
  assignedTo: { _id: 'a1', name: 'Officer R', badgeId: 'B-7' },
  timeline: [{ status: 'created', note: 'internal note', by: 'u1', at: new Date() }],
  ai: { status: 'completed', briefing: { summary: 'S', nextSteps: ['authority only'], userGuidance: ['stay calm'], sources: [{ title: 'First aid SOP' }] } },
};

describe('incident presenters (privacy)', () => {
  it('markers contain no personal data', () => {
    const m = JSON.stringify(toMarker(base));
    expect(m).not.toContain('Asha');
    expect(m).not.toContain('+9112');
    expect(m).not.toContain('chest pain');
  });

  it('reporter view hides responder identity, internal notes and authority-only AI output', () => {
    const v: any = presentForUser(base);
    const s = JSON.stringify(v);
    expect(v.responderAssigned).toBe(true);
    expect(s).not.toContain('Officer R');
    expect(s).not.toContain('internal note');
    expect(s).not.toContain('authority only');
    expect(v.ai.guidance).toEqual(['stay calm']);
  });

  it('reporter sees no AI guidance until the briefing is completed', () => {
    const v: any = presentForUser({ ...base, ai: { status: 'processing', briefing: base.ai.briefing } });
    expect(v.ai.guidance).toEqual([]);
  });

  it('reporter phone is visible only to the assigned responder', () => {
    const assignee: any = { _id: 'a1' };
    const other: any = { _id: 'a2' };
    expect((presentForAuthority(base, assignee) as any).reporter.phone).toBe('+911234567890');
    expect((presentForAuthority(base, other) as any).reporter.phone).toBeUndefined();
  });
});
