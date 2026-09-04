import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { complianceHeading, complianceSub, complianceItems } from '../../data/landingContent';
import { fadeUp, stagger } from './variants';

export default function ComplianceSection() {
  const { i18n } = useTranslation();
  const items = complianceItems(i18n.language);

  return (
    <section id="compliance" className="relative py-24 bg-brand-900 text-white overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-40" style={{
        backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(217,154,43,0.15), transparent 50%)',
      }} />
      <div className="relative mx-auto max-w-6xl px-6">
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }} variants={stagger()} className="max-w-2xl mb-14">
          <motion.span variants={fadeUp} className="inline-block text-accent-300 text-xs font-semibold tracking-widest uppercase mb-4">
            🛡️ {complianceHeading(i18n.language)}
          </motion.span>
          <motion.h2 variants={fadeUp} className="font-display text-3xl md:text-4xl text-white leading-tight">
            {complianceSub(i18n.language)}
          </motion.h2>
        </motion.div>

        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} variants={stagger(0.1)} className="grid sm:grid-cols-2 gap-6">
          {items.map(item => (
            <motion.div key={item.title} variants={fadeUp} className="rounded-2xl bg-white/5 border border-white/10 p-7">
              <h3 className="font-semibold text-white text-base mb-2">{item.title}</h3>
              <p className="text-white/60 text-sm leading-relaxed">{item.body}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
