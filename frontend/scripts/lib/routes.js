'use strict';

/**
 * Single source of truth for "which URLs does the marketing site have".
 *
 * Both generate-sitemap.js and prerender.js read from here. They used to be
 * able to drift — a post in the sitemap but not prerendered (or the reverse)
 * is exactly the kind of silent gap this phase exists to close.
 */

const https = require('https');
const http = require('http');

const API_URL  = process.env.REACT_APP_API_URL || 'https://api.carenova.ai';
const BASE_URL = 'https://carenova.ai';

/** Below this, assume the API is degraded and fail the build. */
const MIN_POSTS = 10;

const MARKETING_ROUTES = [
  { path: '/',        changefreq: 'weekly', priority: '1.0' },
  { path: '/about',   changefreq: 'weekly', priority: '0.8' },
  { path: '/blog',    changefreq: 'weekly', priority: '0.8' },
  { path: '/contact', changefreq: 'weekly', priority: '0.8' },
  { path: '/careers', changefreq: 'weekly', priority: '0.8' },
  { path: '/privacy', changefreq: 'weekly', priority: '0.8' },
  { path: '/terms',   changefreq: 'weekly', priority: '0.8' },
  { path: '/gdpr',    changefreq: 'weekly', priority: '0.8' },
  { path: '/cookies', changefreq: 'weekly', priority: '0.8' },
];

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: 15000 }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

/**
 * Published blog posts. Throws rather than returning a short list — a build
 * that silently emits 9 marketing routes tells Google this is a 9-page site.
 */
async function fetchBlogPosts(label = 'routes') {
  let posts;
  try {
    const data = await fetchJson(`${API_URL}/api/blog?page=1&limit=200&published=true`);
    posts = data.posts || [];
  } catch (err) {
    throw new Error(`[${label}] Could not reach the blog API (${err.message}). Build aborted.`);
  }
  if (posts.length < MIN_POSTS) {
    throw new Error(
      `[${label}] Only ${posts.length} blog post(s) returned, minimum is ${MIN_POSTS}. ` +
      'Verify the API is healthy and REACT_APP_API_URL is correct. Build aborted.',
    );
  }
  return posts;
}

/** Every path the marketing site serves, in sitemap order. */
async function allPaths(label) {
  const posts = await fetchBlogPosts(label);
  return {
    posts,
    paths: [
      ...MARKETING_ROUTES.map(r => r.path),
      ...posts.filter(p => p.slug).map(p => `/blog/${p.slug}`),
    ],
  };
}

module.exports = { API_URL, BASE_URL, MIN_POSTS, MARKETING_ROUTES, fetchBlogPosts, allPaths };
