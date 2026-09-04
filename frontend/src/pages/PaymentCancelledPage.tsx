import React from 'react';
import AppMeta from '../components/AppMeta';

export default function PaymentCancelledPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <AppMeta title="Payment cancelled | CareNova" />
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        {/* Grey X circle */}
        <div className="flex items-center justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Cancelled</h1>
        <p className="text-gray-500 mb-1">Your payment was not completed.</p>
        <p className="text-gray-400 text-sm">Please contact the clinic if you need assistance.</p>
      </div>
    </div>
  );
}
