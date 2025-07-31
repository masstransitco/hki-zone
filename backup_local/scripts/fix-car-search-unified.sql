-- Fix car search to work with both articles and articles_unified tables
-- This addresses the issue where Jazz cars aren't found because they're in articles_unified

CREATE OR REPLACE FUNCTION search_car_listings_unified(
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
    search_query := left(trim(search_query), 32);
    search_query := regexp_replace(search_query, '[;''\"\\]', '', 'g');
  END IF;
  
  IF result_limit > 100 THEN
    result_limit := 100;
  END IF;
  
  -- Search in both tables and combine results
  RETURN QUERY
  WITH combined_cars AS (
    -- Get cars from articles_unified
    SELECT 
      u.id,
      u.title,
      u.contextual_data->>'make' as make,
      u.contextual_data->>'model' as model,
      COALESCE(u.contextual_data->>'price', '') as price,
      COALESCE(u.contextual_data->>'year', '') as year,
      u.image_url,
      u.images,
      u.url,
      u.published_at as created_at,
      COALESCE(u.contextual_data->>'specs', '{}')::jsonb as specs,
      CASE 
        WHEN search_query IS NOT NULL AND search_query != '' THEN
          greatest(
            -- Search in title
            ts_rank(to_tsvector('simple', COALESCE(u.title, '')), plainto_tsquery('simple', search_query)),
            -- Search in make/model
            similarity(COALESCE(u.contextual_data->>'make', ''), search_query) * 0.8,
            similarity(COALESCE(u.contextual_data->>'model', ''), search_query) * 0.8,
            -- Search in content
            ts_rank(to_tsvector('simple', COALESCE(u.content, '')), plainto_tsquery('simple', search_query)) * 0.6
          )
        ELSE 0.0
      END as rank
    FROM articles_unified u
    WHERE 
      u.category = 'cars'
      AND (
        search_query IS NULL 
        OR search_query = '' 
        OR u.title ILIKE '%' || search_query || '%'
        OR u.contextual_data->>'make' ILIKE '%' || search_query || '%'
        OR u.contextual_data->>'model' ILIKE '%' || search_query || '%'
        OR u.content ILIKE '%' || search_query || '%'
      )
    
    UNION ALL
    
    -- Get cars from articles (legacy)
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
          greatest(
            -- Use existing search_text if available
            COALESCE(ts_rank(a.search_text, plainto_tsquery('simple', search_query)), 0),
            -- Fallback similarity search
            similarity(COALESCE(a.make, ''), search_query) * 0.8,
            similarity(COALESCE(a.model, ''), search_query) * 0.8,
            ts_rank(to_tsvector('simple', COALESCE(a.title, '')), plainto_tsquery('simple', search_query)) * 0.6
          )
        ELSE 0.0
      END as rank
    FROM articles a
    WHERE 
      a.category = 'cars'
      AND (
        search_query IS NULL 
        OR search_query = '' 
        OR a.title ILIKE '%' || search_query || '%'
        OR a.make ILIKE '%' || search_query || '%'
        OR a.model ILIKE '%' || search_query || '%'
        OR a.content ILIKE '%' || search_query || '%'
        OR (a.search_text IS NOT NULL AND a.search_text @@ plainto_tsquery('simple', search_query))
      )
  )
  SELECT 
    c.id, c.title, c.make, c.model, c.price, c.year,
    c.image_url, c.images, c.url, c.created_at, c.specs, c.rank
  FROM combined_cars c
  ORDER BY 
    c.rank DESC, 
    c.created_at DESC
  LIMIT result_limit 
  OFFSET result_offset;
END;
$$ LANGUAGE plpgsql;

-- Update the original function to use the unified version
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
  -- Just call the unified version
  RETURN QUERY
  SELECT * FROM search_car_listings_unified(search_query, result_limit, result_offset);
END;
$$ LANGUAGE plpgsql;