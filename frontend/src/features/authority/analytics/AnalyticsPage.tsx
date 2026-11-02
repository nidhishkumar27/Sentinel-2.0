import { useEffect, useState } from 'react';
import { api } from '../../../services/authority/api';
import { errorMessage } from '../../../services/authority/http';
import type { Analytics } from '../../../types/authority';
import { humanize, minutes } from '../lib/format';

function Bars({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  if (!entries.length) return <p className="auth-muted">No data yet.</p>;
  return (
    <ul className="auth-bars">
      {entries.map(([k, v]) => (
        <li key={k}><span className="auth-bar-label">{humanize(k)}</span><span className="auth-bar"><span style={{ width: `${(v / max) * 100}%` }} /></span><b>{v}</b></li>
      ))}
    </ul>
  );
}

export default function AnalyticsPage() {
  const [s, setS] = useState<Analytics | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api.analytics().then((r) => setS(r.data)).catch((e) => setError(errorMessage(e))); }, []);

  if (error) return <div className="auth-alert auth-alert--error">{error}</div>;
  if (!s) return <p className="auth-muted">Loading…</p>;
  const max = Math.max(1, ...s.perDay.map((d) => d.count));

  return (
    <>
      <h1>Analytics</h1>
      <div className="auth-grid auth-grid--stats">
        <div className="auth-card auth-stat"><div className="auth-stat-value">{s.openIncidents}</div><div className="auth-muted small">Open incidents</div></div>
        <div className="auth-card auth-stat"><div className="auth-stat-value">{minutes(s.avgAcknowledgeMinutes)}</div><div className="auth-muted small">Avg. time to acknowledge</div></div>
        <div className="auth-card auth-stat"><div className="auth-stat-value">{minutes(s.avgResolutionMinutes)}</div><div className="auth-muted small">Avg. time to resolve</div></div>
      </div>
      <section className="auth-card">
        <h3>Incidents per day (last 14 days)</h3>
        {s.perDay.length === 0 ? <p className="auth-muted">No incidents in this period.</p> : (
          <div className="auth-columns" role="img" aria-label="Incidents per day">
            {s.perDay.map((d) => (
              <div key={d.date} className="auth-col" title={`${d.date}: ${d.count}`}>
                <b>{d.count}</b>
                <span style={{ height: `${(d.count / max) * 100}px` }} />
                <small>{d.date.slice(5)}</small>
              </div>
            ))}
          </div>
        )}
      </section>
      <div className="auth-grid auth-grid--two">
        <section className="auth-card"><h3>By status</h3><Bars data={s.byStatus} /></section>
        <section className="auth-card"><h3>By category</h3><Bars data={s.byCategory} /></section>
      </div>
      <section className="auth-card"><h3>AI enrichment status</h3><Bars data={s.aiEnrichment} /></section>
    </>
  );
}
