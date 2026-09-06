import React from 'react';
import { Construction } from 'lucide-react';
import AppMeta from '../../components/AppMeta';

// Same honesty rule as the clinic side's ComingSoonPage (brief D.4): a short
// explanation of what the module WILL do, never fake data pretending it
// already works.
export default function AdminComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-6">
      <AppMeta title={`${title} | CareNova Platform`} />
      <Construction size={36} strokeWidth={1.5} className="text-ink-subtle mb-4" aria-hidden="true" />
      <h1 className="text-lg font-semibold text-ink mb-2">{title}</h1>
      <p className="text-ink-muted text-sm max-w-md">{description}</p>
    </div>
  );
}
