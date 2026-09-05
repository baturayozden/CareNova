import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowRight, BadgeCheck, FileSignature, Clock3, ShieldCheck } from 'lucide-react';
import { trustHeading, trustSub, trustRows } from '../../data/landingContent';
import { fadeUp, stagger, sectionHeading, sectionSubheading } from './variants';

// Small, honest product mock-ups — no photos, no invented names beyond the
// same demo persona used elsewhere in the app (Dr. Emre Yıldız, seen in
// PAKET 5's demo data).
function MiniCard({ kind, name, meta, badge }: { kind: string; name: string; meta: string; badge: string }) {
  if (kind === 'doctor') {
    return (
      <div className="rounded-xl border border-line bg-surface-page p-4 flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
          <BadgeCheck size={20} strokeWidth={1.5} className="text-accent" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink truncate">{name}</p>
          <p className="text-xs text-ink-muted truncate">{meta}</p>
        </div>
        <span className="text-[11px] font-medium text-success bg-success-soft px-2 py-1 rounded-full shrink-0">{badge}</span>
      </div>
    );
  }
  if (kind === 'quote') {
    return (
      <div className="rounded-xl border border-line bg-surface-page p-4 flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
          <FileSignature size={20} strokeWidth={1.5} className="text-accent" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink truncate">{name}</p>
          <p className="text-xs text-ink-muted truncate">{meta}</p>
        </div>
        <span className="text-[11px] font-display text-ink bg-surface-sunken px-2 py-1 rounded-full shrink-0">{badge}</span>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-line bg-surface-page p-4 flex items-center gap-3">
      <div className="w-11 h-11 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
        <Clock3 size={20} strokeWidth={1.5} className="text-accent" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink truncate">{name}</p>
        <p className="text-xs text-ink-muted truncate">{meta}</p>
      </div>
      <span className="text-[11px] font-medium text-accent bg-accent-soft px-2 py-1 rounded-full shrink-0">{badge}</span>
    </div>
  );
}

export default function TrustSection() {
  const { i18n } = useTranslation();
  const rows = trustRows(i18n.language);

  return (
    <section id="trust" aria-labelledby="trust-heading" className="relative py-24 bg-surface">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }} variants={stagger()} className="max-w-2xl mb-14 mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <ShieldCheck size={20} strokeWidth={1.5} className="text-accent" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-widest text-accent">Trust</span>
          </div>
          <motion.h2 id="trust-heading" variants={fadeUp} className={sectionHeading}>{trustHeading(i18n.language)}</motion.h2>
          <motion.p variants={fadeUp} className={`${sectionSubheading} mt-4 mx-auto`}>{trustSub(i18n.language)}</motion.p>
        </motion.div>

        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} variants={stagger(0.14)} className="space-y-6">
          {rows.map(r => (
            <motion.div
              key={r.wound}
              variants={fadeUp}
              className="grid md:grid-cols-[1fr_auto_1fr] items-center gap-6 md:gap-8 rounded-2xl border border-line bg-surface-page p-6 md:p-8 shadow-sm"
            >
              <p className="text-ink-muted italic text-lg">{r.wound}</p>
              <div className="hidden md:flex items-center justify-center text-accent">
                <ArrowRight size={22} strokeWidth={1.5} aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-3">
                <div>
                  <p className="font-display text-xl text-accent mb-1">{r.answer}</p>
                  <p className="text-ink-muted text-sm leading-relaxed">{r.detail}</p>
                </div>
                <MiniCard {...r.card} />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
