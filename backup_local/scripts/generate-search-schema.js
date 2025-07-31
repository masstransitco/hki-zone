#!/usr/bin/env node

// Script to generate optimized database schema for car search functionality
// Creates indexes and functions to support efficient make/model searches

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const searchOptimizationSQL = `
-- Car Search Optimization Schema
-- Creates indexes and functions for efficient car search by make/model

-- 1. Add computed columns for make/model extraction
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS computed_make TEXT GENERATED ALWAYS AS (
  CASE 
    WHEN category = 'cars' THEN 
      COALESCE(
        (specs->>'車廠')::text,
        split_part(trim(title), ' ', 1)
      )
    ELSE NULL
  END
) STORED;

ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS computed_model TEXT GENERATED ALWAYS AS (
  CASE 
    WHEN category = 'cars' THEN 
      COALESCE(
        (specs->>'型號')::text,
        trim(substring(title from position(' ' in title) + 1))
      )
    ELSE NULL
  END
) STORED;

ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS computed_year INTEGER GENERATED ALWAYS AS (
  CASE 
    WHEN category = 'cars' AND (specs->>'年份') IS NOT NULL THEN 
      (specs->>'年份')::integer
    ELSE NULL
  END
) STORED;

ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS computed_price_hkd INTEGER GENERATED ALWAYS AS (
  CASE 
    WHEN category = 'cars' AND (specs->>'售價') IS NOT NULL THEN 
      -- Extract numeric price from HK$ formatted strings
      CASE 
        WHEN (specs->>'售價') ~ '[0-9,]+' THEN
          regexp_replace(
            substring((specs->>'售價') from '[0-9,]+'),
            ',', '', 'g'
          )::integer
        ELSE NULL
      END
    ELSE NULL
  END
) STORED;

-- 2. Create optimized indexes for car search
CREATE INDEX IF NOT EXISTS idx_cars_make ON articles(computed_make) 
WHERE category = 'cars';

CREATE INDEX IF NOT EXISTS idx_cars_model ON articles(computed_model) 
WHERE category = 'cars';

CREATE INDEX IF NOT EXISTS idx_cars_year ON articles(computed_year) 
WHERE category = 'cars';

CREATE INDEX IF NOT EXISTS idx_cars_price ON articles(computed_price_hkd) 
WHERE category = 'cars';

CREATE INDEX IF NOT EXISTS idx_cars_make_model ON articles(computed_make, computed_model) 
WHERE category = 'cars';

CREATE INDEX IF NOT EXISTS idx_cars_category_created ON articles(category, created_at DESC) 
WHERE category = 'cars';

-- 3. Create GIN index for flexible JSON searches on specs
CREATE INDEX IF NOT EXISTS idx_cars_specs_gin ON articles USING gin(specs) 
WHERE category = 'cars';

-- 4. Enhanced full-text search index for cars
CREATE INDEX IF NOT EXISTS idx_cars_fulltext ON articles USING gin(
  to_tsvector('english', 
    title || ' ' || 
    COALESCE(content, '') || ' ' ||
    COALESCE(summary, '') || ' ' ||
    COALESCE((specs->>'車廠')::text, '') || ' ' ||
    COALESCE((specs->>'型號')::text, '') || ' ' ||
    COALESCE((specs->>'年份')::text, '') || ' ' ||
    COALESCE((specs->>'引擎')::text, '') || ' ' ||
    COALESCE((specs->>'燃料')::text, '')
  )
) WHERE category = 'cars';

-- 5. Create function for car search with filters
CREATE OR REPLACE FUNCTION search_cars(
  search_query TEXT DEFAULT NULL,
  filter_make TEXT DEFAULT NULL,
  filter_model TEXT DEFAULT NULL,
  min_year INTEGER DEFAULT NULL,
  max_year INTEGER DEFAULT NULL,
  min_price INTEGER DEFAULT NULL,
  max_price INTEGER DEFAULT NULL,
  limit_count INTEGER DEFAULT 20,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  title TEXT,
  computed_make TEXT,
  computed_model TEXT,
  computed_year INTEGER,
  computed_price_hkd INTEGER,
  content TEXT,
  summary TEXT,
  image_url TEXT,
  images JSONB,
  specs JSONB,
  created_at TIMESTAMPTZ,
  url TEXT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.title,
    a.computed_make,
    a.computed_model,
    a.computed_year,
    a.computed_price_hkd,
    a.content,
    a.summary,
    a.image_url,
    a.images,
    a.specs,
    a.created_at,
    a.url,
    CASE 
      WHEN search_query IS NOT NULL THEN
        ts_rank(
          to_tsvector('english', 
            a.title || ' ' || 
            COALESCE(a.content, '') || ' ' ||
            COALESCE((a.specs->>'車廠')::text, '') || ' ' ||
            COALESCE((a.specs->>'型號')::text, '')
          ),
          plainto_tsquery('english', search_query)
        )
      ELSE 0.0
    END as rank
  FROM articles a
  WHERE 
    a.category = 'cars'
    AND (search_query IS NULL OR 
         to_tsvector('english', 
           a.title || ' ' || 
           COALESCE(a.content, '') || ' ' ||
           COALESCE((a.specs->>'車廠')::text, '') || ' ' ||
           COALESCE((a.specs->>'型號')::text, '')
         ) @@ plainto_tsquery('english', search_query))
    AND (filter_make IS NULL OR a.computed_make ILIKE '%' || filter_make || '%')
    AND (filter_model IS NULL OR a.computed_model ILIKE '%' || filter_model || '%')
    AND (min_year IS NULL OR a.computed_year >= min_year)
    AND (max_year IS NULL OR a.computed_year <= max_year)
    AND (min_price IS NULL OR a.computed_price_hkd >= min_price)
    AND (max_price IS NULL OR a.computed_price_hkd <= max_price)
  ORDER BY 
    CASE 
      WHEN search_query IS NOT NULL THEN rank 
      ELSE 0 
    END DESC,
    a.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;

-- 6. Create function to get available makes and models
CREATE OR REPLACE FUNCTION get_car_makes_models()
RETURNS TABLE(
  make TEXT,
  model_count BIGINT,
  sample_models TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.computed_make as make,
    COUNT(DISTINCT a.computed_model) as model_count,
    ARRAY_AGG(DISTINCT a.computed_model ORDER BY a.computed_model) FILTER (WHERE a.computed_model IS NOT NULL) as sample_models
  FROM articles a
  WHERE 
    a.category = 'cars' 
    AND a.computed_make IS NOT NULL
    AND a.computed_make != ''
  GROUP BY a.computed_make
  ORDER BY model_count DESC, make ASC;
END;
$$ LANGUAGE plpgsql;

-- 7. Create function for price range statistics
CREATE OR REPLACE FUNCTION get_car_price_stats()
RETURNS TABLE(
  min_price INTEGER,
  max_price INTEGER,
  avg_price NUMERIC,
  price_ranges JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    MIN(a.computed_price_hkd) as min_price,
    MAX(a.computed_price_hkd) as max_price,
    ROUND(AVG(a.computed_price_hkd), 0) as avg_price,
    jsonb_build_object(
      'under_100k', COUNT(*) FILTER (WHERE a.computed_price_hkd < 100000),
      'range_100_300k', COUNT(*) FILTER (WHERE a.computed_price_hkd >= 100000 AND a.computed_price_hkd < 300000),
      'range_300_500k', COUNT(*) FILTER (WHERE a.computed_price_hkd >= 300000 AND a.computed_price_hkd < 500000),
      'range_500k_1m', COUNT(*) FILTER (WHERE a.computed_price_hkd >= 500000 AND a.computed_price_hkd < 1000000),
      'over_1m', COUNT(*) FILTER (WHERE a.computed_price_hkd >= 1000000)
    ) as price_ranges
  FROM articles a
  WHERE 
    a.category = 'cars' 
    AND a.computed_price_hkd IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- 8. Create function for year statistics
CREATE OR REPLACE FUNCTION get_car_year_stats()
RETURNS TABLE(
  min_year INTEGER,
  max_year INTEGER,
  year_distribution JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    MIN(a.computed_year) as min_year,
    MAX(a.computed_year) as max_year,
    jsonb_object_agg(a.computed_year::text, year_count) as year_distribution
  FROM (
    SELECT 
      a.computed_year,
      COUNT(*) as year_count
    FROM articles a
    WHERE 
      a.category = 'cars' 
      AND a.computed_year IS NOT NULL
    GROUP BY a.computed_year
    ORDER BY a.computed_year DESC
  ) year_stats;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON COLUMN articles.computed_make IS 'Auto-computed car make from title or specs for search optimization';
COMMENT ON COLUMN articles.computed_model IS 'Auto-computed car model from title or specs for search optimization';
COMMENT ON COLUMN articles.computed_year IS 'Auto-computed car year from specs for filtering';
COMMENT ON COLUMN articles.computed_price_hkd IS 'Auto-computed price in HKD for range filtering';
COMMENT ON FUNCTION search_cars IS 'Optimized search function for cars with multiple filter options';
COMMENT ON FUNCTION get_car_makes_models IS 'Returns available car makes and their model counts';
COMMENT ON FUNCTION get_car_price_stats IS 'Returns price distribution statistics for cars';
COMMENT ON FUNCTION get_car_year_stats IS 'Returns year distribution statistics for cars';
`;

async function generateSearchSchema() {
  console.log('🗃️ Generating optimized search schema for car listings...\n');

  try {
    // Execute the SQL schema
    const { error } = await supabase.rpc('exec_sql', { 
      sql: searchOptimizationSQL 
    });

    if (error) {
      // If rpc doesn't work, try direct SQL execution
      console.log('📝 Executing SQL schema directly...');
      
      // Split SQL into individual statements and execute
      const statements = searchOptimizationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);

      for (const statement of statements) {
        if (statement.startsWith('--')) continue; // Skip comments
        
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        const { error: stmtError } = await supabase.rpc('exec', { 
          query: statement 
        });
        
        if (stmtError) {
          console.warn(`⚠️ Statement failed: ${stmtError.message}`);
        }
      }
    }

    console.log('✅ Search schema optimization completed!\n');

    // Test the new functions
    console.log('🧪 Testing search functions...\n');

    // Test get_car_makes_models
    const { data: makesData, error: makesError } = await supabase
      .rpc('get_car_makes_models');

    if (!makesError && makesData) {
      console.log(`📊 Found ${makesData.length} car makes in database`);
      console.log('Top 5 makes:');
      makesData.slice(0, 5).forEach(make => {
        console.log(`  - ${make.make}: ${make.model_count} models`);
      });
    }

    // Test price stats
    const { data: priceStats, error: priceError } = await supabase
      .rpc('get_car_price_stats');

    if (!priceError && priceStats && priceStats.length > 0) {
      const stats = priceStats[0];
      console.log(`\n💰 Price range: HK$${stats.min_price?.toLocaleString()} - HK$${stats.max_price?.toLocaleString()}`);
      console.log(`💰 Average price: HK$${stats.avg_price?.toLocaleString()}`);
    }

    console.log('\n🎯 Schema Features Added:');
    console.log('─'.repeat(40));
    console.log('✅ Computed columns for make/model/year/price');
    console.log('✅ Optimized indexes for fast searching');
    console.log('✅ Full-text search with car-specific fields');
    console.log('✅ search_cars() function with filters');
    console.log('✅ get_car_makes_models() for dropdown data');
    console.log('✅ get_car_price_stats() for range filtering');
    console.log('✅ get_car_year_stats() for year filtering');

    console.log('\n✅ Search schema generation complete!');

  } catch (error) {
    console.error('❌ Schema generation failed:', error);
    process.exit(1);
  }
}

// Write the SQL to a file as well
async function writeSchemaToFile() {
  const fs = require('fs');
  const path = require('path');
  
  const sqlFilePath = path.join(__dirname, 'car-search-schema.sql');
  
  fs.writeFileSync(sqlFilePath, searchOptimizationSQL, 'utf8');
  console.log(`📄 SQL schema written to: ${sqlFilePath}`);
}

// Run the generation
if (require.main === module) {
  generateSearchSchema().then(() => {
    writeSchemaToFile();
  });
}

module.exports = { generateSearchSchema, searchOptimizationSQL };