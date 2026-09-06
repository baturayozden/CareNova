import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Check, X, Minus } from 'lucide-react';
import { comparisonHeading, comparisonSub, comparisonColumns, comparisonRows, comparisonNote } from '../../data/landingContent';
import { fadeUp, stagger, sectionHeading, sectionSubheading, reveal } from './variants';

function Cell({ value, lang }: { value: string; lang: string }) {
  const isTr = lang?.startsWith('tr');
  if (value === 'yes') return <Check size={18} strokeWidth={2} className="text-success mx-auto" aria-label={isTr ? 'evet' : 'yes'} />;
  if (value === 'no') return <X size={18} strokeWidth={2} className="text-ink-subtle mx-auto" aria-label={isTr ? 'hayır' : 'no'} />;
  if (value === 'partial') return <Minus size={18} strokeWidth={2} className="text-warning mx-auto" aria-label={isTr ? 'kısmi' : 'partial'} />;
  if (value === 'na') return <span className="text-ink-subtle text-sm">—</span>;
  return <span className="text-ink-muted text-sm">{value}</span>;
}

export default function ComparisonSection() {
  const { i18n } = useTranslation();
  const columns = comparisonColumns(i18n.language);
  const rows = comparisonRows(i18n.language);

  return (
    <section id="karsilastirma" aria-labelledby="comparison-heading" className="relative py-24 bg-surface-page">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div {...reveal()} variants={stagger()} className="max-w-2xl mb-12">
          <motion.h2 id="comparison-heading" variants={fadeUp} className={sectionHeading}>{comparisonHeading(i18n.language)}</motion.h2>
          <motion.p variants={fadeUp} className={`${sectionSubheading} mt-4`}>{comparisonSub(i18n.language)}</motion.p>
        </motion.div>

        <motion.div {...reveal()} variants={fadeUp} className="rounded-2xl border border-line bg-surface shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr>
                <th scope="col" className="px-5 py-4 text-left font-semibold text-ink bg-surface"> </th>
                {columns.map((c, i) => (
                  <th
                    key={c}
                    scope="col"
                    className={`px-5 py-4 text-center font-semibold ${i === columns.length - 1 ? 'text-accent bg-accent-soft' : 'text-ink-muted bg-surface'}`}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={r.label} className={ri % 2 === 0 ? 'bg-surface' : 'bg-surface-page/50'}>
                  <th scope="row" className="px-5 py-3.5 text-left font-medium text-ink border-t border-line whitespace-nowrap">{r.label}</th>
                  {r.cells.map((cell, ci) => (
                    <td key={ci} className={`px-5 py-3.5 text-center border-t border-line ${ci === r.cells.length - 1 ? 'bg-accent-soft/40' : ''}`}>
                      <Cell value={cell} lang={i18n.language} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        <motion.p {...reveal()} variants={fadeUp} className="text-ink-muted text-sm max-w-2xl mx-auto mt-8 text-center">
          {comparisonNote(i18n.language)}
        </motion.p>
      </div>
    </section>
  );
}
