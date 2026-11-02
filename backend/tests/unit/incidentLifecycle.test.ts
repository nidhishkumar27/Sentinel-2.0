import { describe, expect, it } from 'vitest';
import { STATUSES, TRANSITIONS, canTransition, deriveSeverity } from '../../src/modules/incidents/incident.constants';
import { generateReference } from '../../src/modules/incidents/incident.service';

describe('incident lifecycle', () => {
  it('allows the agreed happy path', () => {
    const path = ['created', 'acknowledged', 'assigned', 'in_progress', 'resolved'] as const;
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i], path[i + 1])).toBe(true);
  });

  it('does not allow skipping straight to in_progress or resolved from created', () => {
    expect(canTransition('created', 'in_progress')).toBe(false);
    expect(canTransition('created', 'resolved')).toBe(false);
  });

  it('treats resolved and cancelled as final', () => {
    for (const s of STATUSES) {
      expect(canTransition('resolved', s)).toBe(false);
      expect(canTransition('cancelled', s)).toBe(false);
    }
    expect(TRANSITIONS.resolved).toHaveLength(0);
  });

  it('supports re-assignment but not cancelling work in progress', () => {
    expect(canTransition('assigned', 'assigned')).toBe(true);
    expect(canTransition('in_progress', 'assigned')).toBe(true);
    expect(canTransition('in_progress', 'cancelled')).toBe(false);
  });

  it('derives severity from category only', () => {
    expect(deriveSeverity('medical')).toBe('critical');
    expect(deriveSeverity('fire')).toBe('critical');
    expect(deriveSeverity('police')).toBe('high');
    expect(deriveSeverity('other')).toBe('medium');
  });

  it('generates readable, unique references', () => {
    const refs = new Set(Array.from({ length: 2000 }, () => generateReference()));
    expect(refs.size).toBe(2000);
    for (const r of refs) expect(r).toMatch(/^SNT-\d{8}-[A-HJ-NP-Z2-9]{6}$/);
  });
});
