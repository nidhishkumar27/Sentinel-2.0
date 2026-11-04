
import { useState, type FormEvent } from 'react';
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import { errorMessage } from '../../../services/authority/http';
import { useAuthorityAuth } from './AuthorityAuthContext';

export default function AuthorityLoginPage() {
  const { user, login } = useAuthorityAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const from =
    (location.state as { from?: string } | null)?.from ?? '/authority';

  const registered =
    (location.state as { registered?: boolean } | null)?.registered;

  if (user) {
    return <Navigate to={from} replace />;
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setBusy(true);
    setError('');

    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-root auth-center">
      <form className="auth-card auth-login" onSubmit={submit}>
        <h1>Sentinel · Authority</h1>

        <p className="auth-muted">
          Sign in with your authority account.
        </p>

        {registered && (
          <div className="auth-alert auth-alert--success" role="status">
            Registration successful! You can now sign in with your account.
          </div>
        )}

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>

        {error && (
          <div className="auth-alert auth-alert--error" role="alert">
            {error}
          </div>
        )}

        <button
          className="auth-btn auth-btn--primary"
          disabled={busy}
          type="submit"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="auth-muted" style={{ textAlign: 'center', marginTop: '16px' }}>
          New authority?{' '}
          <Link to="/authority/register">
            Register here
          </Link>
        </p>

        <p className="auth-muted" style={{ textAlign: 'center' }}>
          <Link to="/">Back to home</Link>
        </p>
      </form>
    </div>
  );
}
