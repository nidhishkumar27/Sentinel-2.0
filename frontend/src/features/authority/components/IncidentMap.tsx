import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapIncident {
  id: string;
  reference: string;
  category: string;
  severity: string;
  status: string;
  lat: number;
  lng: number;
}
export interface MapFacility {
  id: string;
  name: string;
  category: string;
  verified: boolean;
  lat: number;
  lng: number;
}
interface Props {
  incidents: MapIncident[];
  facilities?: MapFacility[];
  trail?: [number, number][];
  focus?: { lat: number; lng: number; zoom?: number } | null;
  fitKey?: string; // change to re-fit the view to the incidents
  height?: number | string;
  onSelect?: (id: string) => void;
  onMoveEnd?: (center: { lat: number; lng: number }) => void;
}

const pin = (severity: string, status: string) =>
  L.divIcon({ className: `auth-pin auth-pin--${severity} auth-pin--${status}`, iconSize: [20, 20], iconAnchor: [10, 10] });
const facilityIcon = (category: string, verified: boolean) =>
  L.divIcon({ className: `auth-facility auth-facility--${category}${verified ? '' : ' auth-facility--unverified'}`, iconSize: [14, 14], iconAnchor: [7, 7] });

// DOM nodes + textContent (never innerHTML) so data can never inject markup into popups
function incidentPopup(m: MapIncident, onSelect?: (id: string) => void) {
  const box = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = m.reference;
  const meta = document.createElement('div');
  meta.textContent = `${m.category} · ${m.severity} · ${m.status.replace(/_/g, ' ')}`;
  box.append(title, meta);
  if (onSelect) {
    const b = document.createElement('button');
    b.className = 'auth-btn auth-btn--small';
    b.textContent = 'Open incident';
    b.onclick = () => onSelect(m.id);
    box.append(b);
  }
  return box;
}
function facilityPopup(f: MapFacility) {
  const box = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = f.name;
  const meta = document.createElement('div');
  meta.textContent = `${f.category.replace(/_/g, ' ')} · ${f.verified ? 'verified' : 'UNVERIFIED'}`;
  box.append(title, meta);
  return box;
}

export default function IncidentMap({ incidents, facilities = [], trail, focus, fitKey = '', height = 420, onSelect, onMoveEnd }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<{ inc: L.LayerGroup; fac: L.LayerGroup; trail: L.LayerGroup } | null>(null);
  const fitted = useRef('');
  const onSelectRef = useRef(onSelect);
  const onMoveRef = useRef(onMoveEnd);
  onSelectRef.current = onSelect;
  onMoveRef.current = onMoveEnd;

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current).setView([20.59, 78.96], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(m);
    layers.current = { fac: L.layerGroup().addTo(m), trail: L.layerGroup().addTo(m), inc: L.layerGroup().addTo(m) };
    m.on('moveend', () => {
      const c = m.getCenter();
      onMoveRef.current?.({ lat: c.lat, lng: c.lng });
    });
    map.current = m;
    const t = setTimeout(() => m.invalidateSize(), 0);
    return () => {
      clearTimeout(t);
      m.remove();
      map.current = null;
      layers.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const l = layers.current;
    if (!m || !l) return;
    l.inc.clearLayers();
    incidents.forEach((i) => L.marker([i.lat, i.lng], { icon: pin(i.severity, i.status) }).bindPopup(incidentPopup(i, (id) => onSelectRef.current?.(id))).addTo(l.inc));
    if (incidents.length && fitted.current !== fitKey) {
      m.fitBounds(L.latLngBounds(incidents.map((i) => [i.lat, i.lng] as [number, number])), { padding: [40, 40], maxZoom: 15 });
      fitted.current = fitKey;
    }
  }, [incidents, fitKey]);

  useEffect(() => {
    const l = layers.current;
    if (!l) return;
    l.fac.clearLayers();
    facilities.forEach((f) => L.marker([f.lat, f.lng], { icon: facilityIcon(f.category, f.verified) }).bindPopup(facilityPopup(f)).addTo(l.fac));
  }, [facilities]);

  useEffect(() => {
    const l = layers.current;
    if (!l) return;
    l.trail.clearLayers();
    if (trail && trail.length > 1) L.polyline(trail, { color: '#2563eb', weight: 3, dashArray: '6 6' }).addTo(l.trail);
  }, [trail]);

  useEffect(() => {
    if (focus) map.current?.setView([focus.lat, focus.lng], focus.zoom ?? 16);
  }, [focus]);

  return <div ref={el} className="auth-map" style={{ height }} role="application" aria-label="Incident map" />;
}
