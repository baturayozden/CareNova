import React from 'react';
import { DashboardStats } from '../types';
import { Users, CheckCircle, MessageCircle, TrendingUp } from 'lucide-react';

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

interface Props {
  stats: DashboardStats;
  hideClinicMetrics?: boolean;
}

export default function StatsCards({ stats, hideClinicMetrics = false }: Props) {
  const allCards: { label: string; value: string | number; subtitle: string; icon: IconComponent; clinicMetric: boolean }[] = [
    {
      label:        'Total Leads',
      value:        stats.total,
      subtitle:     'All time',
      icon:         Users,
      clinicMetric: false,
    },
    {
      label:        'Booked',
      value:        stats.booked ?? 0,
      subtitle:     'Converted leads',
      icon:         CheckCircle,
      clinicMetric: true,
    },
    {
      label:        'AI Messages Sent',
      value:        stats.aiMessages,
      subtitle:     'Automated outreach',
      icon:         MessageCircle,
      clinicMetric: false,
    },
    {
      label:        'Recovery Rate',
      value:        `${stats.recoveryRate ?? 0}%`,
      subtitle:     'Booked vs total',
      icon:         TrendingUp,
      clinicMetric: true,
    },
  ];

  const cards     = hideClinicMetrics ? allCards.filter(c => !c.clinicMetric) : allCards;
  const gridClass = cards.length === 2 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4';

  return (
    <div className={`grid ${gridClass} gap-4`}>
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-surface rounded-xl p-4 md:p-6 flex flex-col gap-3 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              {card.label}
            </span>
            {(() => { const Icon = card.icon; return <Icon size={20} className="text-accent" />; })()}
          </div>
          <div>
            <p className="text-3xl font-semibold text-accent">{card.value}</p>
            <p className="text-xs text-gray-500 mt-1">{card.subtitle}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
