import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import { api } from '../../../services/authority/api';
import { refreshSession, session } from '../../../services/authority/http';
import { createSocket, type Envelope } from '../../../services/authority/socket';
import type { Marker } from '../../../types/authority';

export type Connection = 'live' | 'polling' | 'offline';
export type LiveEvent =
  | { type: 'created' | 'updated'; id: string; marker: Marker }
  | { type: 'location'; id: string; payload: { lat: number; lng: number; accuracyM: number | null; at: string } }
  | { type: 'ai'; id: string; payload: { aiStatus: string } };
type Listener = (e: LiveEvent) => void;

interface Live {
  markers: Marker[];
  connection: Connection;
  lastSyncAt: number | null;
  subscribe: (fn: Listener) => () => void;
  refresh: () => Promise<boolean>;
}

const Ctx = createContext<Live | null>(null);
const POLL_MS = 15_000;
const CLOSED = new Set(['resolved', 'cancelled']);

/**
 * Keeps the open-incident list fresh:
 *  1. Socket.IO pushes minimal markers instantly.
 *  2. If the socket is down we poll the REST API every 15 s (the reliable fallback).
 *  3. `lastSyncAt` lets the UI show a "data may be stale" warning.
 */
export function LiveDataProvider({ children }: { children: ReactNode }) {
  const [byId, setById] = useState<Map<string, Marker>>(new Map());
  const [connection, setConnection] = useState<Connection>('offline');
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const listeners = useRef(new Set<Listener>());
  const socketRef = useRef<Socket | null>(null);

  const emit = useCallback((e: LiveEvent) => listeners.current.forEach((l) => l(e)), []);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.markers();
      setById(new Map(data.map((m) => [m.id, m])));
      setLastSyncAt(Date.now());
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    void refresh();
    const s = session.get();
    if (!s) return;

    const socket = createSocket(s.accessToken);
    socketRef.current = socket;

    const apply = (m: Marker) =>
      setById((prev) => {
        const next = new Map(prev);
        if (CLOSED.has(m.status)) next.delete(m.id);
        else next.set(m.id, m);
        return next;
      });

    socket.on('connect', () => {
      setConnection('live');
      void refresh(); // resync anything missed while disconnected
    });
    socket.on('disconnect', () => setConnection('polling'));
    socket.on('connect_error', async (err) => {
      setConnection('polling');
      if (err.message === 'unauthorized' && (await refreshSession())) {
        const fresh = session.get();
        if (fresh) {
          socket.auth = { token: fresh.accessToken };
          socket.connect();
        }
      }
    });

    const onMarker = (type: 'created' | 'updated') => (e: Envelope<Marker>) => {
      apply(e.data);
      setLastSyncAt(Date.now());
      emit({ type, id: e.data.id, marker: e.data });
    };
    socket.on('incident:created', onMarker('created'));
    socket.on('incident:updated', onMarker('updated'));
    socket.on('incident:location', (e: Envelope<{ id: string; lat: number; lng: number; accuracyM: number | null; at: string }>) => {
      setLastSyncAt(Date.now());
      emit({ type: 'location', id: e.data.id, payload: e.data });
    });
    socket.on('incident:ai_updated', (e: Envelope<{ id: string; aiStatus: string }>) => emit({ type: 'ai', id: e.data.id, payload: e.data }));

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [refresh, emit]);

  // fallback polling while the socket is not connected
  useEffect(() => {
    const t = setInterval(async () => {
      if (socketRef.current?.connected) return;
      const ok = await refresh();
      setConnection(ok ? 'polling' : 'offline');
    }, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const subscribe = useCallback((fn: Listener) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  const markers = useMemo(() => [...byId.values()].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)), [byId]);
  const value = useMemo(() => ({ markers, connection, lastSyncAt, subscribe, refresh }), [markers, connection, lastSyncAt, subscribe, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLive(): Live {
  const c = useContext(Ctx);
  if (!c) throw new Error('useLive must be used inside <LiveDataProvider>');
  return c;
}

/** Run `fn` (debounced) whenever a live event arrives, optionally only for one incident id. */
export function useOnLiveEvent(fn: (e: LiveEvent) => void, id?: string) {
  const { subscribe } = useLive();
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => subscribe((e) => (!id || e.id === id) && ref.current(e)), [subscribe, id]);
}
