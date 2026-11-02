import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../services/authority/api';

export type PushState = 'loading' | 'unsupported' | 'server-disabled' | 'denied' | 'disabled' | 'enabled';

function keyToBytes(base64: string): Uint8Array {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Browser push notifications for new emergencies (needs HTTPS or localhost, and VAPID keys on the server). */
export function usePush() {
  const [state, setState] = useState<PushState>('loading');
  const [error, setError] = useState('');

  const detect = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return setState('unsupported');
    try {
      const { data } = await api.pushKey();
      if (!data.enabled) return setState('server-disabled');
      if (Notification.permission === 'denied') return setState('denied');
      const reg = await navigator.serviceWorker.getRegistration('/authority-sw.js');
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? 'enabled' : 'disabled');
    } catch {
      setState('disabled');
    }
  }, []);

  useEffect(() => {
    void detect();
  }, [detect]);

  const enable = useCallback(async () => {
    setError('');
    try {
      const { data } = await api.pushKey();
      if (!data.enabled || !data.publicKey) return setState('server-disabled');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return setState('denied');
      const reg = await navigator.serviceWorker.register('/authority-sw.js');
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(data.publicKey) as BufferSource });
      const json = sub.toJSON();
      await api.pushSubscribe({ endpoint: sub.endpoint, keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' } });
      setState('enabled');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not enable notifications');
    }
  }, []);

  const disable = useCallback(async () => {
    const reg = await navigator.serviceWorker.getRegistration('/authority-sw.js');
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await api.pushUnsubscribe(sub.endpoint).catch(() => undefined);
      await sub.unsubscribe();
    }
    setState('disabled');
  }, []);

  return { state, error, enable, disable };
}
