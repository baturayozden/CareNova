import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Record-level demo marker, placed next to a fabricated person or clinic name.
 *
 * The badge is real TEXT, not a decorative pseudo-element: copying a row out of
 * a table, or text-extracting a screenshot, carries "ÖRNEK Isabella Conti" along
 * with it. That is the case the page banner cannot cover (DEMO-VERI-ISARETLEME
 * Görev 3) — a cropped screenshot keeps the row and loses the banner.
 *
 * Inline, not flex, so it inherits the surrounding line and any parent
 * `truncate` instead of forcing its own box into dense table cells.
 */
export default function DemoName({ children, when = true }: { children: React.ReactNode; when?: boolean }) {
  const { t } = useTranslation('common');
  // `when` carries the row's own flag for mixed lists (API rows with isDemo):
  // a real clinic next to a demo one gets no badge.
  if (!when) return <>{children}</>;
  return (
    <span data-demo-name="">
      <span
        data-demo-badge=""
        title={t('demoData.nameBadgeLabel')}
        className="inline-block rounded bg-warning-soft px-1 align-middle text-[10px] font-semibold leading-4 tracking-wide text-warning"
      >
        {t('demoData.nameBadge')}
      </span>
      {/* A real space, not margin: margin is invisible to copy/paste and text
          extraction, which would yield "ÖRNEKMarco Rossi". */}
      {' '}
      {children}
    </span>
  );
}

/**
 * Text-only form, for places that cannot hold markup — <option>, title and
 * aria-label attributes. Produces "[ÖRNEK] Name", which the audit accepts.
 */
export function useDemoNameText(): (name: string | null | undefined, when?: boolean) => string {
  const { t } = useTranslation('common');
  return (name, when = true) => (name ? (when ? `[${t('demoData.nameBadge')}] ${name}` : name) : '');
}
