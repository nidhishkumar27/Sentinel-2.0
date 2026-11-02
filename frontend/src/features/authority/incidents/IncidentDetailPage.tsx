import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../../services/authority/api';
import { errorMessage } from '../../../services/authority/http';
import type { HistoryResponse, IncidentDetail, Responder, ResponderInfo } from '../../../types/authority';
import { useAuthorityAuth } from '../auth/AuthorityAuthContext';
import AiBriefingPanel from '../components/AiBriefingPanel';
import { CategoryBadge, SeverityBadge, StatusBadge } from '../components/Badges';
import CopilotChat from '../components/CopilotChat';
import IncidentMap from '../components/IncidentMap';
import IncidentWeatherPanel from './IncidentWeatherPanel';
import { fmtDate, humanize } from '../lib/format';
import { useOnLiveEvent } from '../live/LiveDataProvider';

const CONTACT_TEXT: Record<string, string> = {
  pending: 'Notifying emergency contactsâ€¦',
  no_contacts: 'The reporter has no emergency contacts saved.',
  sent: 'Emergency contacts were notified.',
  partial: 'Some emergency contacts were notified.',
  unavailable: 'Emergency contacts could NOT be reached (no delivery channel available).',
  failed: 'Notifying emergency contacts failed.',
};

export default function IncidentDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuthorityAuth();
  const [inc, setInc] = useState<IncidentDetail | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [info, setInfo] = useState<ResponderInfo | null>(null);
  const [responders, setResponders] = useState<Responder[]>([]);
  const [assignee, setAssignee] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [copilot, setCopilot] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.incident(id);
      setInc(data);
      setLoadError('');
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  }, [id]);

  useEffect(() => { void load(); api.authorities().then((r) => setResponders(r.data)).catch(() => undefined); }, [load]);
  useEffect(() => { api.history(id).then((r) => setHistory(r.data)).catch(() => undefined); }, [id, inc?.updatedAt]);

  // live: location pings extend the trail locally; any other change reloads the incident
  useOnLiveEvent((e) => {
    if (e.type === 'location') {
      const { lat, lng, at } = e.payload;
      setInc((p) => (p ? { ...p, location: { lat, lng }, trail: [...p.trail, { coordinates: [lng, lat], at }] } : p));
    } else void load();
  }, id);

  const open = !!inc && !['resolved', 'cancelled'].includes(inc.status);
  const visible = !!inc?.contactVisible;
  const [infoError, setInfoError] = useState('');
  useEffect(() => {
    if (!visible || !open) { setInfo(null); return; }
    api.responderInfo(id).then((r) => { setInfo(r.data); setInfoError(''); }).catch((e) => setInfoError(errorMessage(e)));
  }, [id, visible, open]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try { await fn(); setNote(''); } catch (e) { setError(errorMessage(e)); } finally { await load(); setBusy(false); }
  }

  if (loadError && !inc) return <div className="auth-alert auth-alert--error">{loadError} <Link to="/authority/incidents">Back</Link></div>;
  if (!inc) return <p className="auth-muted">Loadingâ€¦</p>;

  const mine = inc.assignedTo?.id === user?._id;
  const canAck = inc.status === 'created';
  const canAssign = open;
  const canStart = inc.status === 'assigned' && mine;
  const canResolve = ['acknowledged', 'assigned', 'in_progress'].includes(inc.status) && (!inc.assignedTo || mine);
  const mapPoint = inc.location ? [{ id: inc.id, reference: inc.reference, category: inc.category, severity: inc.severity, status: inc.status, lat: inc.location.lat, lng: inc.location.lng }] : [];

  return (
    <>
      <p><Link to="/authority/incidents">â† Incidents</Link></p>
      <div className="auth-row">
        <h1>{inc.reference}</h1>
        <StatusBadge status={inc.status} /><SeverityBadge severity={inc.severity} /><CategoryBadge category={inc.category} />
      </div>
      {loadError && <div className="auth-alert auth-alert--warn">Could not refresh: {loadError}</div>}

      <div className="auth-grid auth-grid--detail">
        <div>
          <section className="auth-card">
            <h3>Location</h3>
            <p>{inc.address ?? 'Address not available yet'}{inc.location && <span className="auth-muted small"> Â· {inc.location.lat.toFixed(5)}, {inc.location.lng.toFixed(5)}{inc.accuracyM ? ` Â· Â±${Math.round(inc.accuracyM)} m` : ''}</span>}</p>
            <IncidentMap incidents={mapPoint} trail={inc.trail.map((t) => [t.coordinates[1], t.coordinates[0]] as [number, number])} focus={inc.location} fitKey={inc.id} height={300} />
            {inc.trail.length > 1 && <p className="auth-muted small">Dashed line: reporterâ€™s movement ({inc.trail.length} position updates).</p>}
          </section>

          <IncidentWeatherPanel incidentId={id} />

          <section className="auth-card">
            <h3>Details</h3>
            <dl className="auth-dl">
              <dt>Reported</dt><dd>{fmtDate(inc.createdAt)}{inc.clientTimestamp && <span className="auth-muted small"> (device time {fmtDate(inc.clientTimestamp)})</span>}</dd>
              <dt>Reporter</dt><dd>{inc.reporter.name ?? 'â€”'}{inc.reporter.phone ? ` Â· ${inc.reporter.phone}` : <span className="auth-muted small"> Â· phone is shown to the assigned responder only</span>}</dd>
              <dt>Description</dt><dd>{inc.description ?? <span className="auth-muted">None provided</span>}</dd>
              {inc.additionalInfo.map((a, i) => (<><dt key={`t${i}`}>Update</dt><dd key={`d${i}`}>{a.text} <span className="auth-muted small">{fmtDate(a.at)}</span></dd></>))}
              <dt>Assigned to</dt><dd>{inc.assignedTo ? `${inc.assignedTo.name ?? ''}${inc.assignedTo.badgeId ? ` (${inc.assignedTo.badgeId})` : ''}` : 'â€”'}</dd>
              <dt>Contacts</dt><dd>{CONTACT_TEXT[inc.contactNotification.status] ?? inc.contactNotification.status}</dd>
              {inc.resolutionNote && (<><dt>Resolution</dt><dd>{inc.resolutionNote}</dd></>)}
            </dl>
          </section>

          <section className="auth-card">
            <h3>Timeline</h3>
            <ol className="auth-timeline">
              {inc.timeline.map((t, i) => (<li key={i}><strong>{humanize(t.action ?? t.status)}</strong> <span className="auth-muted small">{fmtDate(t.at)}</span>{t.note && <div>{t.note}</div>}</li>))}
            </ol>
          </section>
        </div>

        <div>
          <section className="auth-card">
            <h3>Actions</h3>
            {error && <div className="auth-alert auth-alert--error" role="alert">{error}</div>}
            {!open && <p className="auth-muted">This incident is {inc.status}. No further actions.</p>}
            {canAck && <button className="auth-btn auth-btn--primary" disabled={busy} onClick={() => void run(() => api.acknowledge(id))}>Acknowledge</button>}
            {canAssign && (
              <div className="auth-stack">
                <label>{inc.assignedTo ? 'Reassign to' : 'Assign to'}
                  <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                    <option value="">Select responderâ€¦</option>
                    {responders.map((r) => <option key={r._id} value={r._id}>{r.name}{r.badgeId ? ` (${r.badgeId})` : ''}{r._id === user?._id ? ' â€” me' : ''}</option>)}
                  </select>
                </label>
                <button className="auth-btn" disabled={busy || !assignee} onClick={() => void run(() => api.assign(id, assignee))}>Assign</button>
              </div>
            )}
            {canStart && <button className="auth-btn auth-btn--primary" disabled={busy} onClick={() => void run(() => api.setStatus(id, 'in_progress'))}>Start work</button>}
            {canResolve && (
              <div className="auth-stack">
                <label>Resolution note<textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></label>
                <button className="auth-btn auth-btn--danger" disabled={busy} onClick={() => void run(() => api.setStatus(id, 'resolved', note || undefined))}>Mark resolved</button>
              </div>
            )}
            {open && inc.assignedTo && !mine && <p className="auth-muted small">Only the assigned responder can start or resolve this incident.</p>}
          </section>

          <AiBriefingPanel ai={inc.ai} busy={busy} onRetry={() => void run(() => api.retryAi(id))} />

          {visible && open && (
            <section className="auth-card">
              <h3>Responder information</h3>
              <p className="auth-muted small">Visible only to the assigned responder. Every view is audited.</p>
              {infoError && <div className="auth-alert auth-alert--warn">{infoError}</div>}
              {info && (
                <dl className="auth-dl">
                  <dt>Phone</dt><dd>{info.reporter.phone}</dd>
                  <dt>Blood group</dt><dd>{info.medical?.bloodGroup ?? 'â€”'}</dd>
                  <dt>Allergies</dt><dd>{info.medical?.allergies?.join(', ') || 'â€”'}</dd>
                  <dt>Conditions</dt><dd>{info.medical?.conditions?.join(', ') || 'â€”'}</dd>
                  <dt>Emergency contacts</dt><dd>{info.emergencyContacts.length ? info.emergencyContacts.map((c) => `${c.name} (${c.relationship ?? 'contact'}) ${c.phone}`).join(' Â· ') : 'â€”'}</dd>
                </dl>
              )}
            </section>
          )}

          <section className="auth-card">
            <div className="auth-row">
              <h3>Copilot</h3>
              <button className="auth-btn auth-btn--small" onClick={() => setCopilot((v) => !v)}>{copilot ? 'Hide' : 'Ask about this incident'}</button>
            </div>
            {copilot && <CopilotChat incidentId={id} />}
          </section>

          {history && history.audit.length > 0 && (
            <section className="auth-card">
              <h3>Audit trail</h3>
              <ul className="auth-audit">
                {history.audit.map((a) => <li key={a._id}><code>{a.action}</code> <span className="auth-muted small">{a.actorRole ?? 'system'} Â· {fmtDate(a.createdAt)}</span></li>)}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
