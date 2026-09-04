import React from 'react';
import AppMeta from '../components/AppMeta';

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <AppMeta title="Payment received | CareNova" />
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        {/* Green checkmark circle */}
        <div className="flex items-center justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful</h1>
        <p className="text-gray-500 mb-1">Thank you — your payment has been received.</p>
        <p className="text-gray-400 text-sm">You can now close this page.</p>
      </div>
    </div>
  );
}
