import React, { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

type Role = 'clinic_owner' | 'clinic_admin' | 'receptionist' | 'doctor';

const ROLE_LABELS: Record<Role, string> = {
  clinic_owner: 'Clinic Owner',
  clinic_admin: 'Clinic Admin',
  receptionist: 'Receptionist',
  doctor: 'Doctor',
};

function getPasswordStrength(password: string): { label: string; color: string } {
  if (password.length === 0) return { label: '', color: '' };
  if (password.length < 8) return { label: 'Weak', color: 'text-red-400' };
  if (password.length < 12) return { label: 'Medium', color: 'text-yellow-400' };
  return { label: 'Strong', color: 'text-green-400' };
}

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<Role>('clinic_admin');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordStrength = getPasswordStrength(password);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      await register({ email, password, firstName, lastName, role });
      navigate('/dashboard');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'bg-navy-800 border border-navy-600 text-white rounded-lg px-4 py-3 w-full focus:outline-none focus:border-gold';
  const labelClass = 'block text-sm font-medium text-gray-400 mb-1';

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4 py-10">
      <div className="bg-navy-900 rounded-2xl p-10 w-full max-w-md shadow-2xl border border-navy-600">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-3xl">🦷</span>
            <span className="text-2xl font-serif">
              <span className="text-gold">Care</span>
              <span className="text-white">Dental</span>
            </span>
          </div>
          <p className="text-gray-400 text-sm">AI-powered lead recovery</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                autoComplete="given-name"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                autoComplete="family-name"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className={inputClass}
            />
            {passwordStrength.label && (
              <p className={`text-xs mt-1 ${passwordStrength.color}`}>
                Password strength: {passwordStrength.label}
              </p>
            )}
          </div>

          <div>
            <label className={labelClass}>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="bg-navy-800 border border-navy-600 text-white rounded-lg px-4 py-3 w-full focus:outline-none focus:border-gold appearance-none"
            >
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gold hover:bg-gold-light text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-gray-400 text-sm mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-gold font-semibold hover:text-gold-light">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
