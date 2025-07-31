-- Create perplexity_news table for AI-generated Hong Kong news
-- Based on headline-feed-example.md but adapted for our UUID-based system

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- for sha256() hashing
CREATE EXTENSION IF NOT EXISTS pg_cron;   -- for scheduled cleanup

-- Main perplexity news table
CREATE TABLE IF NOT EXISTS perplexity_news (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  inserted_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- URL hash for duplicate detection (like the example)
  url_hash TEXT GENERATED ALWAYS AS (encode(digest(url,'sha256'),'hex')) STORED,
  
  -- Article enrichment workflow
  article_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'enriched', 'ready'
  article_html TEXT,
  lede TEXT, -- Lead paragraph (legacy)
  image_prompt TEXT, -- AI-generated image search prompt
  
  -- Enhanced structured content fields
  enhanced_title TEXT, -- Improved headline
  summary TEXT, -- Executive summary
  key_points TEXT[], -- Array of key points
  why_it_matters TEXT, -- Significance analysis
  structured_sources JSONB, -- Source citations in JSON format
  
  -- Image workflow
  image_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'ready', 'failed'
  image_url TEXT,
  image_license TEXT,
  
  -- Metadata
  source TEXT DEFAULT 'Perplexity AI',
  author TEXT DEFAULT 'AI Generated',
  
  -- Perplexity-specific metadata
  perplexity_model TEXT DEFAULT 'sonar-pro',
  generation_cost DECIMAL(10,6), -- Track API costs
  search_queries TEXT[], -- Queries used by Perplexity
  citations JSONB, -- Store source citations
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint on URL hash (prevents duplicates)
ALTER TABLE perplexity_news ADD CONSTRAINT unique_perplexity_url UNIQUE (url_hash);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_perplexity_news_category ON perplexity_news(category);
CREATE INDEX IF NOT EXISTS idx_perplexity_news_inserted_at ON perplexity_news(inserted_at DESC);
CREATE INDEX IF NOT EXISTS idx_perplexity_news_published_at ON perplexity_news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_perplexity_news_article_status ON perplexity_news(article_status);
CREATE INDEX IF NOT EXISTS idx_perplexity_news_image_status ON perplexity_news(image_status);

-- Compound indexes for common queries
CREATE INDEX IF NOT EXISTS idx_perplexity_news_status_category ON perplexity_news(article_status, category);
CREATE INDEX IF NOT EXISTS idx_perplexity_news_ready_inserted ON perplexity_news(article_status, inserted_at DESC) 
  WHERE article_status = 'ready';

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_perplexity_news_search ON perplexity_news 
  USING gin(to_tsvector('english', title || ' ' || COALESCE(lede, '') || ' ' || COALESCE(article_html, '')));

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_perplexity_news_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_perplexity_news_updated_at 
    BEFORE UPDATE ON perplexity_news 
    FOR EACH ROW 
    EXECUTE FUNCTION update_perplexity_news_updated_at();

-- Automatic cleanup of old articles (24-hour TTL like the example)
-- This will run every 30 minutes to clean up articles older than 24 hours
SELECT cron.schedule(
  'cleanup_old_perplexity_news', '*/30 * * * *',
  $$ DELETE FROM perplexity_news WHERE inserted_at < NOW() - INTERVAL '24 hours' $$
);

-- Enable Row Level Security
ALTER TABLE perplexity_news ENABLE ROW LEVEL SECURITY;

-- Create policy to allow read access to all users
CREATE POLICY "Allow read access to all users" ON perplexity_news
    FOR SELECT USING (true);

-- Create policy to allow insert/update/delete for service role
CREATE POLICY "Allow full access for service role" ON perplexity_news
    FOR ALL USING (auth.role() = 'service_role');

-- Create indexes for realtime subscriptions (for live updates)
CREATE INDEX IF NOT EXISTS idx_perplexity_news_realtime_insert ON perplexity_news(inserted_at) 
  WHERE article_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_perplexity_news_realtime_ready ON perplexity_news(updated_at) 
  WHERE article_status = 'ready';

-- Comments for documentation
COMMENT ON TABLE perplexity_news IS 'AI-generated Hong Kong news articles using Perplexity API';
COMMENT ON COLUMN perplexity_news.article_status IS 'Workflow status: pending -> enriched -> ready';
COMMENT ON COLUMN perplexity_news.image_status IS 'Image processing status: pending -> ready/failed';
COMMENT ON COLUMN perplexity_news.url_hash IS 'SHA256 hash of URL for duplicate detection';
COMMENT ON COLUMN perplexity_news.citations IS 'JSON array of source citations from Perplexity';
COMMENT ON COLUMN perplexity_news.generation_cost IS 'Estimated API cost in USD for this article';