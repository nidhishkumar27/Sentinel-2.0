import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../services/authority/api';
import { errorMessage } from '../../../services/authority/http';
import type { IncidentDetail } from '../../../types/authority';
import { useAuthorityAuth } from '../auth/AuthorityAuthContext';
import { CategoryBadge, SeverityBadge, StatusBadge } from '../components/Badges';
import { timeAgo } from '../lib/format';
import { useLive, useOnLiveEvent } from '../live/LiveDataProvider';

export default function AssignmentsPage() {
  const { user } = useAuthorityAuth();
  const { markers, refresh } = useLive();
  const [mine, setMine] = useState<IncidentDetail[]>([]);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const loadMine = useCallback(() => api.assignedToMe().then((r) => setMine(r.data)).catch((e) => setError(errorMessage(e))), []);
  useEffect(() => { void loadMine(); }, [loadMine]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useOnLiveEvent((e) => {
    if (e.type === 'location') return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void loadMine(), 800);
  });
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const queue = markers.filter((m) => m.status === 'created' || m.status === 'acknowledged').sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  const now = Date.now();

  async function takeIt(id: string) {
    if (!user) return;
    setBusyId(id);
    setError('');
    try { await api.assign(id, user._id); await Promise.all([loadMine(), refresh()]); } catch (e) { setError(errorMessage(e)); await refresh(); } finally { setBusyId(''); }
  }

  return (
    <>
      <h1>Assignments</h1>
      {error && <div className="auth-alert auth-alert--error" role="alert">{error}</div>}

      <section className="auth-card">
        <h3>Waiting for a responder ({queue.length})</h3>
        {queue.length === 0 ? <p className="auth-muted">Nothing is waiting.</p> : (
          <table className="auth-table">
            <thead><tr><th>Reference</th><th>Category</th><th>Severity</th><th>Status</th><th>Waiting</th><th /></tr></thead>
            <tbody>
              {queue.map((m) => (
                <tr key={m.id}>
                  <td><Link to={`/authority/incidents/${m.id}`}>{m.reference}</Link></td>
                  <td><CategoryBadge category={m.category} /></td>
                  <td><SeverityBadge severity={m.severity} /></td>
                  <td><StatusBadge status={m.status} /></td>
                  <td>{timeAgo(m.createdAt, now)}</td>
                  <td><button className="auth-btn auth-btn--small auth-btn--primary" disabled={busyId === m.id} onClick={() => void takeIt(m.id)}>Assign to me</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="auth-card">
        <h3>My assignments ({mine.length})</h3>
        {mine.length === 0 ? <p className="auth-muted">You have no active assignments.</p> : (
          <table className="auth-table">
            <thead><tr><th>Reference</th><th>Category</th><th>Severity</th><th>Status</th><th>Address</th></tr></thead>
            <tbody>
              {mine.map((m) => (
                <tr key={m.id}>
                  <td><Link to={`/authority/incidents/${m.id}`}>{m.reference}</Link></td>
                  <td><CategoryBadge category={m.category} /></td>
                  <td><SeverityBadge severity={m.severity} /></td>
                  <td><StatusBadge status={m.status} /></td>
                  <td>{m.address ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
