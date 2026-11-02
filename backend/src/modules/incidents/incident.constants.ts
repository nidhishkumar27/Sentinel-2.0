export const CATEGORIES = ['medical', 'police', 'fire', 'other'] as const;
export const STATUSES = ['created', 'acknowledged', 'assigned', 'in_progress', 'resolved', 'cancelled'] as const;
export type Category = (typeof CATEGORIES)[number];
export type Status = (typeof STATUSES)[number];

export const OPEN_STATUSES: Status[] = ['created', 'acknowledged', 'assigned', 'in_progress'];

/**
 * Incident lifecycle (agreed flow: Created → Acknowledged → Assigned → In Progress → Resolved)
 * `assigned → assigned` and `in_progress → assigned` are re-assignments.
 * Resolved and cancelled are final.
 */
export const TRANSITIONS: Record<Status, Status[]> = {
  created: ['acknowledged', 'assigned', 'cancelled'],
  acknowledged: ['assigned', 'resolved', 'cancelled'],
  assigned: ['assigned', 'in_progress', 'resolved', 'cancelled'],
  in_progress: ['assigned', 'resolved'],
  resolved: [],
  cancelled: [],
};

export const canTransition = (from: Status, to: Status) => TRANSITIONS[from].includes(to);

/** Severity is decided by deterministic rules only. It is never taken from user input or an LLM. */
export const SEVERITY_BY_CATEGORY: Record<Category, 'critical' | 'high' | 'medium'> = {
  medical: 'critical',
  fire: 'critical',
  police: 'high',
  other: 'medium',
};
export const deriveSeverity = (c: Category) => SEVERITY_BY_CATEGORY[c];

export const RESOURCE_CATEGORIES_FOR: Record<Category, string[]> = {
  medical: ['hospital', 'safe_shelter'],
  fire: ['fire_station', 'hospital'],
  police: ['police_station', 'safe_shelter'],
  other: ['hospital', 'police_station', 'fire_station', 'safe_shelter'],
};
