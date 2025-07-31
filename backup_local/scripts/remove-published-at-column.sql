-- Remove published_at column from perplexity_news table
-- This simplifies the schema to match the articles table pattern

-- Drop the published_at column
ALTER TABLE perplexity_news DROP COLUMN IF EXISTS published_at;

-- Drop the published_at index if it exists
DROP INDEX IF EXISTS idx_perplexity_news_published_at;

-- Update comments to reflect the simplified schema
COMMENT ON TABLE perplexity_news IS 'AI-generated Hong Kong news articles using Perplexity API - simplified schema using only created_at/updated_at';

-- Update the compound index that was using published_at
-- (No changes needed for the ready_inserted index as it uses inserted_at DESC)

COMMENT ON COLUMN perplexity_news.created_at IS 'When the article was created in the system (replaces published_at)';
COMMENT ON COLUMN perplexity_news.updated_at IS 'Last modification timestamp - used for feed ordering';