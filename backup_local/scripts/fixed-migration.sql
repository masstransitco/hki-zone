-- Add AI enhancement fields to articles table (Fixed Version)
-- Run this SQL in your Supabase SQL Editor

-- Step 1: Add new columns one by one
ALTER TABLE articles ADD COLUMN IF NOT EXISTS is_ai_enhanced BOOLEAN DEFAULT false;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS original_article_id UUID;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS enhancement_metadata JSONB;

-- Step 2: Add foreign key constraint for original_article_id
ALTER TABLE articles 
ADD CONSTRAINT fk_original_article 
FOREIGN KEY (original_article_id) REFERENCES articles(id);

-- Step 3: Create indexes for the new fields
CREATE INDEX IF NOT EXISTS idx_articles_is_ai_enhanced ON articles(is_ai_enhanced);
CREATE INDEX IF NOT EXISTS idx_articles_original_article_id ON articles(original_article_id);
CREATE INDEX IF NOT EXISTS idx_articles_enhancement_metadata ON articles USING gin(enhancement_metadata);

-- Step 4: Update the full-text search index (drop existing first)
DROP INDEX IF EXISTS idx_articles_search;

-- Step 5: Create new full-text search index with enhancement metadata
CREATE INDEX idx_articles_search ON articles USING gin(
  to_tsvector('english', 
    title || ' ' || 
    COALESCE(summary, '') || ' ' || 
    COALESCE(ai_summary, '') || ' ' || 
    COALESCE(enhancement_metadata->>'searchQueries', '') || ' ' ||
    COALESCE(enhancement_metadata->>'relatedTopics', '')
  )
);