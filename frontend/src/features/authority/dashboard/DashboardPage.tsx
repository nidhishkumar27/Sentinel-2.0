import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../services/authority/api';
import { errorMessage } from '../../../services/authority/http';
import type { Analytics } from '../../../types/authority';
import { CategoryBadge, SeverityBadge, StatusBadge } from '../components/Badges';
import { minutes, timeAgo } from '../lib/format';
import { useLive } from '../live/LiveDataProvider';

export default function DashboardPage() {
  const { markers } = useLive();
  const [stats, setStats] = useState<Analytics | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = () => api.analytics().then((r) => { setStats(r.data); setError(''); }).catch((e) => setError(errorMessage(e)));
    void load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  const count = (s: string) => markers.filter((m) => m.status === s).length;
  const needsAttention = markers.filter((m) => m.status === 'created').sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  const now = Date.now();

  return (
    <>
      <h1>Dashboard</h1>
      {error && <div className="auth-alert auth-alert--warn">Metrics unavailable: {error}</div>}
      <div className="auth-grid auth-grid--stats">
        <Stat label="Open incidents" value={markers.length} />
        <Stat label="Awaiting acknowledgement" value={count('created')} tone={count('created') ? 'danger' : undefined} />
        <Stat label="Assigned" value={count('assigned')} />
        <Stat label="In progress" value={count('in_progress')} />
        <Stat label="Avg. time to acknowledge" value={minutes(stats?.avgAcknowledgeMinutes)} />
        <Stat label="Avg. time to resolve" value={minutes(stats?.avgResolutionMinutes)} />
      </div>

      <section className="auth-card">
        <h3>Needs attention</h3>
        {needsAttention.length === 0 ? (
          <p className="auth-muted">No unacknowledged incidents.</p>
        ) : (
          <table className="auth-table">
            <thead><tr><th>Reference</th><th>Category</th><th>Severity</th><th>Status</th><th>Waiting</th></tr></thead>
            <tbody>
              {needsAttention.map((m) => (
                <tr key={m.id}>
                  <td><Link to={`/authority/incidents/${m.id}`}>{m.reference}</Link></td>
                  <td><CategoryBadge category={m.category} /></td>
                  <td><SeverityBadge severity={m.severity} /></td>
                  <td><StatusBadge status={m.status} /></td>
                  <td>{timeAgo(m.createdAt, now)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {stats && (
        <section className="auth-card">
          <h3>AI enrichment</h3>
          <p className="auth-muted small">AI briefings are optional support. Their status never affects incident handling.</p>
          <div className="auth-row">
            {Object.entries(stats.aiEnrichment).map(([k, v]) => <span key={k} className="auth-badge auth-badge--plain">{k}: {v}</span>)}
          </div>
        </section>
      )}
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: 'danger' }) {
  return (
    <div className={`auth-card auth-stat${tone ? ` auth-stat--${tone}` : ''}`}>
      <div className="auth-stat-value">{value}</div>
      <div className="auth-muted small">{label}</div>
    </div>
  );
}
