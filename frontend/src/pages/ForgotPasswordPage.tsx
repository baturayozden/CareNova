import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import api from '../lib/api';
import AppMeta from '../components/AppMeta';
import carenovaLogoDark  from '../assets/carenova-logo-transparent-dark.svg';
import carenovaLogoLight from '../assets/carenova-logo-transparent-light.svg';

export default function ForgotPasswordPage() {
  const { theme } = useTheme();
  const logoSrc = theme === 'light' ? carenovaLogoLight : carenovaLogoDark;

  const [email, setEmail]             = useState('');
  const [submitted, setSubmitted]     = useState(false);
  const [error, setError]             = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setError('');
    setIsSubmitting(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-navy-950 px-4">
      <AppMeta title="Reset your password | CareNova" />
      <div className="bg-navy-900 rounded-2xl p-10 w-full max-w-md shadow-2xl border border-navy-600">
        <div className="text-center mb-8">
          <img
            src={logoSrc}
            alt="CareNova AI"
            className="w-full max-w-[240px] h-auto mx-auto block mb-1"
          />
        </div>

        {submitted ? (
          <div className="space-y-5 text-center">
            <p className="text-gray-300 text-sm leading-relaxed">
              If an account exists for that email, we've sent a reset link. Check your inbox (and spam).
            </p>
            <Link to="/login" className="block text-gold hover:text-gold-light text-sm transition-colors">
              ← Back to login
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
                autoComplete="email"
                className="bg-navy-800 border border-navy-600 text-white rounded-lg px-4 py-3 w-full focus:outline-none focus:border-gold"
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !email.trim()}
              className="w-full bg-gold hover:bg-gold-light text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Sending…' : 'Send reset link'}
            </button>

            <p className="text-center text-sm">
              <Link to="/login" className="text-gray-400 hover:text-gold transition-colors">
                ← Back to login
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
