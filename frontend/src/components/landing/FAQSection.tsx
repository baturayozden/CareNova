import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { faqHeading, faqItems } from '../../data/landingContent';
import { fadeUp, stagger, sectionHeading } from './variants';

export default function FAQSection() {
  const { i18n } = useTranslation();
  const items = faqItems(i18n.language);
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-24 bg-surface-page">
      <div className="mx-auto max-w-3xl px-6">
        <motion.h2 initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} className={`${sectionHeading} text-center mb-12`}>
          {faqHeading(i18n.language)}
        </motion.h2>

        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }} variants={stagger(0.06)} className="space-y-3">
          {items.map((item, i) => {
            const isOpen = openIdx === i;
            return (
              <motion.div key={item.q} variants={fadeUp} className="rounded-xl border border-line bg-surface overflow-hidden">
                <button
                  onClick={() => setOpenIdx(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="font-medium text-ink text-sm md:text-base">{item.q}</span>
                  <span className={`shrink-0 text-accent transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`}>+</span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <p className="px-6 pb-5 text-ink-muted text-sm leading-relaxed">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
