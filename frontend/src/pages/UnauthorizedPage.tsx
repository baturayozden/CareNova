import React from 'react';
import { Link } from 'react-router-dom';
import AppMeta from '../components/AppMeta';

export default function UnauthorizedPage() {
  return (
    <div className="flex h-screen items-center justify-center bg-navy-950 px-4">
      <AppMeta title="Access denied | CareNova" />
      <div className="text-center">
        <h1 className="font-serif text-5xl text-white mb-3">403</h1>
        <h2 className="font-serif text-2xl text-gold mb-4">Access Denied</h2>
        <p className="text-gray-400 mb-8">
          You don't have permission to view this page.
        </p>
        <Link
          to="/dashboard"
          className="inline-block bg-gold hover:bg-gold-light text-white font-semibold px-6 py-3 rounded-lg transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
