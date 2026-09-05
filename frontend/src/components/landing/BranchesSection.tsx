import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { CheckCircle2, Settings2 } from 'lucide-react';
import { branchesHeading, branchesSub, branchesTable } from '../../data/landingContent';
import { fadeUp, stagger, sectionHeading, sectionSubheading, reveal } from './variants';

export default function BranchesSection() {
  const { i18n } = useTranslation();
  const rows = branchesTable(i18n.language);
  const isReady = (status: string) => status === 'Hazır şablon' || status === 'Ready template';

  return (
    <section id="branslar" aria-labelledby="branches-heading" className="relative py-24 bg-surface">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div {...reveal()} variants={stagger()} className="max-w-2xl mb-12">
          <motion.h2 id="branches-heading" variants={fadeUp} className={sectionHeading}>{branchesHeading(i18n.language)}</motion.h2>
          <motion.p variants={fadeUp} className={`${sectionSubheading} mt-4`}>{branchesSub(i18n.language)}</motion.p>
        </motion.div>

        <motion.div
          {...reveal()} variants={fadeUp}
          className="rounded-2xl border border-line shadow-sm overflow-x-auto"
        >
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="bg-surface-page text-left">
                <th scope="col" className="px-5 py-3 font-semibold text-ink">{pick(i18n.language, 'Branş', 'Branch')}</th>
                <th scope="col" className="px-5 py-3 font-semibold text-ink">{pick(i18n.language, 'Durum', 'Status')}</th>
                <th scope="col" className="px-5 py-3 font-semibold text-ink">{pick(i18n.language, 'AI yetkisi', 'AI authority')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.branch} className={i % 2 === 0 ? 'bg-surface' : 'bg-surface-page/60'}>
                  <th scope="row" className="px-5 py-3.5 font-medium text-ink text-left border-t border-line whitespace-nowrap">{r.branch}</th>
                  <td className="px-5 py-3.5 border-t border-line whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${isReady(r.status) ? 'bg-success-soft text-success' : 'bg-accent-soft text-accent'}`}>
                      {isReady(r.status) ? <CheckCircle2 size={13} strokeWidth={1.5} /> : <Settings2 size={13} strokeWidth={1.5} />}
                      {r.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 border-t border-line text-ink-muted">{r.authority}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </section>
  );
}

function pick(lang: string, tr: string, en: string) {
  return lang?.startsWith('tr') ? tr : en;
}
