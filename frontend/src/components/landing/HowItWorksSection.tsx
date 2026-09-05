import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { MessageSquare, Sparkles, Stethoscope, FileCheck2, HeartPulse } from 'lucide-react';
import { howItWorksHeading, howItWorksSub, howItWorksSteps } from '../../data/landingContent';
import { fadeUp, stagger, sectionHeading, sectionSubheading, reveal } from './variants';

const ICONS = [MessageSquare, Sparkles, Stethoscope, FileCheck2, HeartPulse];

export default function HowItWorksSection() {
  const { i18n } = useTranslation();
  const steps = howItWorksSteps(i18n.language);

  return (
    <section id="nasil-calisir" aria-labelledby="how-it-works-heading" className="relative py-24 bg-surface">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div {...reveal()} variants={stagger()} className="max-w-2xl mb-14 mx-auto text-center">
          <motion.h2 id="how-it-works-heading" variants={fadeUp} className={sectionHeading}>{howItWorksHeading(i18n.language)}</motion.h2>
          <motion.p variants={fadeUp} className={`${sectionSubheading} mt-4 mx-auto`}>{howItWorksSub(i18n.language)}</motion.p>
        </motion.div>

        <motion.ol
          {...reveal()} variants={stagger(0.12)}
          className="relative grid md:grid-cols-5 gap-6 md:gap-4 list-none"
        >
          {/* Connector line — desktop only */}
          <div className="hidden md:block absolute top-7 left-[10%] right-[10%] h-px bg-line" aria-hidden="true" />

          {steps.map((step, i) => {
            const Icon = ICONS[i];
            return (
              <motion.li key={step.title} variants={fadeUp} className="relative flex flex-col items-center text-center gap-3">
                <div className="relative z-10 w-14 h-14 rounded-2xl bg-surface border border-line shadow-sm flex items-center justify-center">
                  <Icon size={24} strokeWidth={1.5} className="text-accent" aria-hidden="true" />
                  <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-accent text-white text-[11px] font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                </div>
                <h3 className="font-semibold text-ink text-sm">{step.title}</h3>
                <p className="text-ink-muted text-xs leading-relaxed">{step.body}</p>
              </motion.li>
            );
          })}
        </motion.ol>
      </div>
    </section>
  );
}
