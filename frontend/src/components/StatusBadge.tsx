import React from 'react';

type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'accent';

const TONE_CLASSES: Record<Tone, string> = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  neutral: 'bg-surface-sunken text-ink-muted',
  accent: 'bg-accent-soft text-accent',
};

export default function StatusBadge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${TONE_CLASSES[tone]}`}>
      {children}
    </span>
  );
}
