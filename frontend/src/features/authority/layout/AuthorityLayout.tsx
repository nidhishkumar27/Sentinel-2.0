import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthorityAuth } from '../auth/AuthorityAuthContext';
import { ConnectionBadge } from '../components/Badges';
import { useLive } from '../live/LiveDataProvider';
import { usePush } from '../push/usePush';

const NAV = [
  { to: '/authority', label: 'Dashboard', end: true },
  { to: '/authority/incidents', label: 'Incidents' },
  { to: '/authority/live-map', label: 'Live map' },
  { to: '/authority/assignments', label: 'Assignments' },
  { to: '/authority/analytics', label: 'Analytics' },
  { to: '/authority/copilot', label: 'Copilot' },
];

export default function AuthorityLayout() {
  const { user, logout } = useAuthorityAuth();
  const navigate = useNavigate();
  const { markers, connection, lastSyncAt } = useLive();
  const push = usePush();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  const unacknowledged = markers.filter((m) => m.status === 'created').length;
  useEffect(() => {
    document.title = unacknowledged ? `(${unacknowledged}) Sentinel · Authority` : 'Sentinel · Authority';
  }, [unacknowledged]);

  // Data older than 60 s while not receiving live pushes must not look current
  const stale = connection !== 'live' && (lastSyncAt === null || now - lastSyncAt > 60_000);

  return (
    <div className="auth-shell">
      <aside className="auth-side">
        <div className="auth-brand">Sentinel</div>
        <nav aria-label="Authority navigation">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              {n.label}
              {n.label === 'Incidents' && unacknowledged > 0 && <span className="auth-count">{unacknowledged}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="auth-main">
        <header className="auth-top">
          <ConnectionBadge connection={connection} />
          <div className="auth-spacer" />
          {push.state === 'disabled' && <button className="auth-btn auth-btn--small" onClick={() => void push.enable()}>Enable alerts</button>}
          {push.state === 'enabled' && <button className="auth-btn auth-btn--small" onClick={() => void push.disable()}>Alerts on</button>}
          {push.state === 'denied' && <span className="auth-muted small">Notifications blocked in browser</span>}
          <span className="auth-muted">{user?.name}{user?.badgeId ? ` · ${user.badgeId}` : ''}</span>
          <button className="auth-btn auth-btn--small" onClick={() => { navigate('/'); void logout(); }}>Sign out</button>
        </header>
        {stale && <div className="auth-alert auth-alert--warn" role="alert">Live updates are interrupted and the data shown may be out of date. Reconnecting…</div>}
        {push.error && <div className="auth-alert auth-alert--warn">{push.error}</div>}
        <main className="auth-content"><Outlet /></main>
      </div>
    </div>
  );
}
