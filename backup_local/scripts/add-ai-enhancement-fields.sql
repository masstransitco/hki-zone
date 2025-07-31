-- Add AI enhancement fields to articles table
-- Run this SQL in your Supabase SQL Editor to add the new fields

-- Add new columns for AI enhancement
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS is_ai_enhanced BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS original_article_id UUID REFERENCES articles(id),
ADD COLUMN IF NOT EXISTS enhancement_metadata JSONB;

-- Create indexes for the new fields
CREATE INDEX IF NOT EXISTS idx_articles_is_ai_enhanced ON articles(is_ai_enhanced);
CREATE INDEX IF NOT EXISTS idx_articles_original_article_id ON articles(original_article_id);
CREATE INDEX IF NOT EXISTS idx_articles_enhancement_metadata ON articles USING gin(enhancement_metadata);

-- Update the full-text search index to include enhancement metadata
DROP INDEX IF EXISTS idx_articles_search;
CREATE INDEX IF NOT EXISTS idx_articles_search ON articles USING gin(
  to_tsvector('english', 
    title || ' ' || 
    COALESCE(summary, '') || ' ' || 
    COALESCE(ai_summary, '') || ' ' || 
    COALESCE(enhancement_metadata->>'searchQueries', '') || ' ' ||
    COALESCE(enhancement_metadata->>'relatedTopics', '')
  )
);

-- Add constraint to prevent enhancing already enhanced articles
ALTER TABLE articles 
ADD CONSTRAINT check_no_double_enhancement 
CHECK (
  CASE 
    WHEN is_ai_enhanced = true THEN original_article_id IS NOT NULL
    ELSE true
  END
);

-- Add constraint to ensure enhanced articles have metadata
ALTER TABLE articles 
ADD CONSTRAINT check_enhanced_has_metadata
CHECK (
  CASE 
    WHEN is_ai_enhanced = true THEN enhancement_metadata IS NOT NULL
    ELSE true
  END
);

-- Create a view for enhanced articles with their original articles
CREATE OR REPLACE VIEW enhanced_articles_with_original AS
SELECT 
  enhanced.*,
  original.title as original_title,
  original.created_at as original_created_at
FROM articles enhanced
LEFT JOIN articles original ON enhanced.original_article_id = original.id
WHERE enhanced.is_ai_enhanced = true;

-- Create a function to get enhancement statistics
CREATE OR REPLACE FUNCTION get_enhancement_stats()
RETURNS TABLE (
  total_articles BIGINT,
  enhanced_articles BIGINT,
  enhancement_percentage NUMERIC,
  avg_sources_per_enhancement NUMERIC,
  avg_queries_per_enhancement NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_articles,
    COUNT(*) FILTER (WHERE is_ai_enhanced = true) as enhanced_articles,
    ROUND(
      (COUNT(*) FILTER (WHERE is_ai_enhanced = true)::NUMERIC / COUNT(*)::NUMERIC) * 100, 
      2
    ) as enhancement_percentage,
    ROUND(
      AVG(jsonb_array_length(enhancement_metadata->'sources')) FILTER (WHERE is_ai_enhanced = true),
      2
    ) as avg_sources_per_enhancement,
    ROUND(
      AVG(jsonb_array_length(enhancement_metadata->'searchQueries')) FILTER (WHERE is_ai_enhanced = true),
      2
    ) as avg_queries_per_enhancement
  FROM articles;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT SELECT ON enhanced_articles_with_original TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_enhancement_stats() TO anon, authenticated;