import React from 'react';
import { ActivityEvent } from '../types';
import { MessageSquare, MessageCircle, CheckCircle, Zap } from 'lucide-react';

interface Props {
  events: ActivityEvent[];
}

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

const typeIcons: Record<ActivityEvent['type'], IconComponent> = {
  message_sent:      MessageSquare,
  response_received: MessageCircle,
  booked:            CheckCircle,
  escalated:         Zap,
};

const typeColors: Record<ActivityEvent['type'], string> = {
  message_sent: 'bg-blue-900 border-blue-700',
  response_received: 'bg-purple-900 border-purple-700',
  booked: 'bg-green-900 border-green-700',
  escalated: 'bg-orange-900 border-orange-700',
};

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ActivityFeed({ events }: Props) {
  const sorted = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="bg-surface-sunken border border-line rounded-xl overflow-hidden flex flex-col">
      <div className="px-6 py-4 border-b border-line shrink-0">
        <h2 className="font-serif text-xl text-white">AI Activity</h2>
        <p className="text-xs text-gray-500 mt-0.5">Real-time lead interactions</p>
      </div>

      <div className="overflow-y-auto flex-1">
        {sorted.map((event, idx) => (
          <div
            key={event.id}
            className={`px-5 py-4 ${idx !== sorted.length - 1 ? 'border-b border-line' : ''} hover:bg-surface-sunken transition-colors`}
          >
            <div className="flex gap-3">
              <div
                className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm shrink-0 mt-0.5 ${typeColors[event.type]}`}
              >
                {(() => { const Icon = typeIcons[event.type]; return <Icon size={14} />; })()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-accent text-sm font-medium truncate">
                    {event.leadName}
                  </span>
                  <span className="text-gray-500 text-xs shrink-0">
                    {formatRelativeTime(event.timestamp)}
                  </span>
                </div>
                <p className="text-gray-300 text-xs mt-1 line-clamp-2 leading-relaxed">
                  {event.content}
                </p>
                <p className="text-gray-600 text-xs mt-1">{event.clinic}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
