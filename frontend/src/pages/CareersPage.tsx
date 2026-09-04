import React from 'react';
import { motion } from 'framer-motion';
import SEOMeta from '../components/SEOMeta';
import { Rocket, Heart, Globe, Mail } from 'lucide-react';
import NavBar from '../components/landing/NavBar';
import Footer from '../components/landing/Footer';

const INK = '#0f172a';
const BODY = '#475569';
const BLUE = '#2563EB';
const CARD_BORDER = '#e6ebf2';
const ease = [0.16, 1, 0.3, 1] as const;
const serif = { fontFamily: "'Instrument Serif', serif" };

const VALUES = [
  { icon: Rocket, t: 'Move fast, ship real', d: 'Small team, real users, production-first. What you build this week, clinics use next week.' },
  { icon: Globe, t: 'Built for the world', d: 'Multilingual from day one. We build for patients and clinics across the UK and beyond.' },
  { icon: Heart, t: 'Care, literally', d: 'Every feature helps a real patient reach real care faster. The mission is the product.' },
];

export default function CareersPage() {
  return (
    <div style={{ background: '#ffffff', minHeight: '100vh' }}>
      <SEOMeta
        title="Careers at CareNova — Build AI for Health Tourism Clinics"
        description="Help us give every dental clinic a treatment coordinator that never sleeps. Open roles at CareNova, a UK-based WhatsApp AI company based in London."
        path="/careers"
      />
      <NavBar />
      <section className="relative overflow-hidden pt-40 pb-20">
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(15,23,42,0.035) 1px, transparent 1px), linear-gradient(90deg,rgba(15,23,42,0.035) 1px,transparent 1px)', backgroundSize: '64px 64px' }} />
        <div className="absolute pointer-events-none" style={{ top: '-10%', left: '50%', transform: 'translateX(-50%)', width: 800, height: 480, borderRadius: '50%', background: 'radial-gradient(ellipse 60% 60% at 50% 30%, rgba(37,99,235,0.10), transparent 70%)', filter: 'blur(20px)' }} />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-7" style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)', color: BLUE, fontSize: 12, fontWeight: 600, letterSpacing: 1 }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: BLUE, display: 'inline-block' }} /> CAREERS
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease, delay: 0.1 }}
            className="m-0 font-normal leading-[1.05]" style={{ ...serif, fontSize: 'clamp(40px,6vw,72px)', color: INK }}>
            Help us give every clinic a coordinator that never sleeps.
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease, delay: 0.25 }}
            className="max-w-xl mx-auto mt-6" style={{ color: BODY, fontSize: 19, lineHeight: 1.6 }}>
            We're a small, ambitious team building AI that helps health tourism clinics never miss a patient again.
          </motion.p>
        </div>
      </section>

      <section className="relative max-w-5xl mx-auto px-6 pb-20">
        <div className="grid md:grid-cols-3 gap-6">
          {VALUES.map((x, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, ease, delay: i * 0.1 }}
              whileHover={{ y: -6 }} className="p-8 rounded-[20px] h-full"
              style={{ background: '#ffffff', border: `1px solid ${CARD_BORDER}`, boxShadow: '0 8px 24px rgba(15,23,42,0.05)' }}>
              <div className="flex items-center justify-center mb-5" style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, rgba(37,99,235,0.12), rgba(201,168,76,0.14))', border: '1px solid rgba(37,99,235,0.18)', color: BLUE }}>
                <x.icon size={24} />
              </div>
              <h3 className="mb-2" style={{ ...serif, fontSize: 24, color: INK }}>{x.t}</h3>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: BODY }}>{x.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="relative max-w-3xl mx-auto px-6 pb-32">
        <motion.div initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, ease }}
          className="relative rounded-[28px] text-center overflow-hidden" style={{ padding: 'clamp(48px,8vw,72px) 32px', background: 'linear-gradient(135deg,#0d1626,#0a1120)' }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 100% at 50% 120%, rgba(37,99,235,0.4), transparent 70%)' }} />
          <div className="relative flex flex-col items-center gap-5">
            <h2 className="m-0 max-w-xl leading-tight" style={{ ...serif, fontSize: 'clamp(30px,5vw,48px)', color: '#fff' }}>No open roles right now — but we're always listening.</h2>
            <p className="m-0 max-w-md" style={{ color: 'rgba(255,255,255,0.78)', fontSize: 17 }}>If you're exceptional at what you do and this mission resonates, tell us why. We make room for the right people.</p>
            <a href="mailto:careers@carenova.ai" className="inline-flex items-center gap-2 px-9 py-[18px] rounded-full font-medium text-[17px] mt-2" style={{ background: BLUE, color: '#fff', textDecoration: 'none', boxShadow: '0 12px 40px rgba(37,99,235,0.45)' }}>
              <Mail size={18} /> careers@carenova.ai
            </a>
          </div>
        </motion.div>
      </section>
      <Footer />
    </div>
  );
}
