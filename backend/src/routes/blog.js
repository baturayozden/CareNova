const express = require('express');
const router  = express.Router();
const { pool } = require('../db/index');

// GET /api/blog?page=1&limit=12
// Public — no auth required.
// Returns published posts (summary fields only, no content).
router.get('/', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  || '1',  10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '12', 10)));
    const offset = (page - 1) * limit;

    const [listResult, countResult] = await Promise.all([
      pool.query(`
        SELECT id, title, slug, excerpt, meta_description, category,
               image_url, image_alt, published_at, reading_time_minutes
        FROM   blog_posts
        WHERE  is_published = TRUE
        ORDER  BY published_at DESC
        LIMIT  $1 OFFSET $2
      `, [limit, offset]),
      pool.query(`
        SELECT COUNT(*) AS total
        FROM   blog_posts
        WHERE  is_published = TRUE
      `),
    ]);

    res.json({
      posts: listResult.rows,
      total: parseInt(countResult.rows[0].total, 10),
      page,
      limit,
    });
  } catch (err) {
    console.error('[Blog] GET /api/blog error:', err);
    res.status(500).json({ error: 'Failed to fetch blog posts' });
  }
});

// GET /api/blog/:slug
// Public — no auth required.
// Returns a single published post including full content.
router.get('/:slug', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT *
      FROM   blog_posts
      WHERE  slug = $1 AND is_published = TRUE
    `, [req.params.slug]);

    if (!rows.length) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('[Blog] GET /api/blog/:slug error:', err);
    res.status(500).json({ error: 'Failed to fetch blog post' });
  }
});

module.exports = router;
