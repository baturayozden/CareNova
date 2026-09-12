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
export default function DemoName({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation('common');
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
export function useDemoNameText(): (name: string | null | undefined) => string {
  const { t } = useTranslation('common');
  return name => (name ? `[${t('demoData.nameBadge')}] ${name}` : '');
}
