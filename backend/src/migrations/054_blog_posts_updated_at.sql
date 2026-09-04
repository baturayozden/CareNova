-- 054_blog_posts_updated_at.sql
-- Adds updated_at to blog_posts so Article JSON-LD can emit dateModified.
-- Google uses dateModified for freshness; without a tracked column the value
-- would have to be invented, so the field is simply omitted until this runs.
-- Run manually in Supabase SQL Editor. Idempotent.

BEGIN;

ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Backfill: a post that has never been edited was last modified when it was
-- published. This is a statement of fact for existing rows, not a guess.
UPDATE blog_posts
   SET updated_at = COALESCE(published_at, created_at)
 WHERE updated_at IS NULL;

ALTER TABLE blog_posts
  ALTER COLUMN updated_at SET DEFAULT now();

CREATE OR REPLACE FUNCTION set_blog_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_blog_posts_updated_at ON blog_posts;
CREATE TRIGGER trg_blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION set_blog_posts_updated_at();

COMMIT;
