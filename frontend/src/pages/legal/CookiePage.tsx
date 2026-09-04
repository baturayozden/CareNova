import React from 'react';
import NavBar from '../../components/landing/NavBar';
import Footer from '../../components/landing/Footer';
import SEOMeta from '../../components/SEOMeta';

export default function CookiePage() {
  return (
    <div className="min-h-screen bg-white">
      <SEOMeta
        title="Cookie Policy | CareNova"
        description="Which cookies CareNova uses, why, and how to change your preferences."
        path="/cookies"
      />
      <NavBar />
      <main className="pt-24 pb-24">
        <div className="max-w-3xl mx-auto px-6">

          <h1 className="text-3xl font-bold text-gray-900 mb-1">Cookie Policy</h1>
          <p className="text-sm text-gray-500 mb-10">Last updated: 5 May 2026</p>

          <p className="text-gray-700 leading-relaxed mb-8">
            This Cookie Policy explains how B4MIND Brand Consulting and Digital Marketing Ltd ("CareNova",
            "we", "us") uses cookies and similar technologies on carenova.ai and within the CareNova
            platform (the "Service"). It should be read together with our{' '}
            <a href="/privacy" className="text-gold underline">Privacy Policy</a>.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">1. What are cookies?</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            Cookies are small text files placed on your device when you visit a website. They are widely
            used to make websites work, to improve security, and to remember preferences. Similar
            technologies (such as local storage) may also be used.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">2. The cookies we use</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            We aim to keep cookie usage minimal. The cookies we use fall into the following categories:
          </p>

          <h3 className="text-base font-semibold text-gray-700 mt-6 mb-3">Strictly necessary cookies</h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            These are essential for the Service to function and cannot be switched off. They include:
          </p>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm border-collapse border border-gray-200 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-800 border-b border-gray-200">Cookie</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-800 border-b border-gray-200">Purpose</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-800 border-b border-gray-200">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-700 font-mono text-xs align-top">accessToken</td>
                  <td className="px-4 py-3 text-gray-700 align-top">Authenticates your session (httpOnly, secure)</td>
                  <td className="px-4 py-3 text-gray-700 align-top whitespace-nowrap">~15 minutes</td>
                </tr>
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-700 font-mono text-xs align-top">refreshToken</td>
                  <td className="px-4 py-3 text-gray-700 align-top">Maintains your signed-in session securely (httpOnly, secure)</td>
                  <td className="px-4 py-3 text-gray-700 align-top whitespace-nowrap">~7 days</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-gray-700 leading-relaxed mb-4">
            These authentication cookies are scoped to the .carenova.ai domain to enable secure sign-in
            across our subdomains (app and admin). They are set only after you log in.
          </p>

          <h3 className="text-base font-semibold text-gray-700 mt-6 mb-2">Analytics cookies</h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            We do not currently use analytics cookies. If we introduce them in future, we will update this
            policy and request your consent where required.
          </p>

          <h3 className="text-base font-semibold text-gray-700 mt-6 mb-2">Marketing cookies</h3>
          <p className="text-gray-700 leading-relaxed mb-4">
            We do not use marketing or advertising cookies.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">3. Consent</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            Strictly necessary cookies do not require consent under the Privacy and Electronic
            Communications Regulations (PECR). Should we introduce any non-essential cookies (such as
            analytics or marketing) in future, we will request your consent through a cookie banner before
            placing them, and you will be able to change your choice at any time.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">4. Managing cookies</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            You can control and delete cookies through your browser settings. Blocking strictly necessary
            cookies may prevent you from signing in or using parts of the Service. For more information on
            managing cookies, see your browser's help pages or{' '}
            <a href="https://www.aboutcookies.org" target="_blank" rel="noopener noreferrer" className="text-gold underline">
              aboutcookies.org
            </a>.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">5. Changes to this policy</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            We may update this Cookie Policy from time to time. The "Last updated" date reflects the
            latest version.
          </p>

          <h2 className="text-xl font-semibold text-gray-800 mt-10 mb-3">6. Contact</h2>
          <p className="text-gray-700 leading-relaxed mb-10">
            Questions about our use of cookies? Contact{' '}
            <a href="mailto:info@carenova.ai" className="text-gold underline">info@carenova.ai</a>.
          </p>

        </div>
      </main>
      <Footer />
    </div>
  );
}
