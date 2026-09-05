import React, { useState, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ctaHeading, ctaSub, ctaFormLabels } from '../../data/landingContent';
import { fadeUp, stagger, ease } from './variants';

const BRANCHES = ['Saç Ekimi', 'Diş', 'Estetik Cerrahi', 'Göz', 'Diğer'];

export default function CTASection() {
  const { i18n } = useTranslation();
  const labels = ctaFormLabels(i18n.language);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Demo-mode form: no backend deployed tonight, so this only simulates a
  // submit (matches REACT_APP_DEMO_MODE across the rest of the app).
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => { setSubmitting(false); setSubmitted(true); }, 700);
  };

  return (
    <section id="cta" className="relative py-24 bg-surface">
      <div className="mx-auto max-w-2xl px-6">
        <motion.div
          initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }} variants={stagger()}
          className="rounded-3xl bg-slate-900 text-white p-10 md:p-14 text-center overflow-hidden relative"
        >
          <div className="absolute inset-0 pointer-events-none opacity-50" style={{
            background: 'radial-gradient(ellipse 60% 60% at 50% 0%, rgba(27,111,234,0.18), transparent 70%)',
          }} />
          <div className="relative">
            <motion.h2 variants={fadeUp} className="font-display text-3xl md:text-4xl mb-3">{ctaHeading(i18n.language)}</motion.h2>
            <motion.p variants={fadeUp} className="text-white/60 mb-10">{ctaSub(i18n.language)}</motion.p>

            {submitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, ease }}
                className="rounded-2xl bg-white/5 border border-accent/30 py-10 px-6"
              >
                <div className="text-4xl mb-3">✅</div>
                <p className="text-white font-medium">{labels.success}</p>
              </motion.div>
            ) : (
              <motion.form variants={fadeUp} onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-3 text-left">
                <input required placeholder={labels.name} className="rounded-xl bg-white/10 border border-white/15 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-accent-hover" />
                <input required type="email" placeholder={labels.email} className="rounded-xl bg-white/10 border border-white/15 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-accent-hover" />
                <input required placeholder={labels.clinic} className="rounded-xl bg-white/10 border border-white/15 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-accent-hover" />
                <input required placeholder={labels.city} className="rounded-xl bg-white/10 border border-white/15 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-accent-hover" />
                <select required defaultValue="" className="rounded-xl bg-white/10 border border-white/15 px-4 py-3 text-sm text-white focus:outline-none focus:border-accent-hover">
                  <option value="" disabled className="text-white">{labels.branch}</option>
                  {BRANCHES.map(b => <option key={b} value={b} className="text-white">{b}</option>)}
                </select>
                <input placeholder={labels.phone} className="rounded-xl bg-white/10 border border-white/15 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-accent-hover" />
                <button
                  type="submit"
                  disabled={submitting}
                  className="sm:col-span-2 mt-2 rounded-xl bg-accent hover:bg-accent-hover transition-colors py-3.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {submitting ? '…' : labels.submit}
                </button>
              </motion.form>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
