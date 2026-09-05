import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { HeartPulse } from 'lucide-react';
import { aftercareHeading, aftercareSub, aftercareDays, aftercareExample } from '../../data/landingContent';
import { fadeUp, stagger, sectionHeading, sectionSubheading, reveal } from './variants';

export default function AftercareSection() {
  const { i18n } = useTranslation();
  const days = aftercareDays(i18n.language);
  const example = aftercareExample(i18n.language);
  const [active, setActive] = useState(2); // D+7 selected by default — matches the example message

  return (
    <section id="bakim-hatti" aria-labelledby="aftercare-heading" className="relative py-24 bg-surface-page">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div {...reveal()} variants={stagger()} className="max-w-2xl mb-12">
          <div className="flex items-center gap-2 mb-3">
            <HeartPulse size={20} strokeWidth={1.5} className="text-accent" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-widest text-accent">Aftercare</span>
          </div>
          <motion.h2 id="aftercare-heading" variants={fadeUp} className={sectionHeading}>{aftercareHeading(i18n.language)}</motion.h2>
          <motion.p variants={fadeUp} className={`${sectionSubheading} mt-4`}>{aftercareSub(i18n.language)}</motion.p>
        </motion.div>

        <motion.div {...reveal()} variants={fadeUp} className="rounded-2xl bg-surface border border-line shadow-sm p-6 md:p-10">
          {/* Timeline */}
          <div className="overflow-x-auto pb-2">
            <div className="relative flex items-center justify-between gap-2 min-w-[640px] px-2">
              <div className="absolute left-0 right-0 top-5 h-px bg-line" aria-hidden="true" />
              {days.map((d, i) => (
                <button
                  key={d.day}
                  onClick={() => setActive(i)}
                  aria-pressed={active === i}
                  className="relative z-10 flex flex-col items-center gap-2 group flex-1"
                >
                  <span className={`w-3 h-3 rounded-full border-2 transition-colors ${active === i ? 'bg-accent border-accent' : 'bg-surface border-line-strong group-hover:border-accent'}`} />
                  <span className={`text-xs font-semibold ${active === i ? 'text-accent' : 'text-ink-muted'}`}>{d.day}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Selected day detail + example message */}
          <div className="mt-8 grid md:grid-cols-2 gap-6 items-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
              >
                <p className="text-xs font-semibold text-accent uppercase tracking-wide mb-1">{days[active].day}</p>
                <p className="text-ink text-lg font-medium">{days[active].label}</p>
              </motion.div>
            </AnimatePresence>

            <div className="rounded-2xl bg-surface-page border border-line p-4">
              <p className="text-[11px] text-ink-subtle uppercase tracking-wide mb-2">{example.day}</p>
              <div className="rounded-xl rounded-tl-sm bg-accent text-white px-4 py-2.5 text-sm leading-relaxed max-w-[90%]">
                {example.message}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
