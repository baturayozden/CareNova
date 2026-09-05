import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { pricingHeading, pricingNote, pricingToggle, pricingTiers, pricingRoiHook, pricingCta } from '../../data/landingContent';
import { fadeUp, stagger, sectionHeading } from './variants';

export default function PricingSection() {
  const { i18n } = useTranslation();
  const [annual, setAnnual] = useState(true);
  const tiers = pricingTiers(i18n.language);
  const [annualLabel, monthlyLabel] = pricingToggle(i18n.language);

  return (
    <section id="pricing" className="relative py-24 bg-surface">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger()} className="text-center max-w-xl mx-auto mb-6">
          <motion.h2 variants={fadeUp} className={sectionHeading}>{pricingHeading(i18n.language)}</motion.h2>
          <motion.p variants={fadeUp} className="text-ink-muted text-sm mt-3">{pricingNote(i18n.language)}</motion.p>
        </motion.div>

        <div className="flex justify-center mb-12">
          <div className="inline-flex items-center gap-1 rounded-xl border border-line p-1">
            <button
              onClick={() => setAnnual(true)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${annual ? 'bg-accent text-white' : 'text-ink-muted'}`}
            >
              {annualLabel}
            </button>
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${!annual ? 'bg-accent text-white' : 'text-ink-muted'}`}
            >
              {monthlyLabel}
            </button>
          </div>
        </div>

        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} variants={stagger(0.1)} className="grid md:grid-cols-3 gap-6 items-start">
          {tiers.map(tier => (
            <motion.div
              key={tier.name}
              variants={fadeUp}
              className={`rounded-2xl p-8 border ${tier.highlight ? 'border-accent bg-slate-900 text-white shadow-2xl md:scale-105' : 'border-line bg-surface-raised'}`}
            >
              {tier.highlight && (
                <span className="inline-block mb-3 text-[11px] font-bold uppercase tracking-widest text-accent-hover">★ {i18n.language?.startsWith('tr') ? 'En Popüler' : 'Most Popular'}</span>
              )}
              <h3 className={`font-display text-2xl mb-1 ${tier.highlight ? 'text-white' : 'text-ink'}`}>{tier.name}</h3>
              <p className={`text-xs mb-5 ${tier.highlight ? 'text-white/60' : 'text-ink-muted'}`}>{tier.audience}</p>
              <p className={`mb-6 ${tier.highlight ? 'text-white' : 'text-ink'}`}>
                <span className="font-display text-4xl">€{annual ? tier.annual : tier.monthly}</span>
                <span className={`text-sm ${tier.highlight ? 'text-white/50' : 'text-ink-muted'}`}> / {i18n.language?.startsWith('tr') ? 'ay' : 'mo'}</span>
              </p>
              <ul className="space-y-2.5 mb-8">
                {tier.features.map(f => (
                  <li key={f} className={`text-sm flex items-start gap-2 ${tier.highlight ? 'text-white/85' : 'text-ink-muted'}`}>
                    <span className={tier.highlight ? 'text-accent-hover' : 'text-accent'}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <a
                href="#cta"
                className="block text-center rounded-xl py-3 text-sm font-semibold transition-colors bg-accent text-white hover:bg-accent-hover"
              >
                {pricingCta(i18n.language)}
              </a>
            </motion.div>
          ))}
        </motion.div>

        <motion.p
          initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}
          className="text-center text-ink-muted text-sm max-w-lg mx-auto mt-12"
        >
          💡 {pricingRoiHook(i18n.language)}
        </motion.p>
      </div>
    </section>
  );
}
