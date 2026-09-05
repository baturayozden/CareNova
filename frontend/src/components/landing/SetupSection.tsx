import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Rocket } from 'lucide-react';
import { setupHeading, setupSub, setupSteps } from '../../data/landingContent';
import { fadeUp, stagger, sectionHeading } from './variants';

export default function SetupSection() {
  const { i18n } = useTranslation();
  const steps = setupSteps(i18n.language);

  return (
    <section id="kurulum" aria-labelledby="setup-heading" className="relative py-24 bg-surface-page">
      <div className="mx-auto max-w-4xl px-6">
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }} variants={stagger()} className="mb-10 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Rocket size={20} strokeWidth={1.5} className="text-accent" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-widest text-accent">Setup</span>
          </div>
          <motion.h2 id="setup-heading" variants={fadeUp} className={sectionHeading}>{setupHeading(i18n.language)}</motion.h2>
          <motion.p variants={fadeUp} className="text-ink-muted text-base mt-3 max-w-xl mx-auto">{setupSub(i18n.language)}</motion.p>
        </motion.div>

        <motion.ol initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} variants={stagger(0.06)} className="grid sm:grid-cols-2 gap-3 list-none">
          {steps.map((step, i) => (
            <motion.li key={step} variants={fadeUp} className="flex items-center gap-3 rounded-xl bg-surface border border-line px-4 py-3">
              <span className="shrink-0 w-7 h-7 rounded-full bg-accent-soft text-accent text-xs font-bold flex items-center justify-center">{i + 1}</span>
              <span className="text-ink text-sm">{step}</span>
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </section>
  );
}
