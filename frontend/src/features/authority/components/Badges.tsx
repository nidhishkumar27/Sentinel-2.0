import type { AiStatus, Category, Severity, Status } from '../../../types/authority';
import { CATEGORY_LABEL, STATUS_LABEL } from '../lib/format';
import type { Connection } from '../live/LiveDataProvider';

export const StatusBadge = ({ status }: { status: Status }) => <span className={`auth-badge auth-status--${status}`}>{STATUS_LABEL[status]}</span>;
export const SeverityBadge = ({ severity }: { severity: Severity }) => <span className={`auth-badge auth-sev--${severity}`}>{severity}</span>;
export const CategoryBadge = ({ category }: { category: Category }) => <span className="auth-badge auth-badge--plain">{CATEGORY_LABEL[category]}</span>;

const AI_TEXT: Record<AiStatus, string> = {
  pending: 'AI: queued',
  processing: 'AI: working',
  completed: 'AI: ready',
  failed: 'AI: failed',
  unavailable: 'AI: unavailable',
};
export const AiBadge = ({ status }: { status: AiStatus }) => <span className={`auth-badge auth-ai--${status}`}>{AI_TEXT[status]}</span>;

const CONN_TEXT: Record<Connection, string> = { live: 'Live', polling: 'Reconnecting · refreshing every 15s', offline: 'Offline' };
export const ConnectionBadge = ({ connection }: { connection: Connection }) => (
  <span className={`auth-badge auth-conn--${connection}`} role="status">● {CONN_TEXT[connection]}</span>
);
