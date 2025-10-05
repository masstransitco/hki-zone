-- Admin Articles Page Optimization Migration
-- This migration creates optimized RPC functions for the /admin/articles page
-- Replaces multiple API endpoints with single optimized RPC calls

-- Step 1: Create performance indexes for articles queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_search_vector 
  ON articles USING gin(
    to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(content, '') || ' ' || COALESCE(summary, ''))
  ) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_admin_filters 
  ON articles(created_at DESC, source, category, is_ai_enhanced, selected_for_enhancement, language_variant) 
  WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_counts 
  ON articles(is_ai_enhanced, selected_for_enhancement, source) 
  WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_analytics_time 
  ON articles(created_at, category, source, is_ai_enhanced) 
  WHERE deleted_at IS NULL;

-- Step 2: Main Articles List RPC Function with Advanced Filtering
CREATE OR REPLACE FUNCTION get_admin_articles_paginated(
  p_page integer DEFAULT 0,
  p_limit integer DEFAULT 20,
  p_search text DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_language text DEFAULT NULL,
  p_ai_enhanced boolean DEFAULT NULL,
  p_date_filter text DEFAULT NULL,
  p_selected_for_enhancement boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_offset integer;
  v_time_boundary timestamptz;
  v_articles jsonb;
BEGIN
  v_offset := p_page * p_limit;
  
  -- Calculate time boundary if date filter is provided
  v_time_boundary := CASE p_date_filter
    WHEN '2h' THEN NOW() - INTERVAL '2 hours'
    WHEN '6h' THEN NOW() - INTERVAL '6 hours'
    WHEN '24h' THEN NOW() - INTERVAL '24 hours'
    WHEN '7d' THEN NOW() - INTERVAL '7 days'
    WHEN '30d' THEN NOW() - INTERVAL '30 days'
    WHEN '60d' THEN NOW() - INTERVAL '60 days'
    WHEN '90d' THEN NOW() - INTERVAL '90 days'
    ELSE NULL
  END;
  
  -- Build dynamic query with all filters and pagination
  WITH filtered_articles AS (
    SELECT 
      id,
      title,
      COALESCE(ai_summary, summary) as summary,
      CASE 
        WHEN LENGTH(COALESCE(content, '')) > 500 THEN 
          LEFT(COALESCE(content, ''), 500) || '...'
        ELSE COALESCE(content, '')
      END as content,
      url,
      source,
      author,
      COALESCE(published_at, created_at) as published_at,
      COALESCE(image_url, '/placeholder.svg?height=200&width=300') as image_url,
      COALESCE(category, 'General') as category,
      GREATEST(CEIL(LENGTH(COALESCE(content, '')) / 200.0), 3) as read_time,
      COALESCE(is_ai_enhanced, false) as is_ai_enhanced,
      COALESCE(language_variant, 
               enhancement_metadata->>'language', 
               'en') as language,
      enhancement_metadata,
      deleted_at,
      COALESCE(selected_for_enhancement, false) as selected_for_enhancement,
      created_at
    FROM articles
    WHERE deleted_at IS NULL
      -- Search filter using full-text search
      AND (p_search IS NULL OR 
           to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(content, '') || ' ' || COALESCE(summary, '')) 
           @@ plainto_tsquery('english', p_search))
      -- Source filter
      AND (p_source IS NULL OR source = p_source)
      -- Category filter  
      AND (p_category IS NULL OR category = p_category)
      -- AI Enhanced filter
      AND (p_ai_enhanced IS NULL OR is_ai_enhanced = p_ai_enhanced)
      -- Selected for enhancement filter
      AND (p_selected_for_enhancement IS NULL OR selected_for_enhancement = p_selected_for_enhancement)
      -- Language filter (for AI enhanced articles)
      AND (p_language IS NULL OR 
           (p_ai_enhanced = true AND (
             (p_language = 'en' AND (
               language_variant IS NULL OR 
               language_variant = 'en' OR
               enhancement_metadata->>'language' IS NULL OR 
               enhancement_metadata->>'language' = 'en'
             )) OR
             (p_language != 'en' AND (
               language_variant = p_language OR
               enhancement_metadata->>'language' = p_language
             ))
           )) OR
           (p_ai_enhanced IS NOT TRUE))
      -- Date filter
      AND (v_time_boundary IS NULL OR created_at >= v_time_boundary)
    ORDER BY created_at DESC
  ),
  
  paginated_articles AS (
    SELECT * FROM filtered_articles
    LIMIT p_limit + 1 OFFSET v_offset
  ),
  
  article_count AS (
    SELECT COUNT(*) as total FROM filtered_articles
  )
  
  SELECT jsonb_build_object(
    'articles', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', id,
          'title', title,
          'summary', summary,
          'content', content,
          'url', url,
          'source', source,
          'author', author,
          'publishedAt', published_at,
          'imageUrl', image_url,
          'category', category,
          'readTime', read_time,
          'isAiEnhanced', is_ai_enhanced,
          'language', language,
          'enhancementMetadata', enhancement_metadata,
          'deletedAt', deleted_at,
          'selectedForEnhancement', selected_for_enhancement
        )
        ORDER BY created_at DESC
      ), '[]'::jsonb) FROM (
        SELECT * FROM paginated_articles LIMIT p_limit
      ) limited_articles
    ),
    'hasMore', (SELECT COUNT(*) > p_limit FROM paginated_articles),
    'total', (SELECT total FROM article_count),
    'page', p_page,
    'limit', p_limit,
    'usingMockData', false
  ) INTO v_articles;
  
  RETURN v_articles;
END;
$$;

-- Step 3: Optimized Stats RPC Function
CREATE OR REPLACE FUNCTION get_admin_articles_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
  v_stats jsonb;
  v_today timestamptz := date_trunc('day', NOW());
BEGIN
  WITH 
  counts AS (
    SELECT
      COUNT(*) FILTER (WHERE deleted_at IS NULL) as total,
      COUNT(*) FILTER (WHERE deleted_at IS NULL AND is_ai_enhanced = true) as enhanced,
      COUNT(*) FILTER (WHERE deleted_at IS NULL AND selected_for_enhancement = true) as selected,
      COUNT(*) FILTER (WHERE deleted_at IS NULL AND created_at >= v_today) as recent
    FROM articles
  ),
  
  source_stats AS (
    SELECT 
      source,
      COUNT(*) as count
    FROM articles
    WHERE deleted_at IS NULL
    GROUP BY source
    ORDER BY count DESC
    LIMIT 5
  )
  
  SELECT jsonb_build_object(
    'total', (SELECT total FROM counts),
    'enhanced', (SELECT enhanced FROM counts),
    'selected', (SELECT selected FROM counts),
    'recentlyAdded', (SELECT recent FROM counts),
    'topSources', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('name', source, 'count', count)
        ORDER BY count DESC
      ) FROM source_stats
    ), '[]'::jsonb)
  ) INTO v_stats;
  
  RETURN v_stats;
END;
$$;

-- Step 4: Advanced Analytics RPC Function
CREATE OR REPLACE FUNCTION get_admin_articles_analytics(
  p_date_filter text DEFAULT '24h'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_time_boundary timestamptz;
  v_time_bucket_interval text;
  v_result jsonb;
BEGIN
  -- Calculate time boundary and bucket interval
  v_time_boundary := CASE p_date_filter
    WHEN '2h' THEN NOW() - INTERVAL '2 hours'
    WHEN '6h' THEN NOW() - INTERVAL '6 hours'  
    WHEN '24h' THEN NOW() - INTERVAL '24 hours'
    WHEN '7d' THEN NOW() - INTERVAL '7 days'
    WHEN '30d' THEN NOW() - INTERVAL '30 days'
    WHEN '60d' THEN NOW() - INTERVAL '60 days'
    WHEN '90d' THEN NOW() - INTERVAL '90 days'
    ELSE NOW() - INTERVAL '24 hours'
  END;
  
  v_time_bucket_interval := CASE 
    WHEN p_date_filter IN ('2h', '6h') THEN 'hour'
    ELSE 'day'
  END;
  
  WITH 
  -- Time-based enhancement trends
  time_trends AS (
    SELECT 
      date_trunc(v_time_bucket_interval, created_at) as time_bucket,
      COUNT(*) as articles_scraped,
      COUNT(*) FILTER (WHERE selected_for_enhancement = true) as selected,
      COUNT(*) FILTER (WHERE is_ai_enhanced = true) as enhanced,
      COUNT(*) FILTER (WHERE selected_for_enhancement = true AND is_ai_enhanced = false) as pending
    FROM articles
    WHERE deleted_at IS NULL
      AND created_at >= v_time_boundary
    GROUP BY time_bucket
    ORDER BY time_bucket
  ),
  
  -- Source enhancement analysis
  source_analysis AS (
    SELECT 
      source,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE selected_for_enhancement = true) as selected,
      COUNT(*) FILTER (WHERE is_ai_enhanced = true) as enhanced,
      ROUND(100.0 * COUNT(*) FILTER (WHERE selected_for_enhancement = true) / NULLIF(COUNT(*), 0), 1) as selection_rate,
      ROUND(100.0 * COUNT(*) FILTER (WHERE is_ai_enhanced = true) / NULLIF(COUNT(*), 0)) as enhancement_rate
    FROM articles
    WHERE deleted_at IS NULL
      AND created_at >= v_time_boundary
    GROUP BY source
    HAVING COUNT(*) >= 5  -- Sources with at least 5 articles
    ORDER BY total DESC
    LIMIT 10
  ),
  
  -- Category distribution from enhanced articles
  category_analysis AS (
    SELECT 
      COALESCE(category, 'General') as name,
      COUNT(*) as value
    FROM articles
    WHERE deleted_at IS NULL
      AND is_ai_enhanced = true
      AND created_at >= v_time_boundary
    GROUP BY category
    ORDER BY value DESC
    LIMIT 10
  ),
  
  -- Overall metrics for the time period
  overall_metrics AS (
    SELECT
      COUNT(*) as total_articles,
      COUNT(*) FILTER (WHERE is_ai_enhanced = true) as enhanced_articles,
      COUNT(*) FILTER (WHERE selected_for_enhancement = true) as selected_articles,
      ROUND(100.0 * COUNT(*) FILTER (WHERE is_ai_enhanced = true) / NULLIF(COUNT(*), 0)) as enhancement_rate,
      COUNT(DISTINCT source) as unique_sources,
      -- Processing efficiency calculation
      AVG(
        CASE 
          WHEN is_ai_enhanced = true AND updated_at > created_at THEN
            EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600.0  -- Hours
          ELSE NULL
        END
      ) as avg_processing_hours,
      -- Stale selections (selected > 6 hours ago but not enhanced)
      COUNT(*) FILTER (
        WHERE selected_for_enhancement = true 
          AND is_ai_enhanced = false 
          AND updated_at < NOW() - INTERVAL '6 hours'
      ) as stale_selections
    FROM articles
    WHERE deleted_at IS NULL
      AND created_at >= v_time_boundary
  )
  
  SELECT jsonb_build_object(
    'enhancementTrends', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'date', 
          CASE 
            WHEN p_date_filter IN ('2h', '6h', '24h') THEN 
              to_char(time_bucket, 'HH24:MI')
            ELSE 
              to_char(time_bucket, 'Mon DD')
          END,
          'articles_scraped', articles_scraped,
          'selected', selected,
          'enhanced', enhanced,
          'pending', pending
        )
        ORDER BY time_bucket
      ) FROM time_trends
    ), '[]'::jsonb),
    'sourceEnhancement', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', source,
          'total', total,
          'selected', selected,
          'enhanced', enhanced,
          'selectionRate', selection_rate,
          'enhancementRate', enhancement_rate
        )
        ORDER BY total DESC
      ) FROM source_analysis
    ), '[]'::jsonb),
    'categoryDistribution', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('name', name, 'value', value)
        ORDER BY value DESC
      ) FROM category_analysis
    ), '[]'::jsonb),
    'pipelineMetrics', (
      SELECT jsonb_build_object(
        'enhancementConversionRate', COALESCE(enhancement_rate, 0),
        'sourceCoverageScore', COALESCE((
          SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE enhancement_rate >= 5) / NULLIF(COUNT(*), 0))
          FROM source_analysis
        ), 0),
        'selectionOpportunityRate', 
          ROUND(100.0 * selected_articles / NULLIF(total_articles, 0), 1),
        'processingEfficiency', 
          CASE 
            WHEN avg_processing_hours IS NOT NULL THEN
              GREATEST(0, LEAST(100, ROUND(100 - (avg_processing_hours / 5.0) * 100)))
            ELSE 0
          END,
        'avgTimeToEnhancement',
          CASE 
            WHEN avg_processing_hours IS NOT NULL THEN
              CASE 
                WHEN avg_processing_hours < 1 THEN '< 1 hour'
                ELSE ROUND(avg_processing_hours, 1) || ' hours'
              END
            ELSE 'N/A'
          END,
        'queueSize', selected_articles,
        'staleSelections', stale_selections
      ) FROM overall_metrics
    ),
    'timePeriod', 
      CASE p_date_filter
        WHEN '2h' THEN 'past 2 hours'
        WHEN '6h' THEN 'past 6 hours'
        WHEN '24h' THEN 'past 24 hours'
        WHEN '7d' THEN 'past 7 days'
        WHEN '30d' THEN 'past 30 days'
        WHEN '60d' THEN 'past 60 days'
        WHEN '90d' THEN 'past 90 days'
        ELSE 'past 24 hours'
      END,
    'dateFilter', p_date_filter,
    'totalArticlesAnalyzed', (SELECT total_articles FROM overall_metrics),
    'timestamp', NOW()::text,
    'cached', false,
    'strategy', 'rpc'
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Step 5: Unified Search RPC Function
CREATE OR REPLACE FUNCTION search_admin_articles(
  p_query text,
  p_limit integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_results jsonb;
BEGIN
  WITH search_results AS (
    SELECT 
      id,
      title,
      COALESCE(ai_summary, summary) as summary,
      CASE 
        WHEN LENGTH(COALESCE(content, '')) > 300 THEN 
          LEFT(COALESCE(content, ''), 300) || '...'
        ELSE COALESCE(content, '')
      END as content,
      url,
      source,
      author,
      COALESCE(published_at, created_at) as published_at,
      COALESCE(image_url, '/placeholder.svg?height=200&width=300') as image_url,
      COALESCE(category, 'General') as category,
      GREATEST(CEIL(LENGTH(COALESCE(content, '')) / 200.0), 3) as read_time,
      COALESCE(is_ai_enhanced, false) as is_ai_enhanced,
      COALESCE(language_variant, 
               enhancement_metadata->>'language', 
               'en') as language,
      enhancement_metadata,
      deleted_at,
      COALESCE(selected_for_enhancement, false) as selected_for_enhancement,
      created_at,
      -- Add search ranking
      ts_rank(
        to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(content, '') || ' ' || COALESCE(summary, '')),
        plainto_tsquery('english', p_query)
      ) as search_rank
    FROM articles
    WHERE deleted_at IS NULL
      AND to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(content, '') || ' ' || COALESCE(summary, ''))
          @@ plainto_tsquery('english', p_query)
    ORDER BY search_rank DESC, created_at DESC
    LIMIT p_limit
  )
  
  SELECT jsonb_build_object(
    'articles', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id,
          'title', title,
          'summary', summary,
          'content', content,
          'url', url,
          'source', source,
          'author', author,
          'publishedAt', published_at,
          'imageUrl', image_url,
          'category', category,
          'readTime', read_time,
          'isAiEnhanced', is_ai_enhanced,
          'language', language,
          'enhancementMetadata', enhancement_metadata,
          'deletedAt', deleted_at,
          'selectedForEnhancement', selected_for_enhancement,
          'searchRank', search_rank
        )
        ORDER BY search_rank DESC, created_at DESC
      ) FROM search_results
    ), '[]'::jsonb),
    'hasMore', false,  -- Search doesn't support pagination yet
    'total', (SELECT COUNT(*) FROM search_results),
    'query', p_query,
    'usingMockData', false
  ) INTO v_results;
  
  RETURN v_results;
END;
$$;

-- Step 6: Create cache table for articles operations
CREATE TABLE IF NOT EXISTS admin_articles_cache (
  cache_key text PRIMARY KEY,
  operation text NOT NULL,
  params jsonb,
  result jsonb NOT NULL,
  created_at timestamptz DEFAULT NOW()
);

-- Create index for cache cleanup
CREATE INDEX IF NOT EXISTS idx_articles_cache_created 
  ON admin_articles_cache(created_at);

-- Step 7: Create cached version of functions (optional - for high-traffic scenarios)
CREATE OR REPLACE FUNCTION get_cached_admin_articles_stats(
  p_cache_duration interval DEFAULT INTERVAL '2 minutes'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_cache_key text := 'admin_articles_stats';
  v_cached_result jsonb;
BEGIN
  -- Try to get from cache
  SELECT result INTO v_cached_result
  FROM admin_articles_cache
  WHERE cache_key = v_cache_key
    AND created_at > NOW() - p_cache_duration;
  
  IF v_cached_result IS NOT NULL THEN
    RETURN jsonb_set(v_cached_result, '{cached}', 'true'::jsonb);
  END IF;
  
  -- Get fresh data
  v_cached_result := get_admin_articles_stats();
  
  -- Update cache
  INSERT INTO admin_articles_cache (cache_key, operation, result)
  VALUES (v_cache_key, 'stats', v_cached_result)
  ON CONFLICT (cache_key) 
  DO UPDATE SET 
    result = EXCLUDED.result, 
    created_at = NOW();
  
  -- Cleanup old cache entries
  DELETE FROM admin_articles_cache 
  WHERE created_at < NOW() - INTERVAL '30 minutes';
  
  RETURN v_cached_result;
END;
$$;

-- Step 8: Create testing function
CREATE OR REPLACE FUNCTION test_admin_articles_functions()
RETURNS TABLE (
  test_name text,
  execution_time interval,
  result_summary text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_start timestamp;
  v_end timestamp;
  v_result jsonb;
BEGIN
  -- Test 1: Article list pagination
  v_start := clock_timestamp();
  v_result := get_admin_articles_paginated(0, 10);
  v_end := clock_timestamp();
  
  RETURN QUERY 
  SELECT 
    'Article List (page 0, limit 10)'::text,
    v_end - v_start,
    ('Articles returned: ' || (v_result->>'total') || ', Has more: ' || (v_result->>'hasMore'))::text;
  
  -- Test 2: Stats function
  v_start := clock_timestamp();
  v_result := get_admin_articles_stats();
  v_end := clock_timestamp();
  
  RETURN QUERY 
  SELECT 
    'Article Stats'::text,
    v_end - v_start,
    ('Total: ' || (v_result->>'total') || ', Enhanced: ' || (v_result->>'enhanced'))::text;
  
  -- Test 3: Analytics function
  v_start := clock_timestamp();
  v_result := get_admin_articles_analytics('24h');
  v_end := clock_timestamp();
  
  RETURN QUERY 
  SELECT 
    'Analytics (24h)'::text,
    v_end - v_start,
    ('Total analyzed: ' || (v_result->>'totalArticlesAnalyzed'))::text;
  
  -- Test 4: Search function
  v_start := clock_timestamp();
  v_result := search_admin_articles('news', 5);
  v_end := clock_timestamp();
  
  RETURN QUERY 
  SELECT 
    'Search ("news", limit 5)'::text,
    v_end - v_start,
    ('Results: ' || (v_result->>'total'))::text;
  
  -- Test 5: Cached stats
  v_start := clock_timestamp();
  v_result := get_cached_admin_articles_stats();
  v_end := clock_timestamp();
  
  RETURN QUERY 
  SELECT 
    'Cached Stats'::text,
    v_end - v_start,
    ('Cached: ' || COALESCE(v_result->>'cached', 'false'))::text;
END;
$$;

-- Step 9: Grant permissions
GRANT EXECUTE ON FUNCTION get_admin_articles_paginated TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_articles_stats TO authenticated;  
GRANT EXECUTE ON FUNCTION get_admin_articles_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION search_admin_articles TO authenticated;
GRANT EXECUTE ON FUNCTION get_cached_admin_articles_stats TO authenticated;
GRANT EXECUTE ON FUNCTION test_admin_articles_functions TO authenticated;

-- Grant permissions for anon access (for public-facing features)
GRANT EXECUTE ON FUNCTION get_admin_articles_paginated TO anon;
GRANT EXECUTE ON FUNCTION get_admin_articles_stats TO anon;  
GRANT EXECUTE ON FUNCTION get_admin_articles_analytics TO anon;
GRANT EXECUTE ON FUNCTION search_admin_articles TO anon;

-- Add comments explaining the functions
COMMENT ON FUNCTION get_admin_articles_paginated IS 
'Optimized RPC function for paginated article listing with advanced filtering.
Replaces multiple client-side filters with single database call.
Supports full-text search, source/category filtering, language filtering, and date ranges.';

COMMENT ON FUNCTION get_admin_articles_stats IS 
'Fast statistics for article dashboard.
Replaces 5+ separate COUNT queries with single optimized call.';

COMMENT ON FUNCTION get_admin_articles_analytics IS 
'Comprehensive analytics for article processing pipeline.
Includes time-based trends, source analysis, and performance metrics.
Optimized for different time periods with appropriate bucketing.';

COMMENT ON FUNCTION search_admin_articles IS 
'Full-text search across articles using PostgreSQL text search.
Uses tsvector indexes for fast search with relevance ranking.';