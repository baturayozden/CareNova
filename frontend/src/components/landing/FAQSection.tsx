import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import { faqHeading, faqItems } from '../../data/landingContent';
import { fadeUp, stagger, sectionHeading } from './variants';

export default function FAQSection() {
  const { i18n } = useTranslation();
  const items = faqItems(i18n.language);
  const [openIdx, setOpenIdx] = React.useState<number | null>(0);

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(item => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  return (
    <section id="faq" aria-labelledby="faq-heading" className="relative py-24 bg-surface-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <div className="mx-auto max-w-3xl px-6">
        <motion.h2 id="faq-heading" initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} className={`${sectionHeading} text-center mb-12`}>
          {faqHeading(i18n.language)}
        </motion.h2>

        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }} variants={stagger(0.06)} className="space-y-3">
          {items.map((item, i) => {
            const isOpen = openIdx === i;
            const panelId = `faq-panel-${i}`;
            return (
              <motion.div key={item.q} variants={fadeUp} className="rounded-xl border border-line bg-surface overflow-hidden">
                <h3>
                  <button
                    onClick={() => setOpenIdx(isOpen ? null : i)}
                    className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                  >
                    <span className="font-medium text-ink text-sm md:text-base">{item.q}</span>
                    <Plus size={18} strokeWidth={2} className={`shrink-0 text-accent transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`} aria-hidden="true" />
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={panelId}
                      role="region"
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
