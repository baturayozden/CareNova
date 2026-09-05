import React from 'react';

interface Props {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  confirmDanger?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  confirmDanger = false,
  isLoading = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-surface-sunken border border-line rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-6 pt-6 pb-2">
          <h2 className="text-white font-semibold text-lg">{title}</h2>
          <div className="text-gray-400 text-sm mt-2 leading-relaxed">{message}</div>
        </div>

        <div className="flex gap-3 px-6 py-5">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 rounded-xl border border-line-strong text-gray-300 text-sm font-medium hover:bg-surface-sunken transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
              confirmDanger
                ? 'bg-red-700 hover:bg-red-600 text-white'
                : 'bg-accent hover:bg-accent-hover text-white'
            }`}
          >
            {isLoading && (
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
