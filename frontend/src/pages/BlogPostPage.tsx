import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import SEOMeta from '../components/SEOMeta';
import { motion, useScroll, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Clock, Calendar } from 'lucide-react';
import NavBar from '../components/landing/NavBar';
import Footer from '../components/landing/Footer';
import ScrollToTopButton from '../components/ScrollToTopButton';
import { formatDate } from '../utils/date';

// ── Constants ──────────────────────────────────────────────────────────────────

const API         = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const INK         = '#0f172a';
const BODY        = '#475569';
const MUTED       = '#94a3b8';
const BLUE        = '#2563EB';
const GOLD        = '#c9a84c';
const CARD_BORDER = '#e6ebf2';
const ease        = [0.16, 1, 0.3, 1] as const;
const serif       = { fontFamily: "'Instrument Serif', serif" };

const CAT_COLORS: Record<string, string> = {
  'Lead Recovery':         '#2563EB',
  'Automation':            '#7c3aed',
  'Buyer Guides':          '#c9a84c',
  'Conversion':            '#0891b2',
  'Practice Growth':       '#059669',
  'Patient Communication': '#db2777',
};
function catColor(c: string | null): string {
  return (c && CAT_COLORS[c]) || '#475569';
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface BlogPostFull {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  meta_description: string | null;
  focus_keyword: string | null;
  category: string | null;
  image_url: string | null;
  image_alt: string | null;
  image_credit: string | null;
  published_at: string;
  updated_at: string | null;
  is_published: boolean;
  word_count: number | null;
  reading_time_minutes: number | null;
  created_at: string;
}

interface BlogPostBrief {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  category: string | null;
  image_url: string | null;
  image_alt: string | null;
  published_at: string;
  reading_time_minutes: number | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────


// ── CategoryBadge ──────────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null;
  const c = catColor(category);
  return (
    <span style={{
      display: 'inline-block', padding: '3px 12px', borderRadius: 999,
      fontSize: 11, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase',
      background: `${c}1a`, border: `1px solid ${c}40`, color: c,
    } as React.CSSProperties}>
      {category}
    </span>
  );
}

// ── SkeletonArticle ────────────────────────────────────────────────────────────

function SkeletonArticle() {
  return (
    <div className="animate-pulse">
      <div className="max-w-3xl mx-auto px-6 pt-48 pb-4">
        <div style={{ height: 14, width: '15%', background: '#e2e8f0', borderRadius: 6, marginBottom: 24 }} />
        <div style={{ height: 48, background: '#e2e8f0', borderRadius: 8, marginBottom: 12 }} />
        <div style={{ height: 48, width: '72%', background: '#e2e8f0', borderRadius: 8, marginBottom: 24 }} />
        <div style={{ height: 14, width: '32%', background: '#e2e8f0', borderRadius: 6, marginBottom: 40 }} />
      </div>
      <div className="max-w-4xl mx-auto px-6 pb-10">
        <div style={{ height: 380, background: '#e2e8f0', borderRadius: 20 }} />
      </div>
      <div className="max-w-3xl mx-auto px-6 pb-24" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[100, 100, 100, 60, 100, 100, 85, 100, 40].map((w, i) => (
          <div key={i} style={{ height: 18, width: `${w}%`, background: '#e2e8f0', borderRadius: 6 }} />
        ))}
      </div>
    </div>
  );
}

// ── RelatedCard ────────────────────────────────────────────────────────────────

function RelatedCard({ post }: { post: BlogPostBrief }) {
  const [hover, setHover] = useState(false);
  const cc = catColor(post.category);
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] as const }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: '#fff',
        border: `1px solid ${hover ? `${cc}40` : CARD_BORDER}`,
        borderRadius: 16, overflow: 'hidden',
        boxShadow: hover ? '0 16px 40px rgba(15,23,42,0.09)' : '0 2px 10px rgba(15,23,42,0.04)',
        transition: 'box-shadow .3s, border-color .3s',
      }}
    >
      <Link to={`/blog/${post.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
        <div style={{ height: 140, overflow: 'hidden', position: 'relative' }}>
          {post.image_url ? (
            <img
              src={post.image_url}
              alt={post.image_alt || post.title}
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                transition: 'transform .4s',
                transform: hover ? 'scale(1.06)' : 'scale(1)',
              }}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              background: `linear-gradient(135deg, ${cc}15, ${cc}28)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ ...serif, fontSize: 48, color: `${cc}50`, fontWeight: 400 }}>
                {post.title.charAt(0)}
              </span>
            </div>
          )}
        </div>
        <div style={{ padding: '14px 16px 18px', display: 'flex', flexDirection: 'column', gap: 7 }}>
          <CategoryBadge category={post.category} />
          <h4 style={{
            ...serif, fontSize: 16, color: INK, margin: 0, lineHeight: 1.3,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          } as React.CSSProperties}>
            {post.title}
          </h4>
          <span style={{ fontSize: 12, color: MUTED }}>{formatDate(post.published_at)}</span>
        </div>
      </Link>
    </motion.div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function BlogPostPage() {
  const { slug }   = useParams<{ slug: string }>();
  const reduced    = useReducedMotion();
  const { scrollYProgress } = useScroll();

  const [post, setPost]         = useState<BlogPostFull | null>(null);
  const [allPosts, setAllPosts] = useState<BlogPostBrief[]>([]);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true); setPost(null); setNotFound(false);

    Promise.all([
      fetch(`${API}/api/blog/${encodeURIComponent(slug)}`),
      fetch(`${API}/api/blog?limit=50`),
    ]).then(async ([postRes, allRes]) => {
      if (postRes.status === 404) {
        if (!cancelled) { setNotFound(true); setLoading(false); }
        return;
      }
      const [postData, allData] = await Promise.all([postRes.json(), allRes.json()]);
      if (!cancelled) {
        setPost(postData);
        const sorted = ((allData.posts || []) as BlogPostBrief[]).sort(
          (a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime(),
        );
        setAllPosts(sorted);
        setLoading(false);
      }
    }).catch(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [slug]);

  // Prev / next
  const { prevPost, nextPost } = useMemo(() => {
    if (!post || !allPosts.length) return { prevPost: null, nextPost: null };
    const idx = allPosts.findIndex(p => p.slug === post.slug);
    return {
      prevPost: idx > 0 ? allPosts[idx - 1] : null,
      nextPost: idx < allPosts.length - 1 ? allPosts[idx + 1] : null,
    };
  }, [post, allPosts]);

  // Related (same category, max 3)
  const relatedPosts = useMemo(() => {
    if (!post?.category || !allPosts.length) return [] as BlogPostBrief[];
    return allPosts
      .filter(p => p.slug !== post.slug && p.category === post.category)
      .slice(0, 3);
  }, [post, allPosts]);

  const cc = post ? catColor(post.category) : BLUE;

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ background: '#ffffff', minHeight: '100vh' }}>
        <NavBar />
        <SkeletonArticle />
        <Footer />
        <ScrollToTopButton />
      </div>
    );
  }

  // ── 404 ──────────────────────────────────────────────────────────────────────
  if (notFound || !post) {
    return (
      <div style={{ background: '#ffffff', minHeight: '100vh' }}>
        <SEOMeta
          title="Article not found | CareNova"
          description="This article may have moved or been unpublished. Browse all CareNova articles on dental lead recovery and patient communication."
          path={`/blog/${slug ?? ''}`}
        />
        <NavBar />
        <div
          className="flex flex-col items-center justify-center text-center px-6"
          style={{ minHeight: '60vh', gap: 20 }}
        >
          <div style={{
            width: 72, height: 72, borderRadius: 20, marginBottom: 8,
            background: 'linear-gradient(135deg,rgba(37,99,235,0.09),rgba(201,168,76,0.10))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ ...serif, fontSize: 32, color: BLUE }}>?</span>
          </div>
          <p style={{ ...serif, fontSize: 36, color: INK, margin: 0 }}>Article not found.</p>
          <p style={{ color: BODY, fontSize: 17, margin: 0, maxWidth: 400 }}>
            This article may have moved or been unpublished.
          </p>
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 px-7 py-4 rounded-full font-medium mt-2"
            style={{ background: BLUE, color: '#fff', textDecoration: 'none', fontSize: 15 }}
          >
            <ArrowLeft size={16} /> Back to all articles
          </Link>
        </div>
        <Footer />
        <ScrollToTopButton />
      </div>
    );
  }

  // ── Article ──────────────────────────────────────────────────────────────────
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.meta_description || post.excerpt || '',
    ...(post.image_url ? { image: post.image_url } : {}),
    datePublished: post.published_at,
    ...(post.updated_at ? { dateModified: post.updated_at } : {}),
    mainEntityOfPage: { '@type': 'WebPage', '@id': `https://carenova.ai/blog/${post.slug}` },
    inLanguage: 'en-GB',
    author: { '@type': 'Organization', name: 'CareNova', url: 'https://carenova.ai' },
    publisher: {
      '@type': 'Organization', name: 'CareNova', url: 'https://carenova.ai',
      logo: { '@type': 'ImageObject', url: 'https://carenova.ai/logo.png' },
    },
  };

  return (
    <div style={{ background: '#ffffff', minHeight: '100vh' }}>
      <SEOMeta
        title={`${post.title} | CareNova`}
        description={post.meta_description || post.excerpt || ''}
        path={`/blog/${post.slug}`}
        ogType="article"
        // The branded card (generate-og-cards.js), not the raw Pexels photo —
        // it supersedes the Pexels-crop fallback for blog posts specifically.
        // Homepage/other pages still use the default og-image.png untouched.
        ogImage={`https://carenova.ai/og/blog/${post.slug}.png`}
        ogImageAlt={post.title}
        structuredData={structuredData}
      />

      {/* Reading progress bar */}
      {!reduced && (
        <motion.div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, height: 3,
            zIndex: 51,
            background: `linear-gradient(to right, ${BLUE}, ${GOLD})`,
            scaleX: scrollYProgress,
            transformOrigin: '0%',
          }}
        />
      )}

      <NavBar />

      {/* Scoped prose styles */}
      <style>{`
        .blog-prose h2 {
          font-family: 'Instrument Serif', serif;
          font-size: 1.65em; font-weight: 400; color: #0f172a;
          margin-top: 2.2em; margin-bottom: 0.5em; line-height: 1.25;
        }
        .blog-prose h3 {
          font-family: 'Instrument Serif', serif;
          font-size: 1.3em; font-weight: 400; color: #0f172a;
          margin-top: 1.8em; margin-bottom: 0.4em; line-height: 1.3;
        }
        .blog-prose h4 {
          font-size: 1.05em; font-weight: 600; color: #0f172a;
          margin-top: 1.5em; margin-bottom: 0.4em;
        }
        .blog-prose p {
          font-size: 1.125rem; line-height: 1.8; color: #475569; margin-bottom: 1.4em;
        }
        .blog-prose a { color: #2563EB; text-decoration: underline; text-underline-offset: 3px; }
        .blog-prose a:hover { color: #1d4ed8; }
        .blog-prose ul, .blog-prose ol {
          font-size: 1.0625rem; line-height: 1.78; color: #475569;
          padding-left: 1.5em; margin-bottom: 1.4em;
        }
        .blog-prose li { margin-bottom: 0.5em; }
        .blog-prose blockquote {
          border-left: 3px solid #2563EB;
          margin: 2em 0; padding: 0.3em 0 0.3em 1.5em;
          color: #475569; font-style: italic; font-size: 1.125rem;
        }
        .blog-prose pre {
          background: #f8fafc; border: 1px solid #e2e8f0;
          border-radius: 10px; padding: 1.1em 1.4em;
          overflow-x: auto; margin-bottom: 1.4em;
        }
        .blog-prose code {
          background: #f1f5f9; border-radius: 5px;
          padding: 0.1em 0.4em; font-size: 0.88em;
        }
        .blog-prose img {
          max-width: 100%; border-radius: 12px;
          margin: 2.2em auto; display: block;
        }
        .blog-prose strong { color: #0f172a; font-weight: 600; }
        .blog-prose hr { border: none; border-top: 1px solid #e6ebf2; margin: 2.8em 0; }
        .blog-prose table { width: 100%; border-collapse: collapse; margin-bottom: 1.4em; font-size: 0.95rem; }
        .blog-prose th, .blog-prose td { padding: 10px 14px; border: 1px solid #e2e8f0; text-align: left; }
        .blog-prose th { background: #f8fafc; font-weight: 600; color: #0f172a; }
      `}</style>

      <article>
        {/* Breadcrumb — pt-40 clears fixed NavBar */}
        <div className="max-w-3xl mx-auto px-6 pt-40">
          <motion.div
            initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: reduced ? 0 : 0.5, ease }}
          >
            <Link
              to="/blog"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                fontSize: 14, color: BLUE, textDecoration: 'none', fontWeight: 500,
              }}
            >
              <ArrowLeft size={15} /> All articles
            </Link>
          </motion.div>
        </div>

        {/* Article header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.65, ease }}
          className="max-w-3xl mx-auto px-6 pt-8 pb-8"
        >
          <div style={{ marginBottom: 16 }}>
            <CategoryBadge category={post.category} />
          </div>
          <h1 style={{
            ...serif, fontSize: 'clamp(30px,5vw,56px)',
            color: INK, margin: 0, lineHeight: 1.1, fontWeight: 400,
          }}>
            {post.title}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 20 }}>
            {post.reading_time_minutes != null && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: MUTED }}>
                <Clock size={14} /> {post.reading_time_minutes} min read
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: MUTED }}>
              <Calendar size={14} /> {formatDate(post.published_at)}
            </span>
          </div>
        </motion.div>

        {/* Hero image or gradient fallback */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.7, ease, delay: reduced ? 0 : 0.15 }}
          className="max-w-4xl mx-auto px-6 pb-10"
        >
          {post.image_url ? (
            <div style={{
              borderRadius: 20, overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(15,23,42,0.10)',
              position: 'relative',
            }}>
              <img
                src={post.image_url}
                alt={post.image_alt || post.title}
                style={{ width: '100%', maxHeight: 480, objectFit: 'cover', display: 'block' }}
              />
              {post.image_credit && (
                <p style={{
                  position: 'absolute', bottom: 10, right: 14, margin: 0,
                  fontSize: 11, color: 'rgba(255,255,255,0.82)',
                  fontStyle: 'italic', textShadow: '0 1px 4px rgba(0,0,0,0.55)',
                }}>
                  {post.image_credit}
                </p>
              )}
            </div>
          ) : (
            <div style={{
              borderRadius: 20, height: 260,
              background: `linear-gradient(135deg, ${cc}15 0%, ${cc}32 100%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ ...serif, fontSize: 100, color: `${cc}40`, fontWeight: 400, lineHeight: 1 }}>
                {post.title.charAt(0)}
              </span>
            </div>
          )}
        </motion.div>

        {/* Article content */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: reduced ? 0 : 0.8, ease, delay: reduced ? 0 : 0.25 }}
          className="max-w-3xl mx-auto px-6 pb-20"
        >
          <div className="blog-prose" dangerouslySetInnerHTML={{ __html: post.content }} />
        </motion.div>
      </article>

      {/* End-of-article CTA */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: reduced ? 0 : 0.6, ease }}
          className="relative rounded-[28px] text-center overflow-hidden"
          style={{ padding: 'clamp(48px,8vw,72px) 32px', background: 'linear-gradient(135deg,#0d1626,#0a1120)' }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 70% 100% at 50% 120%,rgba(37,99,235,0.40),transparent 70%)' }}
          />
          <div className="relative flex flex-col items-center gap-5">
            <h2 style={{
              ...serif, fontSize: 'clamp(26px,4vw,44px)',
              color: '#ffffff', margin: 0, lineHeight: 1.2, maxWidth: 540,
            }}>
              Ready to recover more leads?
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 16, margin: 0, maxWidth: 380 }}>
              Book a free demo and see CareNova turn missed messages into booked appointments.
            </p>
            <Link
              to="/#cta"
              className="inline-flex items-center gap-2 px-8 py-[17px] rounded-full font-medium mt-1"
              style={{
                background: BLUE, color: '#fff', textDecoration: 'none',
                fontSize: 16, boxShadow: '0 12px 40px rgba(37,99,235,0.45)',
              }}
            >
              Book a free demo <ArrowRight size={17} />
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Prev / Next navigation */}
      {(prevPost || nextPost) && (
        <section className="max-w-3xl mx-auto px-6 pb-16">
          <div style={{ borderTop: `1px solid ${CARD_BORDER}`, paddingTop: 40 }}>
            <div className="grid sm:grid-cols-2 gap-5">
              {prevPost ? (
                <Link to={`/blog/${prevPost.slug}`} style={{ textDecoration: 'none' }}>
                  <motion.div
                    whileHover={{ y: -3 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] as const }}
                    style={{
                      padding: '20px 22px', borderRadius: 16,
                      border: `1px solid ${CARD_BORDER}`, background: '#fff',
                      cursor: 'pointer', height: '100%',
                    }}
                  >
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
                      color: MUTED, fontSize: 11, letterSpacing: 1, fontWeight: 700,
                      textTransform: 'uppercase',
                    }}>
                      <ArrowLeft size={12} /> Previous
                    </div>
                    <CategoryBadge category={prevPost.category} />
                    <p style={{
                      ...serif, fontSize: 16, color: INK, margin: '8px 0 0', lineHeight: 1.35,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    } as React.CSSProperties}>
                      {prevPost.title}
                    </p>
                  </motion.div>
                </Link>
              ) : <div />}

              {nextPost ? (
                <Link to={`/blog/${nextPost.slug}`} style={{ textDecoration: 'none' }}>
                  <motion.div
                    whileHover={{ y: -3 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] as const }}
                    style={{
                      padding: '20px 22px', borderRadius: 16,
                      border: `1px solid ${CARD_BORDER}`, background: '#fff',
                      cursor: 'pointer', textAlign: 'right', height: '100%',
                    }}
                  >
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                      gap: 6, marginBottom: 10,
                      color: MUTED, fontSize: 11, letterSpacing: 1, fontWeight: 700,
                      textTransform: 'uppercase',
                    }}>
                      Next <ArrowRight size={12} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <CategoryBadge category={nextPost.category} />
                    </div>
                    <p style={{
                      ...serif, fontSize: 16, color: INK, margin: '8px 0 0', lineHeight: 1.35,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    } as React.CSSProperties}>
                      {nextPost.title}
                    </p>
                  </motion.div>
                </Link>
              ) : <div />}
            </div>
          </div>
        </section>
      )}

      {/* Related posts */}
      {relatedPosts.length > 0 && (
        <section className="max-w-3xl mx-auto px-6 pb-24">
          <h2 style={{ ...serif, fontSize: 26, color: INK, marginBottom: 22, fontWeight: 400 }}>
            Related articles
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">
            {relatedPosts.map(rp => <RelatedCard key={rp.id} post={rp} />)}
          </div>
        </section>
      )}

      <Footer />
      <ScrollToTopButton />
    </div>
  );
}
