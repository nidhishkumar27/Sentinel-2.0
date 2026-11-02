import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from '../../../services/authority/api';
import { session } from '../../../services/authority/http';
import type { AuthUser } from '../../../types/authority';

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthorityAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => session.get()?.user ?? null);
  const [loading, setLoading] = useState<boolean>(() => session.get() !== null);

  // validate a stored session once on load
  useEffect(() => {
    if (!session.get()) return;
    api
      .me()
      .then(({ data }) => {
        if (data.role !== 'authority') throw new Error('not authority');
        setUser(data);
      })
      .catch(() => {
        session.clear();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // the http client fires this when a refresh fails
  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener('authority:logout', onLogout);
    return () => window.removeEventListener('authority:logout', onLogout);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.login(email, password);
    if (data.user.role !== 'authority') throw new Error('This account is not an authority account.');
    session.set({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    const s = session.get();
    if (s) await api.logout(s.refreshToken).catch(() => undefined);
    session.clear();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuthorityAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuthorityAuth must be used inside <AuthorityAuthProvider>');
  return c;
}

/** UX guard only. Real authorization is enforced by the backend on every request. */
export function RequireAuthority({ children }: { children: ReactNode }) {
  const { user, loading } = useAuthorityAuth();
  const location = useLocation();
  if (loading) return <div className="auth-center">Checking session…</div>;
  if (!user) return <Navigate to="/authority/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
