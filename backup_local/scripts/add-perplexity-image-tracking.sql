-- Create table to track recently used images and prevent repetition
-- This helps ensure each article gets a perceptively unique image

-- Table to track image usage history
CREATE TABLE IF NOT EXISTS perplexity_image_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT NOT NULL,
  image_source TEXT NOT NULL, -- 'unsplash', 'google', 'perplexity', 'fallback'
  article_id UUID REFERENCES perplexity_news(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  search_query TEXT,
  image_hash TEXT GENERATED ALWAYS AS (encode(digest(image_url,'sha256'),'hex')) STORED,
  used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint to prevent duplicate tracking
ALTER TABLE perplexity_image_history ADD CONSTRAINT unique_image_article UNIQUE (image_url, article_id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_image_history_used_at ON perplexity_image_history(used_at DESC);
CREATE INDEX IF NOT EXISTS idx_image_history_category ON perplexity_image_history(category);
CREATE INDEX IF NOT EXISTS idx_image_history_source ON perplexity_image_history(image_source);
CREATE INDEX IF NOT EXISTS idx_image_history_hash ON perplexity_image_history(image_hash);

-- Compound index for recent image queries
CREATE INDEX IF NOT EXISTS idx_image_history_recent_category ON perplexity_image_history(category, used_at DESC);

-- Function to get recently used images (last 30 days by default)
CREATE OR REPLACE FUNCTION get_recent_used_images(
  p_days INTEGER DEFAULT 30,
  p_category TEXT DEFAULT NULL
)
RETURNS TABLE (
  image_url TEXT,
  image_source TEXT,
  used_count BIGINT,
  last_used TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ih.image_url,
    ih.image_source,
    COUNT(*) as used_count,
    MAX(ih.used_at) as last_used
  FROM perplexity_image_history ih
  WHERE 
    ih.used_at > NOW() - INTERVAL '1 day' * p_days
    AND (p_category IS NULL OR ih.category = p_category)
  GROUP BY ih.image_url, ih.image_source
  ORDER BY used_count DESC, last_used DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to check if an image was recently used
CREATE OR REPLACE FUNCTION is_image_recently_used(
  p_image_url TEXT,
  p_days INTEGER DEFAULT 7
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM perplexity_image_history 
    WHERE image_url = p_image_url 
    AND used_at > NOW() - INTERVAL '1 day' * p_days
  );
END;
$$ LANGUAGE plpgsql;

-- Automatic cleanup of old image history (keep last 60 days)
SELECT cron.schedule(
  'cleanup_old_image_history', '0 3 * * *',
  $$ DELETE FROM perplexity_image_history WHERE used_at < NOW() - INTERVAL '60 days' $$
);

-- Enable Row Level Security
ALTER TABLE perplexity_image_history ENABLE ROW LEVEL SECURITY;

-- Create policy to allow read access to all users
CREATE POLICY "Allow read access to all users" ON perplexity_image_history
    FOR SELECT USING (true);

-- Create policy to allow insert/update/delete for service role
CREATE POLICY "Allow full access for service role" ON perplexity_image_history
    FOR ALL USING (auth.role() = 'service_role');

-- Comments for documentation
COMMENT ON TABLE perplexity_image_history IS 'Tracks recently used images to prevent repetition';
COMMENT ON COLUMN perplexity_image_history.image_source IS 'Source of the image: unsplash, google, perplexity, or fallback';
COMMENT ON COLUMN perplexity_image_history.search_query IS 'The search query used to find this image';
COMMENT ON COLUMN perplexity_image_history.image_hash IS 'SHA256 hash of image URL for duplicate detection';