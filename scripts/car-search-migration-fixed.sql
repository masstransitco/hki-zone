-- Car Search Migration: Enable fast text search for make/model
-- Fixed version that adds missing columns first

-- 1. Enable fuzzy matching extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Add missing columns to articles table for car support
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS images JSONB;

ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS specs JSONB;

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_articles_images ON articles USING gin(images)
WHERE category = 'cars';

CREATE INDEX IF NOT EXISTS idx_articles_specs ON articles USING gin(specs)
WHERE category = 'cars';

-- 3. Add computed columns for normalized make/model
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS make TEXT GENERATED ALWAYS AS (
  CASE 
    WHEN category = 'cars' THEN 
      COALESCE(
        (specs->>'車廠')::text,
        (specs->>'make')::text,
        split_part(trim(title), ' ', 1)
      )
    ELSE NULL
  END
) STORED;

ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS model TEXT GENERATED ALWAYS AS (
  CASE 
    WHEN category = 'cars' THEN 
      COALESCE(
        (specs->>'型號')::text,
        (specs->>'model')::text,
        trim(substring(title from position(' ' in title) + 1))
      )
    ELSE NULL
  END
) STORED;

-- 4. Add search_text tsvector column for full-text search
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS search_text tsvector GENERATED ALWAYS AS (
  CASE 
    WHEN category = 'cars' THEN
      setweight(to_tsvector('simple', coalesce(make, '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(model, '')), 'B') ||
      setweight(to_tsvector('simple', coalesce(title, '')), 'C')
    ELSE NULL
  END
) STORED;

-- 5. Create optimized indexes
-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_articles_search_text ON articles USING gin (search_text)
WHERE category = 'cars';

-- Trigram indexes for prefix matching and typo tolerance
CREATE INDEX IF NOT EXISTS idx_articles_make_trgm ON articles USING gin (make gin_trgm_ops)
WHERE category = 'cars';

CREATE INDEX IF NOT EXISTS idx_articles_model_trgm ON articles USING gin (model gin_trgm_ops)
WHERE category = 'cars';

-- Additional performance indexes
CREATE INDEX IF NOT EXISTS idx_articles_cars_price ON articles((specs->>'售價'))
WHERE category = 'cars';

CREATE INDEX IF NOT EXISTS idx_articles_cars_year ON articles((specs->>'年份'))
WHERE category = 'cars';

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_articles_cars_category_created ON articles(category, created_at DESC)
WHERE category = 'cars';

-- 6. Create search function with input validation
CREATE OR REPLACE FUNCTION search_car_listings(
  search_query TEXT DEFAULT NULL,
  result_limit INTEGER DEFAULT 30,
  result_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  title TEXT,
  make TEXT,
  model TEXT,
  price TEXT,
  year TEXT,
  image_url TEXT,
  images JSONB,
  url TEXT,
  created_at TIMESTAMPTZ,
  specs JSONB,
  rank REAL
) 
SECURITY DEFINER
AS $$
BEGIN
  -- Input validation
  IF search_query IS NOT NULL THEN
    -- Limit query length and sanitize
    search_query := left(trim(search_query), 32);
    -- Remove potential SQL injection patterns
    search_query := regexp_replace(search_query, '[;''\"\\]', '', 'g');
  END IF;
  
  IF result_limit > 100 THEN
    result_limit := 100;
  END IF;

  RETURN QUERY
  SELECT 
    a.id,
    a.title,
    a.make,
    a.model,
    COALESCE((a.specs->>'售價')::text, (a.specs->>'price')::text, '') as price,
    COALESCE((a.specs->>'年份')::text, (a.specs->>'year')::text, '') as year,
    a.image_url,
    a.images,
    a.url,
    a.created_at,
    a.specs,
    CASE 
      WHEN search_query IS NOT NULL AND search_query != '' THEN
        ts_rank(a.search_text, plainto_tsquery('simple', search_query))
      ELSE 0.0
    END as rank
  FROM articles a
  WHERE 
    a.category = 'cars'
    AND (
      search_query IS NULL 
      OR search_query = ''
      OR a.search_text @@ plainto_tsquery('simple', search_query)
    )
  ORDER BY 
    CASE 
      WHEN search_query IS NOT NULL AND search_query != '' THEN rank 
      ELSE 0 
    END DESC,
    a.created_at DESC
  LIMIT result_limit
  OFFSET result_offset;
END;
$$ LANGUAGE plpgsql;

-- 7. Create autocomplete function for live suggestions
CREATE OR REPLACE FUNCTION get_car_suggestions(
  search_query TEXT,
  suggestion_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
  suggestion TEXT,
  type TEXT,
  count BIGINT
) 
SECURITY DEFINER
AS $$
BEGIN
  -- Input validation
  search_query := left(trim(search_query), 32);
  search_query := regexp_replace(search_query, '[;''\"\\]', '', 'g');
  
  IF suggestion_limit > 20 THEN
    suggestion_limit := 20;
  END IF;

  RETURN QUERY
  (
    -- Make suggestions
    SELECT 
      a.make as suggestion,
      'make'::text as type,
      COUNT(*) as count
    FROM articles a
    WHERE 
      a.category = 'cars'
      AND a.make IS NOT NULL
      AND a.make ILIKE search_query || '%'
    GROUP BY a.make
    ORDER BY count DESC, a.make
    LIMIT suggestion_limit / 2
  )
  UNION ALL
  (
    -- Model suggestions
    SELECT 
      a.model as suggestion,
      'model'::text as type,
      COUNT(*) as count
    FROM articles a
    WHERE 
      a.category = 'cars'
      AND a.model IS NOT NULL
      AND a.model ILIKE search_query || '%'
    GROUP BY a.model
    ORDER BY count DESC, a.model
    LIMIT suggestion_limit / 2
  )
  ORDER BY count DESC, suggestion;
END;
$$ LANGUAGE plpgsql;

-- 8. Create function to get filter options
CREATE OR REPLACE FUNCTION get_car_filters()
RETURNS TABLE(
  makes JSONB,
  years JSONB,
  price_ranges JSONB
) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'value', make_data.make,
          'label', make_data.make,
          'count', make_data.count
        )
        ORDER BY make_data.count DESC, make_data.make
      )
      FROM (
        SELECT 
          a.make,
          COUNT(*) as count
        FROM articles a
        WHERE 
          a.category = 'cars'
          AND a.make IS NOT NULL
          AND a.make != ''
        GROUP BY a.make
        HAVING COUNT(*) > 0
      ) make_data
    ) as makes,
    
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'value', year_data.year,
          'label', year_data.year,
          'count', year_data.count
        )
        ORDER BY year_data.year DESC
      )
      FROM (
        SELECT 
          COALESCE((a.specs->>'年份')::text, (a.specs->>'year')::text) as year,
          COUNT(*) as count
        FROM articles a
        WHERE 
          a.category = 'cars'
          AND (
            (a.specs->>'年份') IS NOT NULL OR 
            (a.specs->>'year') IS NOT NULL
          )
          AND COALESCE((a.specs->>'年份')::text, (a.specs->>'year')::text) != ''
        GROUP BY COALESCE((a.specs->>'年份')::text, (a.specs->>'year')::text)
        HAVING COUNT(*) > 0
      ) year_data
    ) as years,
    
    jsonb_build_object(
      'under_100k', (
        SELECT COUNT(*) FROM articles a 
        WHERE a.category = 'cars' 
        AND (
          regexp_replace(COALESCE((a.specs->>'售價'), (a.specs->>'price'), '0'), '[^0-9]', '', 'g')::int < 100000
        )
      ),
      'range_100_300k', (
        SELECT COUNT(*) FROM articles a 
        WHERE a.category = 'cars' 
        AND (
          regexp_replace(COALESCE((a.specs->>'售價'), (a.specs->>'price'), '0'), '[^0-9]', '', 'g')::int BETWEEN 100000 AND 299999
        )
      ),
      'range_300_500k', (
        SELECT COUNT(*) FROM articles a 
        WHERE a.category = 'cars' 
        AND (
          regexp_replace(COALESCE((a.specs->>'售價'), (a.specs->>'price'), '0'), '[^0-9]', '', 'g')::int BETWEEN 300000 AND 499999
        )
      ),
      'range_500k_1m', (
        SELECT COUNT(*) FROM articles a 
        WHERE a.category = 'cars' 
        AND (
          regexp_replace(COALESCE((a.specs->>'售價'), (a.specs->>'price'), '0'), '[^0-9]', '', 'g')::int BETWEEN 500000 AND 999999
        )
      ),
      'over_1m', (
        SELECT COUNT(*) FROM articles a 
        WHERE a.category = 'cars' 
        AND (
          regexp_replace(COALESCE((a.specs->>'售價'), (a.specs->>'price'), '0'), '[^0-9]', '', 'g')::int >= 1000000
        )
      )
    ) as price_ranges;
END;
$$ LANGUAGE plpgsql;

-- 9. Add comments for documentation
COMMENT ON COLUMN articles.images IS 'Array of image URLs for car photos, stored as JSONB';
COMMENT ON COLUMN articles.specs IS 'Car specifications and details, stored as JSONB';
COMMENT ON COLUMN articles.make IS 'Computed car make for fast search, extracted from title or specs';
COMMENT ON COLUMN articles.model IS 'Computed car model for fast search, extracted from title or specs';
COMMENT ON COLUMN articles.search_text IS 'Full-text search vector for make/model/title with weights';
COMMENT ON FUNCTION search_car_listings IS 'Main search function with input validation and ranking';
COMMENT ON FUNCTION get_car_suggestions IS 'Autocomplete suggestions for make/model with prefix matching';
COMMENT ON FUNCTION get_car_filters IS 'Returns available filter options for search UI';

-- 10. Grant permissions
GRANT EXECUTE ON FUNCTION search_car_listings TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_car_suggestions TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_car_filters TO anon, authenticated;