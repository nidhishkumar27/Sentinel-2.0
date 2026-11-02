import type { Category, Status } from '../../../types/authority';

export const STATUS_LABEL: Record<Status, string> = {
  created: 'New',
  acknowledged: 'Acknowledged',
  assigned: 'Assigned',
  in_progress: 'In progress',
  resolved: 'Resolved',
  cancelled: 'Cancelled',
};

export const CATEGORY_LABEL: Record<Category, string> = { medical: 'Medical', police: 'Police', fire: 'Fire', other: 'Other' };

export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '—';
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export const fmtDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : '—');
export const minutes = (m: number | null | undefined) => (m == null ? '—' : m < 60 ? `${m} min` : `${(m / 60).toFixed(1)} h`);
export const humanize = (s: string) => s.replace(/_/g, ' ');
