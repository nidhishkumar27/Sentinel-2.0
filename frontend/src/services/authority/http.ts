import type { AuthUser } from '../../types/authority';

export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5000';
const BASE = `${API_URL}/api/v1`;
const KEY = 'sentinel.authority.session';

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

/** Separate storage key so it never collides with the user app's session. */
export const session = {
  get(): Session | null {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  },
  set(s: Session) {
    localStorage.setItem(KEY, JSON.stringify(s));
  },
  clear() {
    localStorage.removeItem(KEY);
  },
};

export class ApiRequestError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let refreshing: Promise<boolean> | null = null;

/** Rotates the refresh token. Concurrent callers share one refresh. */
export function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const s = session.get();
    if (!s) return false;
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: s.refreshToken }),
      });
      if (!res.ok) return false;
      const json = await res.json();
      session.set({ accessToken: json.data.accessToken, refreshToken: json.data.refreshToken, user: json.data.user });
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  auth?: boolean;
}

export async function request<T>(path: string, opts: RequestOptions = {}, retried = false): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const url = new URL(`${BASE}${path}`);
  Object.entries(opts.query ?? {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });
  const s = session.get();
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: { 'Content-Type': 'application/json', ...(opts.auth !== false && s ? { Authorization: `Bearer ${s.accessToken}` } : {}) },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiRequestError(0, 'NETWORK_ERROR', 'Cannot reach the server');
  }

  if (res.status === 401 && !retried && opts.auth !== false && (await refreshSession())) return request<T>(path, opts, true);

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    if (res.status === 401 && opts.auth !== false) {
      session.clear();
      window.dispatchEvent(new Event('authority:logout'));
    }
    throw new ApiRequestError(res.status, json?.error?.code ?? 'ERROR', json?.error?.message ?? res.statusText, json?.error?.details);
  }
  return { data: json.data as T, meta: json.meta };
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
