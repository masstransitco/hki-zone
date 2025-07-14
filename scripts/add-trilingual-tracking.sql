-- Add trilingual batch tracking columns to articles table
-- This migration adds support for tracking articles generated through the trilingual auto-enhancement feature

-- Add trilingual batch tracking columns
ALTER TABLE articles ADD COLUMN IF NOT EXISTS trilingual_batch_id TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS source_article_id TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS language_variant VARCHAR(10); -- 'en', 'zh-TW', 'zh-CN'
ALTER TABLE articles ADD COLUMN IF NOT EXISTS language_order INTEGER; -- 1, 2, 3 for processing order
ALTER TABLE articles ADD COLUMN IF NOT EXISTS quality_score INTEGER; -- Quality score from headline scorer

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_articles_trilingual_batch ON articles(trilingual_batch_id);
CREATE INDEX IF NOT EXISTS idx_articles_source_article ON articles(source_article_id);
CREATE INDEX IF NOT EXISTS idx_articles_language_variant ON articles(language_variant);
CREATE INDEX IF NOT EXISTS idx_articles_quality_score ON articles(quality_score);

-- Add check constraint for language variants
ALTER TABLE articles ADD CONSTRAINT check_language_variant 
  CHECK (language_variant IN ('en', 'zh-TW', 'zh-CN') OR language_variant IS NULL);

-- Add check constraint for language order
ALTER TABLE articles ADD CONSTRAINT check_language_order 
  CHECK (language_order IN (1, 2, 3) OR language_order IS NULL);

-- Create a view for trilingual batch statistics
CREATE OR REPLACE VIEW trilingual_batch_stats AS
SELECT 
  trilingual_batch_id,
  COUNT(*) as total_articles,
  COUNT(CASE WHEN language_variant = 'en' THEN 1 END) as english_articles,
  COUNT(CASE WHEN language_variant = 'zh-TW' THEN 1 END) as traditional_chinese_articles,
  COUNT(CASE WHEN language_variant = 'zh-CN' THEN 1 END) as simplified_chinese_articles,
  AVG(quality_score) as avg_quality_score,
  MIN(created_at) as batch_created_at,
  MAX(created_at) as batch_completed_at
FROM articles
WHERE trilingual_batch_id IS NOT NULL
GROUP BY trilingual_batch_id;

-- Create a function to get related trilingual articles
CREATE OR REPLACE FUNCTION get_trilingual_articles(article_id UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  language VARCHAR(10),
  language_variant VARCHAR(10),
  url TEXT,
  source TEXT,
  quality_score INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.title,
    a.language,
    a.language_variant,
    a.url,
    a.source,
    a.quality_score
  FROM articles a
  WHERE a.source_article_id = (
    SELECT source_article_id 
    FROM articles 
    WHERE id = article_id
    AND source_article_id IS NOT NULL
  )
  OR a.id = article_id
  ORDER BY a.language_order;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON COLUMN articles.trilingual_batch_id IS 'Unique identifier for trilingual batch processing runs';
COMMENT ON COLUMN articles.source_article_id IS 'ID of the source article that was enhanced into multiple languages';
COMMENT ON COLUMN articles.language_variant IS 'Language variant code: en, zh-TW, or zh-CN';
COMMENT ON COLUMN articles.language_order IS 'Processing order within trilingual batch: 1=English, 2=Traditional Chinese, 3=Simplified Chinese';
COMMENT ON COLUMN articles.quality_score IS 'Quality score from the headline scorer (0-100)';

-- Sample query to verify the migration
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'articles' 
-- AND column_name IN ('trilingual_batch_id', 'source_article_id', 'language_variant', 'language_order', 'quality_score');