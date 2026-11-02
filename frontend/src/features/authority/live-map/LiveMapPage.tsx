import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../services/authority/api';
import type { Category, Zone } from '../../../types/authority';
import { CategoryBadge, ConnectionBadge, SeverityBadge, StatusBadge } from '../components/Badges';
import IncidentMap, { type MapFacility } from '../components/IncidentMap';
import { CATEGORY_LABEL, timeAgo } from '../lib/format';
import { useLive } from '../live/LiveDataProvider';

export default function LiveMapPage() {
  const { markers, connection } = useLive();
  const navigate = useNavigate();
  const [category, setCategory] = useState<Category | ''>('');
  const [showFacilities, setShowFacilities] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [facilityError, setFacilityError] = useState('');
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(null);

  const shown = useMemo(() => markers.filter((m) => m.location && (!category || m.category === category)), [markers, category]);
  const mapIncidents = useMemo(() => shown.map((m) => ({ id: m.id, reference: m.reference, category: m.category, severity: m.severity, status: m.status, lat: m.location!.lat, lng: m.location!.lng })), [shown]);

  // load facilities around the visible map centre (debounced)
  useEffect(() => {
    if (!showFacilities || !center) { setZones([]); return; }
    const t = setTimeout(() => {
      api.nearbyZones(center.lat, center.lng, 8000, verifiedOnly).then((r) => { setZones(r.data); setFacilityError(''); }).catch(() => setFacilityError('Could not load facilities'));
    }, 600);
    return () => clearTimeout(t);
  }, [showFacilities, verifiedOnly, center]);

  const facilities: MapFacility[] = zones.map((z) => ({ id: z._id, name: z.name, category: z.category, verified: z.verified, lat: z.location.coordinates[1], lng: z.location.coordinates[0] }));
  const now = Date.now();

  return (
    <>
      <div className="auth-row"><h1>Live map</h1><ConnectionBadge connection={connection} /></div>
      <div className="auth-card auth-filters">
        <label>Category
          <select value={category} onChange={(e) => setCategory(e.target.value as Category | '')}>
            <option value="">All</option>
            {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
        </label>
        <label className="auth-check"><input type="checkbox" checked={showFacilities} onChange={(e) => setShowFacilities(e.target.checked)} /> Show emergency facilities</label>
        {showFacilities && <label className="auth-check"><input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} /> Verified only</label>}
        {facilityError && <span className="auth-muted small">{facilityError}</span>}
      </div>
      <div className="auth-grid auth-grid--map">
        <IncidentMap incidents={mapIncidents} facilities={facilities} focus={focus} fitKey="initial" height="68vh" onSelect={(id) => navigate(`/authority/incidents/${id}`)} onMoveEnd={setCenter} />
        <div className="auth-card auth-scroll" style={{ maxHeight: '68vh' }}>
          <h3>{shown.length} open</h3>
          {shown.length === 0 && <p className="auth-muted">No open incidents.</p>}
          <ul className="auth-list">
            {shown.map((m) => (
              <li key={m.id}>
                <button className="auth-linkbtn" onClick={() => m.location && setFocus({ ...m.location })}>{m.reference}</button>
                <div className="auth-row"><CategoryBadge category={m.category} /><SeverityBadge severity={m.severity} /><StatusBadge status={m.status} /></div>
                <span className="auth-muted small">{timeAgo(m.createdAt, now)}</span>
                <button className="auth-btn auth-btn--small" onClick={() => navigate(`/authority/incidents/${m.id}`)}>Open</button>
              </li>
            ))}
          </ul>
          {showFacilities && <p className="auth-muted small">Squares: facilities (dashed outline = unverified).</p>}
        </div>
      </div>
    </>
  );
}
