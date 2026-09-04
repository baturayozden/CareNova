import React from 'react';
import { useTranslation } from 'react-i18next';
import AppMeta from '../components/AppMeta';

// Placeholder for CareNova nav items whose underlying data model isn't built
// yet (Case File / branch templates / doctor queue / locked quotes / travel /
// aftercare — PAKET 6-8 in GECE-CALISMA-BRIEFI.md, deliberately deferred
// tonight). Shown instead of a 404 so the demo panel stays fully navigable.
export default function ComingSoonPage({ title }: { title: string }) {
  const { t } = useTranslation('common');
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-6">
      <AppMeta title={`${title} | CareNova`} />
      <div className="text-4xl mb-4">🚧</div>
      <h1 className="text-xl font-semibold text-white mb-2">{title}</h1>
      <p className="text-gray-400 text-sm max-w-sm">{t('comingSoon')}</p>
    </div>
  );
}
