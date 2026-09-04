-- 023_create_blog_posts.sql
-- Blog posts table for auto-blog system.
-- Run manually in Supabase SQL Editor. Idempotent.

CREATE TABLE IF NOT EXISTS blog_posts (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 TEXT        NOT NULL,
  slug                  TEXT        NOT NULL UNIQUE,
  content               TEXT        NOT NULL,
  excerpt               TEXT,
  meta_description      TEXT,
  focus_keyword         TEXT,
  category              TEXT,
  image_url             TEXT,
  image_alt             TEXT,
  image_credit          TEXT,
  published_at          TIMESTAMPTZ DEFAULT now(),
  is_published          BOOLEAN     NOT NULL DEFAULT TRUE,
  word_count            INTEGER,
  reading_time_minutes  INTEGER,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_slug
  ON blog_posts(slug);

CREATE INDEX IF NOT EXISTS idx_blog_posts_published
  ON blog_posts(is_published, published_at DESC);
