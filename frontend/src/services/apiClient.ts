type ApiErrorBody = {
  code?: string;
  message?: string;
};

type ApiEnvelope = {
  success?: boolean;
  data?: unknown;
  error?: ApiErrorBody;
};

type SessionUser = {
  _id: string;
  name: string;
  email: string;
  role: "user" | "authority";
  isActive: boolean;
};

type SessionTokens = {
  accessToken: string;
  refreshToken: string;
};

type StoredSession = SessionTokens & { user: SessionUser };

const origin = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, "") || "http://localhost:5000";
const baseUrl = `${origin}/api/v1`;
const storageKey = "sentinel.user.session";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSessionUser(value: unknown): value is SessionUser {
  return isRecord(value)
    && typeof value._id === "string"
    && typeof value.name === "string"
    && typeof value.email === "string"
    && (value.role === "user" || value.role === "authority")
    && typeof value.isActive === "boolean";
}

function isStoredSession(value: unknown): value is StoredSession {
  return isRecord(value)
    && typeof value.accessToken === "string"
    && typeof value.refreshToken === "string"
    && isSessionUser(value.user);
}

export const userSession = {
  get(): StoredSession | null {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      return isStoredSession(parsed) ? parsed : null;
    } catch {
      return null;
    }
  },
  set(session: StoredSession) {
    sessionStorage.setItem(storageKey, JSON.stringify(session));
  },
  clear() {
    sessionStorage.removeItem(storageKey);
  },
};

export class ApiClientError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = "ApiClientError";
  }
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const current = userSession.get();
    if (!current) return false;
    try {
      const response = await fetch(`${baseUrl}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      const body: unknown = await response.json();
      if (!response.ok || !isRecord(body) || !isRecord(body.data)) return false;
      const data = body.data;
      if (!isSessionUser(data.user) || typeof data.accessToken !== "string" || typeof data.refreshToken !== "string") return false;
      userSession.set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
      return true;
    } catch {
      return false;
    }
  })().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

export async function requestApi<T>(path: string, options: {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  auth?: boolean;
} = {}, retried = false): Promise<T> {
  const url = new URL(`${baseUrl}${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const current = userSession.get();
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(options.auth !== false && current ? { Authorization: `Bearer ${current.accessToken}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiClientError(0, "NETWORK_ERROR", "Cannot reach the Sentinel API");
  }

  if (response.status === 401 && options.auth !== false && !retried && await refreshSession()) {
    return requestApi<T>(path, options, true);
  }

  const payload: unknown = await response.json().catch(() => null);
  const envelope = isRecord(payload) ? payload as ApiEnvelope : null;
  if (!response.ok || envelope?.success !== true) {
    if (response.status === 401 && options.auth !== false) userSession.clear();
    const error = envelope?.error;
    throw new ApiClientError(response.status, error?.code ?? "API_ERROR", error?.message ?? response.statusText);
  }
  return envelope.data as T;
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}
