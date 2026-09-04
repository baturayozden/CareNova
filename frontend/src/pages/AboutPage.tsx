import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SEOMeta from '../components/SEOMeta';
import {
  motion, AnimatePresence, useScroll, useTransform,
  useSpring, useInView, useMotionValue, useReducedMotion,
} from 'framer-motion';
import { Zap, Globe, ShieldCheck, Play, ArrowRight, X, Clock, MessageCircle, TrendingUp } from 'lucide-react';
import NavBar from '../components/landing/NavBar';
import Footer from '../components/landing/Footer';

const INK = '#0f172a';
const BODY = '#475569';
const MUTED = '#94a3b8';
const BLUE = '#2563EB';
const GOLD = '#c9a84c'; // eslint-disable-line @typescript-eslint/no-unused-vars
const LINE = '#e2e8f0';
const CARD_BORDER = '#e6ebf2';
const ease = [0.16, 1, 0.3, 1] as const;
const serif = { fontFamily: "'Instrument Serif', serif" };

const VIDEO_ID = 'jGkVvlG4fQU';
const VIDEO_THUMB = `https://i.ytimg.com/vi/${VIDEO_ID}/maxresdefault.jpg`;

function HeroBg() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(15,23,42,0.035) 1px, transparent 1px), linear-gradient(90deg,rgba(15,23,42,0.035) 1px,transparent 1px)', backgroundSize: '64px 64px' }} />
      <motion.div animate={{ opacity: [0.5, 0.8, 0.5] }} transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute" style={{ top: '-10%', left: '50%', transform: 'translateX(-50%)', width: 900, height: 560, borderRadius: '50%', background: 'radial-gradient(ellipse 60% 60% at 50% 30%, rgba(37,99,235,0.10), transparent 70%)', filter: 'blur(20px)' }} />
      <motion.div animate={{ x: [0, 40, 0], y: [0, -20, 0] }} transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute" style={{ top: '0%', right: '8%', width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.10), transparent 65%)', filter: 'blur(30px)' }} />
    </div>
  );
}

function VideoLightbox({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: 'rgba(8,12,20,0.85)', backdropFilter: 'blur(10px)' }}>
          <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.4, ease }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-4xl aspect-video rounded-2xl overflow-hidden"
            style={{ boxShadow: '0 30px 120px rgba(0,0,0,0.4)' }}>
            <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${VIDEO_ID}?autoplay=1&rel=0`} title="CareNova" allow="autoplay; encrypted-media; fullscreen" allowFullScreen />
          </motion.div>
          <button onClick={onClose} aria-label="Close"
            className="absolute top-6 right-6 w-11 h-11 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff' }}>
            <X size={20} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TiltCard({ icon: Icon, title, body, i }: { icon: any; title: string; body: string; i: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const rx = useSpring(useMotionValue(0), { stiffness: 200, damping: 20 });
  const ry = useSpring(useMotionValue(0), { stiffness: 200, damping: 20 });
  const [hover, setHover] = useState(false);
  const onMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 12);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 12);
  };
  const reset = () => { rx.set(0); ry.set(0); setHover(false); };
  return (
    <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, ease, delay: i * 0.12 }}
      ref={ref} onMouseMove={onMove} onMouseEnter={() => setHover(true)} onMouseLeave={reset} style={{ perspective: 800 }}>
      <motion.div style={{
        rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d',
        background: '#ffffff', border: `1px solid ${hover ? 'rgba(37,99,235,0.35)' : CARD_BORDER}`,
        boxShadow: hover ? '0 24px 50px rgba(37,99,235,0.14)' : '0 8px 24px rgba(15,23,42,0.05)',
        transition: 'box-shadow 0.4s, border-color 0.4s',
      }} className="relative p-8 rounded-[20px] overflow-hidden h-full">
        <div className="relative" style={{ transform: 'translateZ(36px)' }}>
          <div className="flex items-center justify-center mb-5" style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, rgba(37,99,235,0.12), rgba(201,168,76,0.14))', border: '1px solid rgba(37,99,235,0.18)', color: BLUE }}>
            <Icon size={24} />
          </div>
          <h3 className="mb-2.5" style={{ ...serif, fontSize: 26, color: INK }}>{title}</h3>
          <p style={{ fontSize: 15, lineHeight: 1.65, color: BODY }}>{body}</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Stat({ to, suffix, label, icon: Icon }: { to: number; suffix: string; label: string; icon: any }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const dur = 1400, t0 = performance.now();
    const tick = (t: number) => { const p = Math.min((t - t0) / dur, 1); setN(Math.round((1 - Math.pow(1 - p, 3)) * to)); if (p < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }, [inView, to]);
  return (
    <div ref={ref} className="text-center flex-1 min-w-[120px]">
      <div className="flex justify-center mb-2" style={{ color: BLUE }}><Icon size={22} /></div>
      <div style={{ ...serif, fontSize: 46, color: INK, lineHeight: 1 }}>{n}{suffix}</div>
      <div className="mt-2" style={{ fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: MUTED }}>{label}</div>
    </div>
  );
}

function MagneticCTA({ children }: { children: React.ReactNode }) {
  return (
    <motion.span whileHover={{ scale: 1.04 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      style={{ background: BLUE, color: '#fff', boxShadow: '0 12px 40px rgba(37,99,235,0.45)' }}
      className="inline-flex items-center gap-2.5 px-9 py-[18px] rounded-full font-medium text-[17px] no-underline">
      {children} <ArrowRight size={18} />
    </motion.span>
  );
}

export default function AboutPage() {
  const reduced = useReducedMotion();
  const [videoOpen, setVideoOpen] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', reduced ? '0%' : '30%']);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0]);

  const heroLines = [
    { t: 'Every missed message', blue: false },
    { t: 'is a patient lost.', blue: false },
    { t: 'We changed that.', blue: true },
  ];

  return (
    <div style={{ background: '#ffffff', minHeight: '100vh' }}>
      <SEOMeta
        title="About CareNova — WhatsApp AI Built for Dental Clinics"
        description="Why we built a WhatsApp-native AI for dental practices, how it works, and the team behind it. UK-based, ICO-registered and GDPR compliant. Made in London."
        path="/about"
      />
      <NavBar />
      <VideoLightbox open={videoOpen} onClose={() => setVideoOpen(false)} />

      <section ref={heroRef} className="relative overflow-hidden flex items-center" style={{ minHeight: '90vh' }}>
        <HeroBg />
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative max-w-5xl mx-auto px-6 text-center w-full">
          <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8"
            style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)', color: BLUE, fontSize: 12, fontWeight: 600, letterSpacing: 1 }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: BLUE, display: 'inline-block' }} /> OUR STORY
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease, delay: 0.15 }}
            className="font-normal leading-[1.05] m-0"
            style={{ ...serif, fontSize: 'clamp(40px, 7vw, 82px)', color: INK }}
          >
            {heroLines.map((line, i) => (
              <span key={i} style={{
                display: 'block',
                color: line.blue ? 'transparent' : INK,
                background: line.blue ? 'linear-gradient(135deg,#2563EB,#60A5FA,#2563EB)' : 'none',
                WebkitBackgroundClip: line.blue ? 'text' : 'initial',
                backgroundClip: line.blue ? 'text' : 'initial',
                WebkitTextFillColor: line.blue ? 'transparent' : 'inherit',
              } as React.CSSProperties}>
                {line.t}
              </span>
            ))}
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease, delay: 0.7 }}
            className="max-w-xl mx-auto mt-8"
            style={{ color: BODY, fontSize: 19, lineHeight: 1.6 }}>
            The WhatsApp-native AI that answers every patient — instantly, in any language, at any hour — and turns conversations into booked chairs.
          </motion.p>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2" style={{ color: MUTED, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' }}>
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 1.6, repeat: Infinity }}>scroll ↓</motion.div>
        </motion.div>
      </section>

      <section className="relative max-w-5xl mx-auto px-6 pt-10 pb-28">
        <motion.div initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.7, ease }}
          whileHover={{ scale: 1.01 }} onClick={() => setVideoOpen(true)}
          className="relative rounded-3xl overflow-hidden cursor-pointer"
          style={{ border: `1px solid ${LINE}`, boxShadow: '0 30px 70px rgba(15,23,42,0.12)' }}>
          <div className="aspect-video relative">
            <img src={VIDEO_THUMB} alt="CareNova" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = `https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`; }} />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(8,12,20,0.75), rgba(8,12,20,0.05))' }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div whileHover={{ scale: 1.12 }} transition={{ type: 'spring', stiffness: 300 }}
                className="relative flex items-center justify-center" style={{ width: 84, height: 84, borderRadius: 999, background: BLUE, boxShadow: '0 8px 50px rgba(37,99,235,0.6)' }}>
                <motion.span animate={{ scale: [1, 1.5], opacity: [0.5, 0] }} transition={{ duration: 1.8, repeat: Infinity }} className="absolute rounded-full" style={{ width: 84, height: 84, border: '2px solid rgba(37,99,235,0.6)' }} />
                <Play size={32} fill="#fff" color="#fff" style={{ marginLeft: 4 }} />
              </motion.div>
            </div>
            <div className="absolute bottom-7 left-7">
              <p className="m-0" style={{ ...serif, color: '#fff', fontSize: 26 }}>See it in action</p>
              <p className="mt-0.5" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>2-minute introduction</p>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, ease }}
          className="flex gap-6 mt-10 px-6 py-8 rounded-[20px] flex-wrap"
          style={{ background: '#ffffff', border: `1px solid ${CARD_BORDER}`, boxShadow: '0 8px 30px rgba(15,23,42,0.05)' }}>
          <Stat to={2} suffix="s" label="Reply time" icon={Clock} />
          <div style={{ width: 1, background: LINE }} />
          <Stat to={40} suffix="+" label="Languages" icon={Globe} />
          <div style={{ width: 1, background: LINE }} />
          <Stat to={68} suffix="%" label="Lead recovery" icon={TrendingUp} />
          <div style={{ width: 1, background: LINE }} />
          <Stat to={24} suffix="/7" label="Always on" icon={MessageCircle} />
        </motion.div>
      </section>

      <section className="relative max-w-3xl mx-auto px-6 pb-28">
        <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, ease }}
          className="mb-5" style={{ fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', color: BLUE, fontWeight: 600 }}>Why we built this</motion.div>
        {[
          { t: 'We came from dental marketing. We ran the ads, filled the pipelines — and watched a third of those hard-won leads quietly vanish.', big: true },
          { t: "Not because clinics didn't care. Because an enquiry at 9pm waits until morning, and by morning the patient has booked elsewhere. The demand was never the problem. The silence was.", big: false },
          { t: 'No front desk can reply in seconds, in Arabic and Turkish and English, at 2am on a Sunday. But an AI can. So we built one — and gave every clinic a coordinator that never sleeps, never forgets, and never lets a patient slip away.', big: false },
        ].map((p, i) => (
          <motion.p key={i} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, ease, delay: i * 0.1 }}
            className="mb-6"
            style={p.big ? { ...serif, color: INK, fontSize: 27, lineHeight: 1.35 } : { color: BODY, fontSize: 18, lineHeight: 1.65 }}>
            {p.t}
          </motion.p>
        ))}
      </section>

      <section className="relative max-w-6xl mx-auto px-6 pb-28">
        <motion.h2 initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, ease }}
          className="leading-tight mb-3 text-center" style={{ ...serif, fontSize: 'clamp(34px,5vw,54px)', color: INK }}>
          What we stand for
        </motion.h2>
        <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
          className="text-center mb-14" style={{ color: MUTED, fontSize: 16 }}>Three beliefs behind every line of code.</motion.p>
        <div className="grid md:grid-cols-3 gap-6">
          <TiltCard i={0} icon={Zap} title="Speed is care" body="A patient answered in seconds feels looked after. Every reply under two seconds — day, night, weekend — is a patient who stays yours instead of your competitor's." />
          <TiltCard i={1} icon={Globe} title="Every language" body="Your city is global; your patients are too. Our AI speaks English, Turkish, Arabic and beyond — fluently and naturally, never through clumsy translation." />
          <TiltCard i={2} icon={ShieldCheck} title="Clinics in control" body="The AI captures, answers and books. Your team confirms and decides. Patient data stays encrypted, GDPR-aligned, and always yours — never sold, never shared." />
        </div>
      </section>

      <section className="relative max-w-5xl mx-auto px-6 pb-32">
        <motion.div initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, ease }}
          className="relative rounded-[28px] text-center overflow-hidden"
          style={{ padding: 'clamp(56px,9vw,80px) 32px', background: 'linear-gradient(135deg,#0d1626,#0a1120)' }}>
          <motion.div animate={{ opacity: [0.4, 0.7, 0.4] }} transition={{ duration: 6, repeat: Infinity }}
            className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 100% at 50% 120%, rgba(37,99,235,0.4), transparent 70%)' }} />
          <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg,rgba(255,255,255,0.04) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
          <div className="relative flex flex-col items-center gap-6">
            <h2 className="leading-tight m-0 max-w-2xl" style={{ ...serif, fontSize: 'clamp(34px,5vw,56px)', color: '#ffffff' }}>
              Ready to recover the patients you're losing?
            </h2>
            <p className="m-0 max-w-lg" style={{ color: 'rgba(255,255,255,0.78)', fontSize: 18, lineHeight: 1.6 }}>
              Book a demo and watch CareNova turn missed messages into booked appointments — live, on your own numbers.
            </p>
            <div className="mt-3">
              <Link to="/#cta" style={{ textDecoration: 'none' }}>
                <MagneticCTA>Book a Demo</MagneticCTA>
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
}
