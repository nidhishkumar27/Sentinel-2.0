import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../services/authority/api';
import { errorMessage } from '../../../services/authority/http';
import type { Category, IncidentDetail, Status } from '../../../types/authority';
import { AiBadge, CategoryBadge, SeverityBadge, StatusBadge } from '../components/Badges';
import { CATEGORY_LABEL, STATUS_LABEL, fmtDate, timeAgo } from '../lib/format';
import { useOnLiveEvent } from '../live/LiveDataProvider';

const LIMIT = 15;

export default function IncidentsPage() {
  const [rows, setRows] = useState<IncidentDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<Status | ''>('');
  const [category, setCategory] = useState<Category | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const { data, meta } = await api.incidents({
        page, limit: LIMIT, status, category,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
      });
      setRows(data);
      setTotal(Number(meta?.total ?? 0));
      setError('');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [page, status, category, from, to]);

  useEffect(() => { void load(); }, [load]);

  // refresh the list when something changes, but not more than once per second
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useOnLiveEvent((e) => {
    if (e.type === 'location') return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void load(), 1000);
  });
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const pages = Math.max(1, Math.ceil(total / LIMIT));
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };
  const now = Date.now();

  return (
    <>
      <h1>Incidents</h1>
      <div className="auth-card auth-filters">
        <label>Status
          <select value={status} onChange={(e) => reset(setStatus)(e.target.value as Status | '')}>
            <option value="">All</option>
            {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </label>
        <label>Category
          <select value={category} onChange={(e) => reset(setCategory)(e.target.value as Category | '')}>
            <option value="">All</option>
            {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
        </label>
        <label>From<input type="date" value={from} onChange={(e) => reset(setFrom)(e.target.value)} /></label>
        <label>To<input type="date" value={to} onChange={(e) => reset(setTo)(e.target.value)} /></label>
        <button className="auth-btn auth-btn--small" onClick={() => { setStatus(''); setCategory(''); setFrom(''); setTo(''); setPage(1); }}>Clear</button>
      </div>

      {error && <div className="auth-alert auth-alert--error" role="alert">{error}</div>}
      <div className="auth-card auth-scroll">
        <table className="auth-table">
          <thead><tr><th>Reference</th><th>Category</th><th>Severity</th><th>Status</th><th>Reporter</th><th>Assigned to</th><th>AI</th><th>Created</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Link to={`/authority/incidents/${r.id}`}>{r.reference}</Link></td>
                <td><CategoryBadge category={r.category} /></td>
                <td><SeverityBadge severity={r.severity} /></td>
                <td><StatusBadge status={r.status} /></td>
                <td>{r.reporter.name ?? '—'}</td>
                <td>{r.assignedTo?.name ?? '—'}</td>
                <td><AiBadge status={r.ai.status} /></td>
                <td title={fmtDate(r.createdAt)}>{timeAgo(r.createdAt, now)}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && <tr><td colSpan={8} className="auth-muted">No incidents match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="auth-row">
        <button className="auth-btn auth-btn--small" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
        <span className="auth-muted">Page {page} of {pages} · {total} incidents</span>
        <button className="auth-btn auth-btn--small" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>
    </>
  );
}
