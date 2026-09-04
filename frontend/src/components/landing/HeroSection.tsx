import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  heroBadge, heroHeadline, heroSub, heroCtaPrimary, heroCtaSecondary, heroTrust, heroStats,
  heroConversations, heroCycleOrder, heroLangLabel,
} from '../../data/landingContent';
import { stagger, scaleIn, fadeUp, ease } from './variants';

// ─── WhatsApp Mock — cycles TR → EN → AR → DE → RU ───────────────────────────

function WhatsAppMock() {
  const [langIdx, setLangIdx] = useState(0);
  const [visibleCount, setVisibleCount] = useState(0);
  const [showTyping, setShowTyping] = useState(false);

  const lang = heroCycleOrder[langIdx];
  const conv = heroConversations[lang];
  const isRTL = lang === 'ar';

  useEffect(() => {
    if (visibleCount >= conv.length) {
      const t = setTimeout(() => {
        setVisibleCount(0);
        setLangIdx(i => (i + 1) % heroCycleOrder.length);
      }, 3200);
      return () => clearTimeout(t);
    }
    const next = conv[visibleCount];
    if (next.side === 'out') {
      setShowTyping(true);
      const t1 = setTimeout(() => { setShowTyping(false); setVisibleCount(c => c + 1); }, 1000);
      return () => clearTimeout(t1);
    }
    const t2 = setTimeout(() => setVisibleCount(c => c + 1), 900);
    return () => clearTimeout(t2);
  }, [visibleCount, langIdx, conv]);

  return (
    <div
      className="relative bg-surface-raised border border-brand-900/15 rounded-3xl overflow-hidden shadow-2xl"
      style={{ boxShadow: '0 0 80px rgba(217,154,43,0.14), 0 0 160px rgba(14,79,82,0.10)' }}
    >
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <span className="text-[11px] text-ink-muted font-medium">9:41</span>
        <div className="flex gap-1 items-center">
          <div className="w-5 h-1.5 rounded-full bg-ink/20" />
          <div className="w-1.5 h-1.5 rounded-full bg-ink/20" />
          <div className="w-3 h-1.5 rounded-full bg-ink/20" />
        </div>
      </div>

      <div className="flex items-center gap-3 px-4 py-3 bg-brand-900/40 border-b border-brand-900/10">
        <div className="w-9 h-9 rounded-full bg-accent-500/20 flex items-center justify-center shrink-0 text-lg">
          🏥
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ink truncate">Nova Hair Clinic</p>
          <p className="text-[11px] text-green-500">● online</p>
        </div>
        <AnimatePresence mode="wait">
          <motion.span
            key={lang}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className="text-[11px] bg-accent-500/10 border border-accent-500/25 text-accent-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
          >
            {heroLangLabel[lang]}
          </motion.span>
        </AnimatePresence>
      </div>

      <div
        className="px-4 py-4 min-h-[300px] bg-surface flex flex-col justify-end gap-2"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <AnimatePresence initial={false}>
          {conv.slice(0, visibleCount).map((msg, i) => (
            <motion.div
              key={`${lang}-${i}`}
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.35, ease }}
              className={`flex ${msg.side === 'out' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className="max-w-[85%] px-3.5 py-2.5 text-[13px] leading-snug shadow-sm"
                style={{
                  backgroundColor: msg.side === 'out' ? '#0E4F52' : 'rgba(14,79,82,0.08)',
                  color: msg.side === 'out' ? '#ffffff' : '#12211F',
                  borderRadius: msg.side === 'out' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {msg.text}
              </div>
            </motion.div>
          ))}

          {showTyping && (
            <motion.div key="typing" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex justify-end">
              <div className="bg-brand-500/10 border border-brand-500/20 rounded-full px-3.5 py-2.5 flex gap-1 items-center">
                {[0, 0.15, 0.3].map((d, i) => (
                  <motion.span
                    key={i}
                    animate={{ y: [0, -4, 0] }}
                    transition={{ delay: d, duration: 0.5, repeat: Infinity, repeatDelay: 0.5 }}
                    className="w-1.5 h-1.5 rounded-full bg-brand-500 inline-block"
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2 px-4 py-3 bg-surface-raised border-t border-brand-900/10">
        <div className="flex-1 bg-brand-900/5 rounded-full px-4 py-2 text-xs text-ink-muted">AI yanıt veriyor…</div>
        <div className="w-8 h-8 rounded-full bg-[#25d366] flex items-center justify-center shrink-0 text-white text-sm">➤</div>
      </div>
    </div>
  );
}

function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-xl font-bold text-accent-700 font-display">{value}</span>
      <span className="text-[10px] text-ink-muted uppercase tracking-wider">{label}</span>
    </div>
  );
}

export default function HeroSection() {
  const { i18n } = useTranslation();
  const reduced = useReducedMotion();

  return (
    <section id="hero" className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-surface pt-24 pb-16">
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(14,79,82,0.05) 1px, transparent 1px), linear-gradient(90deg,rgba(14,79,82,0.05) 1px,transparent 1px)',
        backgroundSize: '60px 60px',
      }} />
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.6 }}
        className="absolute -top-24 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 10%, rgba(217,154,43,0.16) 0%, transparent 70%)' }}
      />

      <div className="relative max-w-7xl mx-auto px-6 w-full">
        <div className="flex flex-col lg:flex-row items-center gap-14">
          <div className="flex-1 text-center lg:text-left">
            <motion.div variants={stagger(0.11, 0.12)} initial="hidden" animate="show" className="flex flex-col items-center lg:items-start gap-6">
              <motion.div variants={scaleIn}>
                <span className="inline-flex items-center gap-2 bg-accent-500/10 border border-accent-500/25 text-accent-700 text-xs font-medium px-4 py-2 rounded-full">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-500 opacity-60" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-500" />
                  </span>
                  {heroBadge(i18n.language)}
                </span>
              </motion.div>

              <motion.h1 variants={fadeUp} className="font-display text-4xl md:text-5xl lg:text-6xl font-normal text-ink leading-[1.12] max-w-2xl">
                {heroHeadline(i18n.language)}
              </motion.h1>

              <motion.p variants={fadeUp} className="text-ink-muted text-lg md:text-xl max-w-xl leading-relaxed">
                {heroSub(i18n.language)}
              </motion.p>

              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <a href="#cta" className="rounded-2xl bg-brand-500 hover:bg-brand-700 transition-colors px-9 py-4 text-lg font-semibold text-white text-center">
                  {heroCtaPrimary(i18n.language)}
                </a>
                <a href="#platform" className="rounded-2xl border border-brand-900/15 hover:bg-brand-900/5 transition-colors px-9 py-4 text-lg font-medium text-ink text-center">
                  {heroCtaSecondary(i18n.language)}
                </a>
              </motion.div>

              <motion.p variants={fadeUp} className="text-ink-muted/70 text-sm">
                {heroTrust(i18n.language)}
              </motion.p>

              <motion.div variants={fadeUp} className="flex items-center gap-6 pt-3 border-t border-brand-900/10 w-full">
                {heroStats(i18n.language).map((s, i) => (
                  <React.Fragment key={s.label}>
                    {i > 0 && <div className="h-8 w-px bg-brand-900/10" />}
                    <StatPill value={s.value} label={s.label} />
                  </React.Fragment>
                ))}
              </motion.div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 48, scale: 0.94 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.3, ease }}
            className="flex-1 w-full max-w-[380px] lg:max-w-none"
          >
            <motion.div animate={reduced ? {} : { y: [0, -10, 0] }} transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}>
              <WhatsAppMock />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
