
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../../services/authority/api';
import { errorMessage, session } from '../../../services/authority/http';

const departments = [
  { value: 'POLICE', label: 'Police Department' },
  { value: 'MEDICAL', label: 'Medical / Ambulance' },
  { value: 'FIRE', label: 'Fire & Rescue' },
  { value: 'DISASTER', label: 'Disaster Management' },
  { value: 'OTHER', label: 'Other Emergency Services' },
] as const;

export default function AuthorityRegisterPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    inviteCode: '',
    badgeId: '',
    department: 'POLICE' as
      | 'POLICE'
      | 'MEDICAL'
      | 'FIRE'
      | 'DISASTER'
      | 'OTHER',
  });

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      const { data } = await api.register({
        ...form,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        badgeId: form.badgeId.trim() || undefined,
      });

      if (data.user.role !== 'authority') throw new Error('This account is not an authority account.');
      session.set({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
      window.dispatchEvent(new CustomEvent('authority:registered', { detail: data.user }));
      navigate('/authority', { replace: true });
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
          Register your emergency services authority account.
        </p>

        <label>
          Authority Name
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Mysuru City Police"
            minLength={2}
            maxLength={80}
            required
          />
        </label>

        <label>
          Email
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="authority@example.com"
            required
            autoComplete="email"
          />
        </label>

        <label>
          Phone Number
          <input
            name="phone"
            type="tel"
            value={form.phone}
            onChange={handleChange}
            placeholder="9876543210"
            minLength={7}
            maxLength={20}
            required
          />
        </label>

        <label>
          Department
          <select
            name="department"
            value={form.department}
            onChange={handleChange}
            required
          >
            {departments.map((department) => (
              <option key={department.value} value={department.value}>
                {department.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Badge / Official ID (optional)
          <input
            name="badgeId"
            value={form.badgeId}
            onChange={handleChange}
            placeholder="POL001"
          />
        </label>

        <label>
          Password
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            minLength={8}
            maxLength={100}
            required
            autoComplete="new-password"
          />
        </label>

        <label>
          Authority Invite Code
          <input
            name="inviteCode"
            type="password"
            value={form.inviteCode}
            onChange={handleChange}
            required
            autoComplete="off"
          />
        </label>

        {error && (
          <div className="auth-alert auth-alert--error" role="alert">
            {error}
          </div>
        )}

        <button
          className="auth-btn auth-btn--primary"
          type="submit"
          disabled={busy}
        >
          {busy ? 'Creating Account...' : 'Register Authority'}
        </button>

        <p className="auth-muted">
          Already registered? <Link to="/authority/login">Sign in</Link>
        </p>

        <p className="auth-muted">
          <Link to="/">Back to home</Link>
        </p>
      </form>
    </div>
  );
}
