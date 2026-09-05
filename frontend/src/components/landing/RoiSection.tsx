import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { BarChart3 } from 'lucide-react';
import { roiHeading, roiPanelLabel, roiSub, roiColumns, roiRows, roiFootnote } from '../../data/landingContent';
import { fadeUp, stagger, sectionHeading, sectionSubheading } from './variants';

export default function RoiSection() {
  const { i18n } = useTranslation();
  const columns = roiColumns(i18n.language);
  const rows = roiRows(i18n.language);

  return (
    <section id="roi" aria-labelledby="roi-heading" className="relative py-24 bg-surface">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }} variants={stagger()} className="max-w-2xl mb-6">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={20} strokeWidth={1.5} className="text-accent" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-widest text-accent">ROI</span>
          </div>
          <motion.h2 id="roi-heading" variants={fadeUp} className={sectionHeading}>{roiHeading(i18n.language)}</motion.h2>
          <motion.p variants={fadeUp} className={`${sectionSubheading} mt-4`}>{roiSub(i18n.language)}</motion.p>
        </motion.div>

        <motion.span
          initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}
          className="inline-block mb-6 text-xs font-medium text-warning bg-warning-soft px-3 py-1.5 rounded-full"
        >
          {roiPanelLabel(i18n.language)}
        </motion.span>

        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }} variants={fadeUp} className="rounded-2xl border border-line bg-surface shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="bg-surface-page">
                {columns.map(c => (
                  <th key={c} scope="col" className="px-5 py-3 text-left font-semibold text-ink whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.channel} className={i % 2 === 0 ? 'bg-surface' : 'bg-surface-page/50'}>
                  <th scope="row" className="px-5 py-3.5 text-left font-medium text-ink border-t border-line whitespace-nowrap">{r.channel}</th>
                  <td className="px-5 py-3.5 border-t border-line text-ink-muted">{r.leads}</td>
                  <td className="px-5 py-3.5 border-t border-line text-ink-muted">{r.cpl}</td>
                  <td className="px-5 py-3.5 border-t border-line text-ink-muted">{r.cases}</td>
                  <td className="px-5 py-3.5 border-t border-line text-ink-muted">{r.cac}</td>
                  <td className="px-5 py-3.5 border-t border-line text-ink-muted">{r.commission}</td>
                  <td className="px-5 py-3.5 border-t border-line font-medium text-ink">{r.margin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        <motion.p initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} className="text-ink-subtle text-xs mt-4">
          {roiFootnote(i18n.language)}
        </motion.p>
      </div>
    </section>
  );
}
