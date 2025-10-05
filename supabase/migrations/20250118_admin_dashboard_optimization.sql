-- Admin Dashboard Optimization Migration
-- This migration creates optimized RPC functions for the Article Pipeline Dashboard
-- Replaces 15+ individual queries with a single RPC call

-- Step 1: Create performance indexes for dashboard queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_dashboard 
  ON articles(created_at DESC, source, is_ai_enhanced, selected_for_enhancement) 
  WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_category_enhanced 
  ON articles(category, is_ai_enhanced) 
  WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_language_variant 
  ON articles(language_variant, is_ai_enhanced) 
  WHERE deleted_at IS NULL AND is_ai_enhanced = true;

-- Step 2: Create the main RPC function for dashboard metrics
CREATE OR REPLACE FUNCTION get_admin_dashboard_metrics(
  p_timeframe text DEFAULT '24h',
  p_sources text[] DEFAULT ARRAY[]::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
  v_time_boundary timestamptz;
  v_24h_ago timestamptz := NOW() - INTERVAL '24 hours';
  v_1h_ago timestamptz := NOW() - INTERVAL '1 hour';
  v_result jsonb;
  v_time_bucket_interval text;
BEGIN
  -- Calculate time boundary based on timeframe
  v_time_boundary := CASE p_timeframe
    WHEN '2h' THEN NOW() - INTERVAL '2 hours'
    WHEN '6h' THEN NOW() - INTERVAL '6 hours'
    WHEN '24h' THEN NOW() - INTERVAL '24 hours'
    WHEN '7d' THEN NOW() - INTERVAL '7 days'
    WHEN '30d' THEN NOW() - INTERVAL '30 days'
    ELSE NOW() - INTERVAL '24 hours'
  END;
  
  -- Determine time bucket interval for trends
  v_time_bucket_interval := CASE 
    WHEN p_timeframe IN ('2h', '6h') THEN 'hour'
    ELSE 'day'
  END;

  WITH 
  -- Overall statistics
  overall_stats AS (
    SELECT 
      COUNT(*) as total_articles,
      COUNT(*) FILTER (WHERE is_ai_enhanced = true) as ai_enhanced_articles,
      COUNT(*) FILTER (WHERE selected_for_enhancement = true) as selected_for_enhancement,
      COUNT(DISTINCT source) as unique_sources,
      MIN(created_at)::text as earliest_article,
      MAX(created_at)::text as latest_article
    FROM articles
    WHERE deleted_at IS NULL
      AND created_at >= v_time_boundary
      AND (CARDINALITY(p_sources) = 0 OR source = ANY(p_sources))
  ),
  
  -- Pipeline health metrics
  pipeline_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE created_at >= v_24h_ago) as articles_last_24h,
      COUNT(*) FILTER (WHERE created_at >= v_1h_ago) as articles_last_hour,
      COUNT(*) FILTER (WHERE is_ai_enhanced = true AND created_at >= v_24h_ago) as enhanced_last_24h,
      COUNT(*) FILTER (WHERE selected_for_enhancement = true AND created_at >= v_24h_ago) as selected_last_24h,
      COUNT(*) FILTER (WHERE LENGTH(COALESCE(content, '')) < 200) as low_quality_articles,
      AVG(LENGTH(COALESCE(content, '')))::integer as avg_content_length
    FROM articles
    WHERE deleted_at IS NULL
      AND (CARDINALITY(p_sources) = 0 OR source = ANY(p_sources))
  ),
  
  -- Enhanced words statistics by language
  language_stats AS (
    SELECT 
      COALESCE(language_variant, 'mixed') as language,
      COUNT(*) as count,
      -- Estimate word count based on content length (rough approximation)
      AVG(
        CASE 
          WHEN content IS NOT NULL THEN 
            ARRAY_LENGTH(STRING_TO_ARRAY(content, ' '), 1)
          ELSE 0
        END
      )::integer as avg_words,
      SUM(
        CASE 
          WHEN content IS NOT NULL THEN 
            ARRAY_LENGTH(STRING_TO_ARRAY(content, ' '), 1)
          ELSE 0
        END
      )::integer as total_words
    FROM articles
    WHERE deleted_at IS NULL
      AND is_ai_enhanced = true
      AND created_at >= v_time_boundary
      AND (CARDINALITY(p_sources) = 0 OR source = ANY(p_sources))
    GROUP BY COALESCE(language_variant, 'mixed')
  ),
  
  -- Time-based trends for charts
  time_trends_raw AS (
    SELECT 
      date_trunc(v_time_bucket_interval, created_at) as time_bucket,
      source,
      category,
      COUNT(*) as articles_count,
      COUNT(*) FILTER (WHERE selected_for_enhancement = true) as selected_count,
      COUNT(*) FILTER (WHERE is_ai_enhanced = true) as enhanced_count
    FROM articles
    WHERE deleted_at IS NULL
      AND created_at >= v_time_boundary
      AND (CARDINALITY(p_sources) = 0 OR source = ANY(p_sources))
    GROUP BY 1, 2, 3
  ),
  
  -- Aggregate time trends by bucket
  time_trends_aggregated AS (
    SELECT 
      time_bucket,
      jsonb_object_agg(source, articles_count) as source_counts,
      jsonb_object_agg('enhanced_' || category, enhanced_count) FILTER (WHERE enhanced_count > 0) as category_enhanced,
      SUM(articles_count) as articles_scraped,
      SUM(selected_count) as selected_for_enhancement,
      SUM(enhanced_count) as ai_enhanced
    FROM time_trends_raw
    GROUP BY time_bucket
    ORDER BY time_bucket
  ),
  
  -- Source breakdown statistics
  source_stats AS (
    SELECT 
      source,
      COUNT(*) as total_count,
      COUNT(*) as active_count, -- For compatibility
      COUNT(*) FILTER (WHERE selected_for_enhancement = true) as selected_count,
      COUNT(*) FILTER (WHERE is_ai_enhanced = true) as enhanced_count,
      ROUND(
        100.0 * COUNT(*) FILTER (WHERE is_ai_enhanced = true) / NULLIF(COUNT(*), 0), 
        2
      ) as enhancement_rate
    FROM articles
    WHERE deleted_at IS NULL
      AND created_at >= v_time_boundary
      AND (CARDINALITY(p_sources) = 0 OR source = ANY(p_sources))
    GROUP BY source
    ORDER BY total_count DESC
  ),
  
  -- Category distribution
  category_stats AS (
    SELECT 
      category,
      COUNT(*) as count,
      COUNT(*) FILTER (WHERE is_ai_enhanced = true) as enhanced_count,
      ROUND(
        100.0 * COUNT(*) FILTER (WHERE is_ai_enhanced = true) / NULLIF(COUNT(*), 0), 
        2
      ) as enhancement_rate
    FROM articles
    WHERE deleted_at IS NULL
      AND created_at >= v_time_boundary
      AND (CARDINALITY(p_sources) = 0 OR source = ANY(p_sources))
    GROUP BY category
    ORDER BY count DESC
    LIMIT 15
  )
  
  -- Build the final JSON result
  SELECT jsonb_build_object(
    'overall', (
      SELECT jsonb_build_object(
        'total_articles', total_articles,
        'active_articles', total_articles,
        'selected_for_enhancement', selected_for_enhancement,
        'ai_enhanced_articles', ai_enhanced_articles,
        'unique_sources', unique_sources,
        'enhancement_rate', ROUND(
          100.0 * ai_enhanced_articles / NULLIF(total_articles, 0), 
          2
        ),
        'earliest_article', earliest_article,
        'latest_article', latest_article
      ) FROM overall_stats
    ),
    'pipeline', (
      SELECT jsonb_build_object(
        'articles_last_24h', articles_last_24h,
        'articles_last_hour', articles_last_hour,
        'enhanced_last_24h', enhanced_last_24h,
        'selected_last_24h', selected_last_24h,
        'low_quality_articles', low_quality_articles,
        'avg_content_length', avg_content_length,
        'enhanced_words_by_language', COALESCE(
          (
            SELECT jsonb_object_agg(
              language, 
              jsonb_build_object(
                'count', count, 
                'total_words', total_words, 
                'avg_words', avg_words
              )
            ) FROM language_stats
          ), 
          '{}'::jsonb
        )
      ) FROM pipeline_stats
    ),
    'sourceBreakdown', COALESCE(
      (SELECT jsonb_agg(row_to_json(source_stats.*)) FROM source_stats),
      '[]'::jsonb
    ),
    'dailyTrends', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'date', time_bucket::text,
            'time', time_bucket::text,
            'articles_scraped', articles_scraped,
            'selected_for_enhancement', selected_for_enhancement,
            'ai_enhanced', ai_enhanced
          ) || 
          COALESCE(source_counts, '{}'::jsonb) ||
          COALESCE(category_enhanced, '{}'::jsonb)
          ORDER BY time_bucket
        )
        FROM time_trends_aggregated
      ),
      '[]'::jsonb
    ),
    'categoryDistribution', COALESCE(
      (SELECT jsonb_agg(row_to_json(category_stats.*)) FROM category_stats),
      '[]'::jsonb
    ),
    'availableSources', COALESCE(
      (SELECT jsonb_agg(DISTINCT source ORDER BY source) FROM source_stats),
      '[]'::jsonb
    ),
    'availableCategories', COALESCE(
      (SELECT jsonb_agg(DISTINCT category ORDER BY category) FROM category_stats),
      '[]'::jsonb
    ),
    'timeframe', p_timeframe,
    'recordsAnalyzed', (SELECT total_articles FROM overall_stats),
    'generatedAt', NOW()::text,
    'cached', false
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Step 3: Create cache table for storing results
CREATE TABLE IF NOT EXISTS admin_metrics_cache (
  cache_key text PRIMARY KEY,
  timeframe text NOT NULL,
  sources text[],
  result jsonb NOT NULL,
  created_at timestamptz DEFAULT NOW()
);

-- Create index for cache cleanup
CREATE INDEX IF NOT EXISTS idx_metrics_cache_created 
  ON admin_metrics_cache(created_at);

-- Step 4: Create cached version of the function
CREATE OR REPLACE FUNCTION get_cached_admin_metrics(
  p_timeframe text DEFAULT '24h',
  p_sources text[] DEFAULT ARRAY[]::text[],
  p_cache_duration interval DEFAULT INTERVAL '5 minutes'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_cache_key text;
  v_cached_result jsonb;
BEGIN
  -- Generate cache key
  v_cache_key := MD5(
    p_timeframe || '::' || 
    COALESCE(array_to_string(p_sources, ','), 'no-sources')
  );
  
  -- Try to get from cache
  SELECT result INTO v_cached_result
  FROM admin_metrics_cache
  WHERE cache_key = v_cache_key
    AND created_at > NOW() - p_cache_duration;
  
  IF v_cached_result IS NOT NULL THEN
    -- Return cached result with cached flag
    RETURN jsonb_set(v_cached_result, '{cached}', 'true'::jsonb);
  END IF;
  
  -- Get fresh data
  v_cached_result := get_admin_dashboard_metrics(p_timeframe, p_sources);
  
  -- Update cache
  INSERT INTO admin_metrics_cache (cache_key, timeframe, sources, result)
  VALUES (v_cache_key, p_timeframe, p_sources, v_cached_result)
  ON CONFLICT (cache_key) 
  DO UPDATE SET 
    result = EXCLUDED.result, 
    created_at = NOW();
  
  -- Cleanup old cache entries (anything older than 1 hour)
  DELETE FROM admin_metrics_cache 
  WHERE created_at < NOW() - INTERVAL '1 hour';
  
  RETURN v_cached_result;
END;
$$;

-- Step 5: Grant permissions
GRANT EXECUTE ON FUNCTION get_admin_dashboard_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_dashboard_metrics TO anon;
GRANT EXECUTE ON FUNCTION get_cached_admin_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION get_cached_admin_metrics TO anon;

-- Step 6: Create helper function for testing
CREATE OR REPLACE FUNCTION test_admin_metrics()
RETURNS TABLE (
  test_name text,
  execution_time interval,
  result_size integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_start timestamp;
  v_end timestamp;
  v_result jsonb;
BEGIN
  -- Test 1: 24h metrics
  v_start := clock_timestamp();
  v_result := get_admin_dashboard_metrics('24h', ARRAY[]::text[]);
  v_end := clock_timestamp();
  
  RETURN QUERY 
  SELECT 
    '24h All Sources'::text,
    v_end - v_start,
    LENGTH(v_result::text);
  
  -- Test 2: 7d metrics
  v_start := clock_timestamp();
  v_result := get_admin_dashboard_metrics('7d', ARRAY[]::text[]);
  v_end := clock_timestamp();
  
  RETURN QUERY 
  SELECT 
    '7d All Sources'::text,
    v_end - v_start,
    LENGTH(v_result::text);
  
  -- Test 3: 30d metrics
  v_start := clock_timestamp();
  v_result := get_admin_dashboard_metrics('30d', ARRAY[]::text[]);
  v_end := clock_timestamp();
  
  RETURN QUERY 
  SELECT 
    '30d All Sources'::text,
    v_end - v_start,
    LENGTH(v_result::text);
  
  -- Test 4: Cached metrics
  v_start := clock_timestamp();
  v_result := get_cached_admin_metrics('24h', ARRAY[]::text[]);
  v_end := clock_timestamp();
  
  RETURN QUERY 
  SELECT 
    '24h Cached (1st call)'::text,
    v_end - v_start,
    LENGTH(v_result::text);
  
  -- Test 5: Cached metrics (should be from cache)
  v_start := clock_timestamp();
  v_result := get_cached_admin_metrics('24h', ARRAY[]::text[]);
  v_end := clock_timestamp();
  
  RETURN QUERY 
  SELECT 
    '24h Cached (2nd call)'::text,
    v_end - v_start,
    LENGTH(v_result::text);
END;
$$;

-- Grant permission for testing
GRANT EXECUTE ON FUNCTION test_admin_metrics TO authenticated;

-- Add comment explaining the migration
COMMENT ON FUNCTION get_admin_dashboard_metrics IS 
'Optimized RPC function for Admin Dashboard metrics. 
Replaces 15+ individual queries with a single efficient call.
Returns all metrics needed for the Article Pipeline Dashboard.';