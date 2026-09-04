import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import SEOMeta from '../components/SEOMeta';
import { BUSINESS } from '../lib/businessDetails';
import { motion } from 'framer-motion';
import { Mail, MessageCircle, MapPin, ArrowRight } from 'lucide-react';
import NavBar from '../components/landing/NavBar';
import Footer from '../components/landing/Footer';

const INK = '#0f172a';
const BODY = '#475569';
const BLUE = '#2563EB';
const CARD_BORDER = '#e6ebf2';
const ease = [0.16, 1, 0.3, 1] as const;
const serif = { fontFamily: "'Instrument Serif', serif" };

function MethodCard({ icon: Icon, title, body, action, href, i }: { icon: any; title: string; body: string; action: string; href: string; i: number }) {
  const [hover, setHover] = useState(false);
  const isExternal = href.startsWith('mailto:') || href.startsWith('http');
  const inner = (
    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, ease, delay: i * 0.1 }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} whileHover={{ y: -6 }}
      className="relative p-8 rounded-[20px] h-full"
      style={{ background: '#ffffff', border: `1px solid ${hover ? 'rgba(37,99,235,0.35)' : CARD_BORDER}`, boxShadow: hover ? '0 24px 50px rgba(37,99,235,0.12)' : '0 8px 24px rgba(15,23,42,0.05)', transition: 'box-shadow .4s, border-color .4s' }}>
      <div className="flex items-center justify-center mb-5" style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, rgba(37,99,235,0.12), rgba(201,168,76,0.14))', border: '1px solid rgba(37,99,235,0.18)', color: BLUE }}>
        <Icon size={24} />
      </div>
      <h3 className="mb-2" style={{ ...serif, fontSize: 24, color: INK }}>{title}</h3>
      <p className="mb-4" style={{ fontSize: 15, lineHeight: 1.6, color: BODY }}>{body}</p>
      <span className="inline-flex items-center gap-1.5" style={{ color: BLUE, fontSize: 15, fontWeight: 500 }}>{action} <ArrowRight size={16} /></span>
    </motion.div>
  );
  return isExternal
    ? <a href={href} style={{ textDecoration: 'none' }}>{inner}</a>
    : <Link to={href} style={{ textDecoration: 'none' }}>{inner}</Link>;
}

export default function ContactPage() {
  // The registration line only appears once both numbers are real. Until then
  // the name and address stand alone — see src/lib/businessDetails.ts.
  const registrations = [
    BUSINESS.taxOrCompanyNumber && `Vergi/Ticaret Sicil No: ${BUSINESS.taxOrCompanyNumber}`,
    BUSINESS.kvkkVerbisNumber && `VERBİS: ${BUSINESS.kvkkVerbisNumber}`,
  ].filter(Boolean).join(' · ');

  const officeBody = BUSINESS.legalName
    ? `CareNova is a product of ${BUSINESS.legalName}. ${BUSINESS.addressLine}.${
        registrations ? ` ${registrations}` : ''
      }`
    : '';

  return (
    <div style={{ background: '#ffffff', minHeight: '100vh' }}>
      <SEOMeta
        title="Contact CareNova — Book a Demo or Talk to Our UK Team"
        description="See CareNova answer and book a patient live on a real WhatsApp number. 20 minutes, no slides. Or email hello@carenova.ai for a same-working-day reply."
        path="/contact"
      />
      <NavBar />
      <section className="relative overflow-hidden pt-40 pb-20">
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(15,23,42,0.035) 1px, transparent 1px), linear-gradient(90deg,rgba(15,23,42,0.035) 1px,transparent 1px)', backgroundSize: '64px 64px' }} />
        <div className="absolute pointer-events-none" style={{ top: '-10%', left: '50%', transform: 'translateX(-50%)', width: 800, height: 480, borderRadius: '50%', background: 'radial-gradient(ellipse 60% 60% at 50% 30%, rgba(37,99,235,0.10), transparent 70%)', filter: 'blur(20px)' }} />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-7" style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)', color: BLUE, fontSize: 12, fontWeight: 600, letterSpacing: 1 }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: BLUE, display: 'inline-block' }} /> GET IN TOUCH
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease, delay: 0.1 }}
            className="m-0 font-normal leading-[1.05]" style={{ ...serif, fontSize: 'clamp(40px,6vw,72px)', color: INK }}>
            Let's talk about your clinic.
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease, delay: 0.25 }}
            className="max-w-xl mx-auto mt-6" style={{ color: BODY, fontSize: 19, lineHeight: 1.6 }}>
            Whether you want a live demo, have a question, or just want to see how it works on your own numbers — we'd love to hear from you.
          </motion.p>
        </div>
      </section>

      <section className="relative max-w-5xl mx-auto px-6 pb-20">
        <div className="grid md:grid-cols-3 gap-6">
          <MethodCard i={0} icon={MessageCircle} title="Book a demo" body="See CareNova answer and book a patient live, on a real WhatsApp number. 20 minutes, no slides." action="Book a demo" href="/#cta" />
          <MethodCard i={1} icon={Mail} title="Email us" body="Questions about pricing, languages, onboarding or data protection? Send us a note and we'll reply the same working day." action="hello@carenova.ai" href="mailto:hello@carenova.ai" />
          <MethodCard i={2} icon={MapPin} title="Our office" body={officeBody || 'Türkiye ofis bilgilerimiz yakında burada olacak.'} action="hello@carenova.ai" href="mailto:hello@carenova.ai" />
        </div>
      </section>

      <section className="relative max-w-5xl mx-auto px-6 pb-32">
        <motion.div initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, ease }}
          className="relative rounded-[28px] text-center overflow-hidden" style={{ padding: 'clamp(48px,8vw,72px) 32px', background: 'linear-gradient(135deg,#0d1626,#0a1120)' }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 100% at 50% 120%, rgba(37,99,235,0.4), transparent 70%)' }} />
          <div className="relative flex flex-col items-center gap-5">
            <h2 className="m-0 max-w-xl leading-tight" style={{ ...serif, fontSize: 'clamp(32px,5vw,52px)', color: '#fff' }}>Ready to see it in action?</h2>
            <p className="m-0 max-w-md" style={{ color: 'rgba(255,255,255,0.78)', fontSize: 17 }}>Book a demo and we'll show you exactly how CareNova fits your clinic.</p>
            <Link to="/#cta" className="inline-flex items-center gap-2 px-9 py-[18px] rounded-full font-medium text-[17px] mt-2" style={{ background: BLUE, color: '#fff', textDecoration: 'none', boxShadow: '0 12px 40px rgba(37,99,235,0.45)' }}>
              Book a Demo <ArrowRight size={18} />
            </Link>
          </div>
        </motion.div>
      </section>
      <Footer />
    </div>
  );
}
