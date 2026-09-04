import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { initConsent, updateConsent, getConsent, setConsent } from '../lib/consent';

// ── Inline toggle ────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${
        checked ? 'bg-slate-800' : 'bg-gray-300'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// ── Banner ───────────────────────────────────────────────────────────────────
export default function ConsentBanner() {
  const [visible,   setVisible]   = useState(false);
  const [managing,  setManaging]  = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  // On mount: load GTM + replay stored consent, or show banner
  useEffect(() => {
    initConsent();
    if (!getConsent()) setVisible(true);
  }, []);

  // Re-open when "Cookie Preferences" footer link dispatches the event
  useEffect(() => {
    function handleOpen() {
      const stored = getConsent();
      if (stored) {
        setAnalytics(stored.analytics);
        setMarketing(stored.marketing);
      }
      setManaging(true);
      setVisible(true);
    }
    window.addEventListener('open-cookie-preferences', handleOpen);
    return () => window.removeEventListener('open-cookie-preferences', handleOpen);
  }, []);

  function acceptAll() {
    updateConsent(setConsent(true, true));
    setVisible(false);
    setManaging(false);
  }

  function rejectAll() {
    updateConsent(setConsent(false, false));
    setVisible(false);
    setManaging(false);
  }

  function savePrefs() {
    updateConsent(setConsent(analytics, marketing));
    setVisible(false);
    setManaging(false);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9999] bg-white border-t border-gray-200 shadow-2xl"
      role="dialog"
      aria-label="Cookie consent"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">

        {!managing ? (
          /* ── Simple banner ── */
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <p className="text-sm text-gray-600 flex-1 leading-relaxed">
              We use cookies to improve your experience and measure performance.{' '}
              <Link to="/cookies" className="underline hover:text-gray-900 transition-colors">
                Cookie Policy
              </Link>
            </p>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                onClick={rejectAll}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Reject all
              </button>
              <button
                onClick={() => setManaging(true)}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Manage
              </button>
              <button
                onClick={acceptAll}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 text-white hover:bg-slate-700 transition-colors"
                style={{ color: '#fff' }}
              >
                Accept all
              </button>
            </div>
          </div>
        ) : (
          /* ── Manage panel ── */
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Cookie Preferences</h3>

            <div className="space-y-3 divide-y divide-gray-100">
              {/* Necessary */}
              <div className="flex items-start justify-between gap-4 pt-1">
                <div>
                  <p className="text-sm font-medium text-gray-800">Necessary</p>
                  <p className="text-xs text-gray-500 mt-0.5">Required for login and core functionality. Cannot be disabled.</p>
                </div>
                <div className="relative w-10 h-6 rounded-full bg-slate-800 opacity-50 shrink-0 mt-0.5 cursor-not-allowed" />
              </div>
              {/* Analytics */}
              <div className="flex items-start justify-between gap-4 pt-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">Analytics</p>
                  <p className="text-xs text-gray-500 mt-0.5">Helps us understand how visitors use the site (e.g. Google Analytics).</p>
                </div>
                <Toggle checked={analytics} onChange={setAnalytics} />
              </div>
              {/* Marketing */}
              <div className="flex items-start justify-between gap-4 pt-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">Marketing</p>
                  <p className="text-xs text-gray-500 mt-0.5">Enables personalised ads and remarketing (e.g. Meta Pixel).</p>
                </div>
                <Toggle checked={marketing} onChange={setMarketing} />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={savePrefs}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 text-white hover:bg-slate-700 transition-colors"
                style={{ color: '#fff' }}
              >
                Save preferences
              </button>
              <button
                onClick={() => setManaging(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={rejectAll}
                className="ml-auto px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Reject all
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
