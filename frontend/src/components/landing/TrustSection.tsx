import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { trustHeading, trustSub, trustRows } from '../../data/landingContent';
import { fadeUp, stagger, sectionHeading, sectionSubheading } from './variants';

export default function TrustSection() {
  const { i18n } = useTranslation();
  const rows = trustRows(i18n.language);

  return (
    <section id="trust" className="relative py-24 bg-surface">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }} variants={stagger()} className="max-w-2xl mb-14 mx-auto text-center">
          <motion.h2 variants={fadeUp} className={sectionHeading}>{trustHeading(i18n.language)}</motion.h2>
          <motion.p variants={fadeUp} className={`${sectionSubheading} mt-4 mx-auto`}>{trustSub(i18n.language)}</motion.p>
        </motion.div>

        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} variants={stagger(0.14)} className="space-y-5">
          {rows.map(r => (
            <motion.div
              key={r.wound}
              variants={fadeUp}
              className="grid md:grid-cols-[1fr_auto_1.4fr] items-center gap-4 md:gap-8 rounded-2xl border border-brand-900/10 bg-brand-900/[0.02] p-6 md:p-8"
            >
              <p className="text-ink-muted italic text-lg">{r.wound}</p>
              <div className="hidden md:flex items-center justify-center text-accent-500 text-2xl">→</div>
              <div>
                <p className="font-display text-xl text-brand-500 mb-1">{r.answer}</p>
                <p className="text-ink-muted text-sm leading-relaxed">{r.detail}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
