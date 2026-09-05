import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { TrendingDown, Users, GraduationCap } from 'lucide-react';
import {
  problemHeading, problemSub, problemCards,
  problemFunnelHeading, problemFunnel,
} from '../../data/landingContent';
import { fadeUp, stagger, sectionHeading, sectionSubheading, reveal } from './variants';

const ICONS = [TrendingDown, Users, GraduationCap];

export default function ProblemSection() {
  const { i18n } = useTranslation();
  const cards = problemCards(i18n.language);
  const funnel = problemFunnel(i18n.language);

  return (
    <section id="problem" aria-labelledby="problem-heading" className="relative py-24 bg-surface-page">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div {...reveal()} variants={stagger()} className="max-w-2xl mb-14">
          <motion.h2 id="problem-heading" variants={fadeUp} className={sectionHeading}>{problemHeading(i18n.language)}</motion.h2>
          <motion.p variants={fadeUp} className={`${sectionSubheading} mt-4`}>{problemSub(i18n.language)}</motion.p>
        </motion.div>

        <motion.div {...reveal()} variants={stagger(0.12)} className="grid md:grid-cols-3 gap-6 mb-16">
          {cards.map((c, i) => {
            const Icon = ICONS[i];
            return (
              <motion.div key={c.title} variants={fadeUp} className="rounded-2xl bg-surface border border-line p-8 shadow-sm flex flex-col gap-4">
                <Icon size={22} strokeWidth={1.5} className="text-accent" aria-hidden="true" />
                <p className="font-display text-3xl text-accent-hover">{c.stat}</p>
                <div>
                  <h3 className="font-semibold text-ink text-lg mb-2">{c.title}</h3>
                  <p className="text-ink-muted text-sm leading-relaxed">{c.body}</p>
                </div>
                <p className="text-ink-subtle text-xs mt-auto pt-2 border-t border-line">Kaynak: {c.source}</p>
              </motion.div>
            );
          })}
        </motion.div>

        {/* ── Visual funnel: same budget, two outcomes ─────────────────── */}
        <motion.div
          {...reveal()} variants={stagger(0.1)}
          className="rounded-2xl bg-surface border border-line shadow-sm p-8 md:p-10"
        >
          <motion.h3 variants={fadeUp} className="text-center font-semibold text-ink text-lg mb-1">{problemFunnelHeading(i18n.language)}</motion.h3>
          <motion.p variants={fadeUp} className="text-center text-ink-muted text-sm mb-8">{funnel.budget}</motion.p>

          <div className="grid md:grid-cols-2 gap-8">
            {([
              { data: funnel.slow, width: '15%', color: 'ink-subtle' },
              { data: funnel.fast, width: '90%', color: 'accent' },
            ] as const).map((row) => (
              <motion.div key={row.data.label} variants={fadeUp} className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-ink">{row.data.label}</span>
                  <span className="font-display text-xl text-ink">{row.data.patients}</span>
                </div>
                <div className="h-3 rounded-full bg-surface-sunken overflow-hidden" role="img" aria-label={`${row.data.label}: ${row.data.patients}`}>
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: row.width }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                    className={`h-full rounded-full ${row.color === 'accent' ? 'bg-accent' : 'bg-ink-subtle'}`}
                  />
                </div>
                <span className="text-ink-muted text-xs">{row.data.cpa}</span>
              </motion.div>
            ))}
          </div>

          <motion.p variants={fadeUp} className="text-ink-subtle text-xs mt-8 pt-4 border-t border-line text-center">
            {funnel.source}
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
