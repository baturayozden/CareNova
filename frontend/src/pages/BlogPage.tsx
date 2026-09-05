import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import SEOMeta from '../components/SEOMeta';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Clock, Calendar, PenLine } from 'lucide-react';
import NavBar from '../components/landing/NavBar';
import Footer from '../components/landing/Footer';
import ScrollToTopButton from '../components/ScrollToTopButton';
import { formatDate } from '../utils/date';

// ── Constants ─────────────────────────────────────────────────────────────────

const API         = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const INK         = '#0f172a';
const BODY        = '#475569';
const MUTED       = '#94a3b8';
const BLUE        = '#1B6FEA';
const GOLD        = '#c9a84c';
const CARD_BORDER = '#e6ebf2';
const ease        = [0.16, 1, 0.3, 1] as const;
const serif       = { fontFamily: "'Instrument Serif', serif" };

const CAT_COLORS: Record<string, string> = {
  'Lead Recovery':         '#1B6FEA',
  'Automation':            '#7c3aed',
  'Buyer Guides':          '#c9a84c',
  'Conversion':            '#0891b2',
  'Practice Growth':       '#059669',
  'Patient Communication': '#db2777',
};
function catColor(c: string | null): string {
  return (c && CAT_COLORS[c]) || '#475569';
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  meta_description: string | null;
  category: string | null;
  image_url: string | null;
  image_alt: string | null;
  published_at: string;
  reading_time_minutes: number | null;
}


// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="animate-pulse" style={{ background: '#f8fafc', border: `1px solid ${CARD_BORDER}`, borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ height: 200, background: '#e2e8f0' }} />
      <div style={{ padding: 22 }}>
        <div style={{ height: 10, width: '30%', background: '#e2e8f0', borderRadius: 6, marginBottom: 14 }} />
        <div style={{ height: 20, background: '#e2e8f0', borderRadius: 6, marginBottom: 8 }} />
        <div style={{ height: 20, width: '75%', background: '#e2e8f0', borderRadius: 6, marginBottom: 16 }} />
        <div style={{ height: 12, width: '48%', background: '#e2e8f0', borderRadius: 6 }} />
      </div>
    </div>
  );
}

// ── Category badge ────────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null;
  const c = catColor(category);
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 999,
      fontSize: 11, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase',
      background: `${c}1a`, border: `1px solid ${c}40`, color: c,
    } as React.CSSProperties}>
      {category}
    </span>
  );
}

// ── Post meta ─────────────────────────────────────────────────────────────────

function PostMeta({ post }: { post: BlogPost }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      {post.reading_time_minutes != null && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: MUTED }}>
          <Clock size={12} /> {post.reading_time_minutes} min read
        </span>
      )}
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: MUTED }}>
        <Calendar size={12} /> {formatDate(post.published_at)}
      </span>
    </div>
  );
}

// ── Featured card (large horizontal) ─────────────────────────────────────────

function FeaturedCard({ post }: { post: BlogPost }) {
  const reduced = useReducedMotion();
  const [hover, setHover] = useState(false);
  const cc = catColor(post.category);

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: reduced ? 0 : 0.65, ease }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        border: `1px solid ${hover ? `${cc}55` : CARD_BORDER}`,
        borderRadius: 24, overflow: 'hidden', background: '#fff',
        boxShadow: hover ? '0 24px 60px rgba(15,23,42,0.10)' : '0 4px 24px rgba(15,23,42,0.04)',
        transition: 'box-shadow .35s, border-color .35s',
      }}
    >
      <Link to={`/blog/${post.slug}`} style={{ textDecoration: 'none' }} className="flex flex-col md:flex-row">
        {/* Image */}
        <div className="w-full md:w-5/12 shrink-0 overflow-hidden relative" style={{ minHeight: 260 }}>
          {post.image_url ? (
            <img
              src={post.image_url}
              alt={post.image_alt || post.title}
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                objectFit: 'cover', display: 'block',
                transition: 'transform .5s',
                transform: hover ? 'scale(1.04)' : 'scale(1)',
              }}
            />
          ) : (
            <div style={{
              position: 'absolute', inset: 0,
              background: `linear-gradient(135deg, ${cc}18, ${cc}30)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ ...serif, fontSize: 96, color: `${cc}55`, fontWeight: 400, lineHeight: 1 }}>
                {post.title.charAt(0)}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: 'clamp(28px,5vw,44px)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16, flex: 1 } as React.CSSProperties}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <CategoryBadge category={post.category} />
            <span style={{ fontSize: 11, color: MUTED, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600 }}>
              Featured
            </span>
          </div>
          <h2 style={{ ...serif, fontSize: 'clamp(22px,3.5vw,34px)', color: INK, margin: 0, lineHeight: 1.2, fontWeight: 400 }}>
            {post.title}
          </h2>
          {post.excerpt && (
            <p style={{
              fontSize: 16, lineHeight: 1.7, color: BODY, margin: 0,
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            } as React.CSSProperties}>
              {post.excerpt}
            </p>
          )}
          <PostMeta post={post} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: BLUE, fontWeight: 600, marginTop: 4 }}>
            Read article <ArrowRight size={15} />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

// ── Grid card ─────────────────────────────────────────────────────────────────

const itemVariants = {
  hidden: { opacity: 0, y: 26 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } },
};

function PostCard({ post }: { post: BlogPost }) {
  const reduced = useReducedMotion();
  const [hover, setHover] = useState(false);
  const cc = catColor(post.category);

  return (
    <motion.div
      variants={itemVariants}
      transition={reduced ? { duration: 0 } : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: '#fff',
        border: `1px solid ${hover ? `${cc}40` : CARD_BORDER}`,
        borderRadius: 20,
        boxShadow: hover ? '0 20px 50px rgba(15,23,42,0.09)' : '0 2px 12px rgba(15,23,42,0.04)',
        transition: 'box-shadow .35s, border-color .35s',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      } as React.CSSProperties}
    >
      <Link to={`/blog/${post.slug}`} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', height: '100%' } as React.CSSProperties}>
        {/* Image */}
        <div style={{ height: 200, overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
          {post.image_url ? (
            <img
              src={post.image_url}
              alt={post.image_alt || post.title}
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                transition: 'transform .45s',
                transform: hover ? 'scale(1.05)' : 'scale(1)',
              }}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              background: `linear-gradient(135deg, ${cc}15, ${cc}28)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ ...serif, fontSize: 60, color: `${cc}50`, fontWeight: 400 }}>
                {post.title.charAt(0)}
              </span>
            </div>
          )}
          {post.category && (
            <div style={{ position: 'absolute', top: 13, left: 13 }}>
              <CategoryBadge category={post.category} />
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '20px 20px 16px', display: 'flex', flexDirection: 'column', gap: 9, flex: 1 } as React.CSSProperties}>
          <h3 style={{
            ...serif, fontSize: 19, color: INK, margin: 0, lineHeight: 1.25,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          } as React.CSSProperties}>
            {post.title}
          </h3>
          {post.excerpt && (
            <p style={{
              fontSize: 13, lineHeight: 1.65, color: BODY, margin: 0,
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            } as React.CSSProperties}>
              {post.excerpt}
            </p>
          )}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginTop: 'auto', paddingTop: 12, borderTop: `1px solid ${CARD_BORDER}`,
          }}>
            <PostMeta post={post} />
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: BLUE, fontWeight: 500, flexShrink: 0, marginLeft: 8 }}>
              Read <ArrowRight size={13} />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

const containerVariants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.07 } },
};

// ── Main ──────────────────────────────────────────────────────────────────────

export default function BlogPage() {
  const reduced = useReducedMotion();
  const [posts, setPosts]           = useState<BlogPost[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/api/blog?page=1&limit=50`)
      .then(r => r.json())
      .then(d  => { if (!cancelled) setPosts(d.posts || []); })
      .catch(() => { if (!cancelled) setError('Could not load articles. Please try again shortly.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const categories = useMemo(() => {
    const seen = new Set<string>();
    return posts
      .map(p => p.category)
      .filter((c): c is string => !!c && !seen.has(c) && !!seen.add(c));
  }, [posts]);

  const filtered = useMemo(
    () => selectedCat ? posts.filter(p => p.category === selectedCat) : posts,
    [posts, selectedCat],
  );

  const featured  = filtered[0] ?? null;
  const gridPosts = filtered.slice(1);
  const heroLines = ['Insights for modern', 'dental practices.'];

  return (
    <div style={{ background: '#ffffff', minHeight: '100vh' }}>
      <SEOMeta
        title="Dental Practice Growth Blog — Lead Recovery & Patient Comms"
        description="Practical writing on dental lead recovery, patient communication and practice growth — for UK clinic owners and managers who want results, not theory."
        path="/blog"
      />
      <NavBar />

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-40 pb-20">
        {/* Aurora */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(15,23,42,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(15,23,42,0.03) 1px,transparent 1px)', backgroundSize: '64px 64px' }} />
          <motion.div
            animate={reduced ? { opacity: 0.4 } : { opacity: [0.4, 0.7, 0.4] }}
            transition={reduced ? {} : { duration: 10, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute"
            style={{ top: '-10%', left: '50%', transform: 'translateX(-50%)', width: 900, height: 560, borderRadius: '50%', background: 'radial-gradient(ellipse 60% 60% at 50% 30%,rgba(37,99,235,0.09),transparent 70%)', filter: 'blur(20px)' }}
          />
          <motion.div
            animate={reduced ? {} : { x: [0, 40, 0], y: [0, -20, 0] }}
            transition={reduced ? {} : { duration: 22, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute"
            style={{ top: '5%', right: '5%', width: 400, height: 400, borderRadius: '50%', background: `radial-gradient(circle,rgba(201,168,76,0.09),transparent 65%)`, filter: 'blur(30px)' }}
          />
        </div>

        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.5, ease }}
            style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', fontWeight: 700, color: GOLD, marginBottom: 24 }}
          >
            The CareNova Blog
          </motion.div>

          <div style={{ overflow: 'hidden' }}>
            <motion.h1
              initial={{ y: '110%' }} animate={{ y: 0 }}
              transition={{ duration: reduced ? 0 : 0.82, ease, delay: reduced ? 0 : 0.08 }}
              style={{ ...serif, fontSize: 'clamp(38px,7vw,76px)', color: INK, margin: 0, lineHeight: 1.05, fontWeight: 400 }}
            >
              {heroLines.map((line, i) => (
                <span key={i} style={{ display: 'block' }}>{line}</span>
              ))}
            </motion.h1>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.7, ease, delay: reduced ? 0 : 0.48 }}
            className="max-w-2xl mx-auto mt-7"
            style={{ color: BODY, fontSize: 18, lineHeight: 1.65 }}
          >
            Practical writing on lead recovery, patient communication, and practice growth — for clinic owners and managers who want results, not theory.
          </motion.p>
        </div>
      </section>

      {/* ── Category filter chips ────────────────────────────────────────────── */}
      {!loading && !error && categories.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 pb-10">
          <div className="flex items-center gap-2.5 flex-wrap">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedCat(null)}
              style={{
                padding: '7px 18px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: `1.5px solid ${!selectedCat ? BLUE : CARD_BORDER}`,
                background: !selectedCat ? BLUE : '#fff',
                color: !selectedCat ? '#fff' : BODY,
                transition: 'all .2s', outline: 'none',
              }}
            >
              All
            </motion.button>
            {categories.map(cat => {
              const active = selectedCat === cat;
              const c = catColor(cat);
              return (
                <motion.button
                  key={cat}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedCat(active ? null : cat)}
                  style={{
                    padding: '7px 18px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: `1.5px solid ${active ? c : CARD_BORDER}`,
                    background: active ? c : '#fff',
                    color: active ? '#fff' : BODY,
                    transition: 'all .2s', outline: 'none',
                  }}
                >
                  {cat}
                </motion.button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-28">

        {/* Skeletons */}
        {loading && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-7">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="text-center py-24">
            <p style={{ color: BODY, fontSize: 17 }}>{error}</p>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && filtered.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.6, ease }}
            className="text-center py-24 flex flex-col items-center"
          >
            <div style={{
              width: 64, height: 64, borderRadius: 16, marginBottom: 20,
              background: 'linear-gradient(135deg,rgba(37,99,235,0.09),rgba(201,168,76,0.10))',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: BLUE,
            }}>
              <PenLine size={28} />
            </div>
            <p style={{ ...serif, fontSize: 28, color: INK, marginBottom: 10 }}>
              {selectedCat ? `No articles in "${selectedCat}" yet.` : 'New articles are on the way.'}
            </p>
            <p style={{ fontSize: 16, color: BODY, maxWidth: 420 }}>
              {selectedCat
                ? 'Try another category, or check back soon.'
                : 'Practical guides on lead recovery, multilingual patient communication, and AI for dental practices — landing here soon.'}
            </p>
          </motion.div>
        )}

        {/* Featured + grid */}
        {!loading && !error && filtered.length > 0 && (
          <>
            {featured && <div className="mb-10"><FeaturedCard post={featured} /></div>}
            {gridPosts.length > 0 && (
              <motion.div
                variants={containerVariants}
                initial={reduced ? false : 'hidden'}
                whileInView={reduced ? undefined : 'show'}
                animate={reduced ? 'show' : undefined}
                viewport={{ once: true, margin: '-80px' }}
                className="grid md:grid-cols-2 lg:grid-cols-3 gap-7"
              >
                {gridPosts.map(post => <PostCard key={post.id} post={post} />)}
              </motion.div>
            )}
          </>
        )}
      </section>

      {/* ── CTA banner ───────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 pb-32">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }} transition={{ duration: reduced ? 0 : 0.6, ease }}
          className="relative rounded-[28px] text-center overflow-hidden"
          style={{ padding: 'clamp(48px,8vw,72px) 32px', background: 'linear-gradient(135deg,#0d1626,#0a1120)' }}
        >
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 100% at 50% 120%,rgba(37,99,235,0.4),transparent 70%)' }} />
          <div className="relative flex flex-col items-center gap-5">
            <h2 className="m-0 max-w-lg leading-tight" style={{ ...serif, fontSize: 'clamp(28px,4vw,44px)', color: '#fff' }}>
              Want to see CareNova in action?
            </h2>
            <p className="m-0 max-w-sm" style={{ color: 'rgba(255,255,255,0.75)', fontSize: 17 }}>
              Book a 20-minute demo and see how the AI handles real enquiries from your clinic.
            </p>
            <Link
              to="/#cta"
              className="inline-flex items-center gap-2 px-9 py-[18px] rounded-full font-medium text-[17px] mt-2"
              style={{ background: BLUE, color: '#fff', textDecoration: 'none', boxShadow: '0 12px 40px rgba(37,99,235,0.45)' }}
            >
              Book a Demo <ArrowRight size={18} />
            </Link>
          </div>
        </motion.div>
      </section>

      <Footer />
      <ScrollToTopButton />
    </div>
  );
}
