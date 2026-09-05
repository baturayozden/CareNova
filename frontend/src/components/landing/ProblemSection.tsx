import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { problemHeading, problemSub, problemCards } from '../../data/landingContent';
import { fadeUp, stagger, sectionHeading, sectionSubheading } from './variants';

export default function ProblemSection() {
  const { i18n } = useTranslation();
  const cards = problemCards(i18n.language);

  return (
    <section id="problem" className="relative py-24 bg-surface-page">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }} variants={stagger()} className="max-w-2xl mb-14">
          <motion.h2 variants={fadeUp} className={sectionHeading}>{problemHeading(i18n.language)}</motion.h2>
          <motion.p variants={fadeUp} className={`${sectionSubheading} mt-4`}>{problemSub(i18n.language)}</motion.p>
        </motion.div>

        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={stagger(0.12)} className="grid md:grid-cols-3 gap-6">
          {cards.map(c => (
            <motion.div key={c.title} variants={fadeUp} className="rounded-2xl bg-surface border border-line p-8 shadow-sm">
              <p className="font-display text-3xl text-accent-hover mb-4">{c.stat}</p>
              <h3 className="font-semibold text-ink text-lg mb-2">{c.title}</h3>
              <p className="text-ink-muted text-sm leading-relaxed">{c.body}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
