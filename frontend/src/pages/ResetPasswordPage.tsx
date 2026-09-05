import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import api from '../lib/api';
import AppMeta from '../components/AppMeta';
import carenovaLogoDark  from '../assets/carenova-logo-transparent-dark.svg';
import carenovaLogoLight from '../assets/carenova-logo-transparent-light.svg';

export default function ResetPasswordPage() {
  const { theme } = useTheme();
  const logoSrc = theme === 'light' ? carenovaLogoLight : carenovaLogoDark;
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess]                 = useState(false);
  const [error, setError]                     = useState('');
  const [apiError, setApiError]               = useState(false);
  const [isSubmitting, setIsSubmitting]       = useState(false);

  const handleSubmit = async () => {
    setError('');
    setApiError(false);

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      setSuccess(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Something went wrong. Please try again.');
      setApiError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputCls = 'bg-surface-sunken border border-line text-white rounded-lg px-4 py-3 w-full focus:outline-none focus:border-accent';

  return (
    <div className="flex h-screen items-center justify-center bg-surface-page px-4">
      <AppMeta title="Set a new password | CareNova" />
      <div className="bg-surface rounded-2xl p-10 w-full max-w-md shadow-2xl border border-line">
        <div className="text-center mb-8">
          <img
            src={logoSrc}
            alt="CareNova AI"
            className="w-full max-w-[240px] h-auto mx-auto block mb-1"
          />
        </div>

        {!token ? (
          <div className="space-y-5 text-center">
            <p className="text-red-400 text-sm">Invalid reset link.</p>
            <Link to="/forgot-password" className="block text-accent hover:text-accent-hover text-sm transition-colors">
              Request a new link
            </Link>
          </div>
        ) : success ? (
          <div className="space-y-5 text-center">
            <p className="text-gray-300 text-sm leading-relaxed">
              Your password has been updated.
            </p>
            <Link
              to="/login"
              className="inline-block w-full bg-accent hover:bg-accent-hover text-white font-semibold py-3 rounded-lg transition-colors text-center"
            >
              Go to login
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
                autoComplete="new-password"
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Confirm password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
                autoComplete="new-password"
                className={inputCls}
              />
            </div>

            {error && (
              <div className="space-y-2">
                <p className="text-red-400 text-sm">{error}</p>
                {apiError && (
                  <Link to="/forgot-password" className="block text-accent hover:text-accent-hover text-sm transition-colors">
                    Request a new link
                  </Link>
                )}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !newPassword || !confirmPassword}
              className="w-full bg-accent hover:bg-accent-hover text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Updating…' : 'Update password'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
