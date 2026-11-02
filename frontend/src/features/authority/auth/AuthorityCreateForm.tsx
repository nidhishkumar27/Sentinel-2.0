
import { useState } from 'react';
import {
  AUTHORITY_DEPARTMENTS,
  type AuthorityDepartment,
} from '../../../types/authority-department';

interface AuthorityFormData {
  name: string;
  email: string;
  password: string;
  department: AuthorityDepartment;
}

interface Props {
  onCreate: (data: AuthorityFormData) => Promise<void>;
}

export default function AuthorityCreateForm({ onCreate }: Props) {
  const [form, setForm] = useState<AuthorityFormData>({
    name: '',
    email: '',
    password: '',
    department: 'POLICE',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await onCreate(form);

      setSuccess('Authority account created successfully.');

      setForm({
        name: '',
        email: '',
        password: '',
        department: 'POLICE',
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to create authority.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="authority-create-form">
      <h2>Create Authority Account</h2>

      <label>Authority Name</label>
      <input
        name="name"
        value={form.name}
        onChange={handleChange}
        placeholder="Mysuru City Police"
        required
      />

      <label>Email</label>
      <input
        name="email"
        type="email"
        value={form.email}
        onChange={handleChange}
        placeholder="authority@example.com"
        required
      />

      <label>Password</label>
      <input
        name="password"
        type="password"
        value={form.password}
        onChange={handleChange}
        minLength={8}
        placeholder="Enter password"
        required
      />

      <label>Authority Department</label>
      <select
        name="department"
        value={form.department}
        onChange={handleChange}
        required
      >
        {AUTHORITY_DEPARTMENTS.map((department) => (
          <option key={department.value} value={department.value}>
            {department.label}
          </option>
        ))}
      </select>

      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Authority'}
      </button>

      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}
    </form>
  );
}
