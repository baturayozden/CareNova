import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ShieldCheck, FileWarning, FileSignature, ClipboardCheck } from 'lucide-react';
import { complianceHeading, complianceSub, complianceItems, trustBasisHeading, trustBasisItems } from '../../data/landingContent';
import { fadeUp, stagger, reveal } from './variants';

const ICONS = [ShieldCheck, FileWarning, FileSignature, ClipboardCheck];

export default function ComplianceSection() {
  const { i18n } = useTranslation();
  const items = complianceItems(i18n.language);
  const basisItems = trustBasisItems(i18n.language);

  return (
    <>
      <section id="compliance" aria-labelledby="compliance-heading" className="surface-inverted relative py-24 bg-surface text-ink overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-40" style={{
          backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(27,111,234,0.15), transparent 50%)',
        }} />
        <div className="relative mx-auto max-w-6xl px-6">
          <motion.div {...reveal()} variants={stagger()} className="max-w-2xl mb-14">
            <motion.div variants={fadeUp} className="flex items-center gap-2 mb-4">
              <ShieldCheck size={20} strokeWidth={1.5} className="text-accent-hover" aria-hidden="true" />
              <span className="text-accent-hover text-xs font-semibold tracking-widest uppercase">{complianceHeading(i18n.language)}</span>
            </motion.div>
            <motion.h2 id="compliance-heading" variants={fadeUp} className="font-display text-3xl md:text-4xl text-ink leading-tight">
              {complianceSub(i18n.language)}
            </motion.h2>
          </motion.div>

          <motion.div {...reveal()} variants={stagger(0.1)} className="grid sm:grid-cols-2 gap-6">
            {items.map((item, i) => {
              const Icon = ICONS[i];
              return (
                <motion.div key={item.title} variants={fadeUp} className="rounded-2xl bg-white/5 border border-white/10 p-7 flex flex-col gap-3">
                  <Icon size={20} strokeWidth={1.5} className="text-accent-hover" aria-hidden="true" />
                  <h3 className="font-semibold text-ink text-base">{item.title}</h3>
                  <p className="text-ink-muted text-sm leading-relaxed">{item.body}</p>
                  <p className="text-ink-subtle text-xs pt-2 border-t border-line">{item.sanction}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ── "Neye dayanıyoruz" — trust basis in lieu of social proof ────────── */}
      <section aria-labelledby="trust-basis-heading" className="relative py-16 bg-surface-page border-t border-line">
        <div className="mx-auto max-w-6xl px-6">
          <h2 id="trust-basis-heading" className="text-center text-xs font-semibold uppercase tracking-widest text-ink-subtle mb-8">
            {trustBasisHeading(i18n.language)}
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {basisItems.map(item => (
              <div key={item.title} className="text-center">
                <p className="font-medium text-ink text-sm mb-1">{item.title}</p>
                <p className="text-ink-muted text-xs leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
