import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { platformHeading, platformModules } from '../../data/landingContent';
import { fadeUp, stagger, sectionHeading } from './variants';

const ICONS = ['🌍', '📋', '🩺', '✅', '✈️', '📊'];

export default function PlatformSection() {
  const { i18n } = useTranslation();
  const modules = platformModules(i18n.language);

  return (
    <section id="platform" className="relative py-24 bg-brand-900/[0.03]">
      <div className="mx-auto max-w-6xl px-6">
        <motion.h2 initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} className={`${sectionHeading} mb-14 max-w-xl`}>
          {platformHeading(i18n.language)}
        </motion.h2>

        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} variants={stagger(0.1)} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((m, i) => (
            <motion.div key={m.title} variants={fadeUp} className="rounded-2xl bg-surface border border-brand-900/10 p-7 hover:border-accent-500/40 transition-colors">
              <div className="text-3xl mb-4">{ICONS[i]}</div>
              <h3 className="font-semibold text-ink text-base mb-2">{m.title}</h3>
              <p className="text-ink-muted text-sm leading-relaxed">{m.body}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
