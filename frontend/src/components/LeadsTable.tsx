import React, { useState } from 'react';
import { Lead } from '../types';

interface Props {
  leads:        Lead[];
  onRowClick?:  (leadId: string) => void;
}

type StatusFilter = 'all' | 'new' | 'contacted' | 'booked';

const statusStyles: Record<Lead['status'], string> = {
  new:       'bg-blue-900 text-blue-300 border border-blue-700',
  contacted: 'bg-yellow-900 text-yellow-300 border border-yellow-700',
  responded: 'bg-purple-900 text-purple-300 border border-purple-700',
  qualified: 'bg-cyan-900 text-cyan-300 border border-cyan-700',
  booked:    'bg-green-900 text-green-300 border border-green-700',
  attended:  'bg-emerald-900 text-emerald-300 border border-emerald-700',
  lost:      'bg-red-900 text-red-300 border border-red-700',
  archived:  'bg-gray-800 text-gray-400 border border-gray-600',
};

const languageLabels: Record<string, string> = {
  en: '🇬🇧 EN',
  tr: '🇹🇷 TR',
  ar: '🇸🇦 AR',
  es: '🇪🇸 ES',
  ru: '🇷🇺 RU',
};

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const filterButtons: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'New', value: 'new' },
  { label: 'Contacted', value: 'contacted' },
  { label: 'Booked', value: 'booked' },
];

export default function LeadsTable({ leads, onRowClick }: Props) {
  const [filter, setFilter] = useState<StatusFilter>('all');

  const filtered =
    filter === 'all' ? leads : leads.filter((l) => l.status === filter);

  return (
    <div className="bg-surface-sunken border border-line rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-line flex items-center justify-between">
        <h2 className="font-serif text-xl text-white">Leads</h2>
        <div className="flex gap-2">
          {filterButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => setFilter(btn.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === btn.value
                  ? 'bg-accent text-white'
                  : 'bg-surface-sunken text-gray-400 hover:text-white'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 uppercase tracking-wider">
              <th className="text-left px-6 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Clinic</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Language</th>
              <th className="text-left px-4 py-3 font-medium">Last Contact</th>
              <th className="text-left px-4 py-3 font-medium">Messages</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((lead) => (
              <tr
                key={lead.id}
                onClick={() => onRowClick?.(lead.id)}
                className={`border-t border-line bg-surface-sunken transition-colors ${onRowClick ? 'hover:bg-surface-sunken cursor-pointer' : ''}`}
              >
                <td className="px-6 py-3">
                  <div>
                    <p className="text-white font-medium">{lead.name}</p>
                    <p className="text-gray-500 text-xs">{lead.phone}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-300">{lead.clinic}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[lead.status]}`}
                  >
                    {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-300 text-xs">
                  {languageLabels[lead.language]}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {formatRelativeTime(lead.lastContact)}
                </td>
                <td className="px-4 py-3">
                  <span className="text-accent font-semibold">{lead.aiMessages}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-gray-500 text-sm">
            No leads match this filter.
          </div>
        )}
      </div>
    </div>
  );
}
