import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Globe2, FolderOpen, LayoutTemplate, Stethoscope, PlaneTakeoff, BarChart3 } from 'lucide-react';
import { platformHeading, platformModules } from '../../data/landingContent';
import { fadeUp, stagger, sectionHeading } from './variants';

const ICONS = [Globe2, FolderOpen, LayoutTemplate, Stethoscope, PlaneTakeoff, BarChart3];

export default function PlatformSection() {
  const { i18n } = useTranslation();
  const modules = platformModules(i18n.language);

  return (
    <section id="platform" aria-labelledby="platform-heading" className="relative py-24 bg-surface-page">
      <div className="mx-auto max-w-6xl px-6">
        <motion.h2 id="platform-heading" initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} className={`${sectionHeading} mb-14 max-w-xl`}>
          {platformHeading(i18n.language)}
        </motion.h2>

        <motion.div initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} variants={stagger(0.1)} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((m, i) => {
            const Icon = ICONS[i];
            return (
              <motion.div key={m.title} variants={fadeUp} className="rounded-2xl bg-surface border border-line p-7 shadow-sm hover:border-accent/40 transition-colors flex flex-col gap-3">
                <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Icon size={22} strokeWidth={1.5} className="text-accent" aria-hidden="true" />
                </div>
                <h3 className="font-semibold text-ink text-base">{m.title}</h3>
                <p className="text-ink-muted text-sm leading-relaxed">{m.body}</p>
                <p className="text-ink-subtle text-xs mt-auto pt-3 border-t border-line">{m.example}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
