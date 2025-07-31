import dotenv from 'dotenv'
dotenv.config({ path: '.env.cli' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function runSQL(sql: string, description: string) {
  console.log(`\n${description}...`)
  try {
    const { error } = await supabase.rpc('query', { query_text: sql })
    if (error) {
      // Try direct execution if RPC doesn't work
      const { error: directError } = await supabase.from('_sql').select(sql)
      if (directError) {
        console.error('Error:', directError)
        return false
      }
    }
    console.log('✓ Success')
    return true
  } catch (err) {
    console.error('Error:', err)
    return false
  }
}

async function executeDirectSQL() {
  console.log('Executing database fixes directly...')
  
  // 1. Update the database function with slug
  const updateFunctionSQL = `
DROP FUNCTION IF EXISTS get_incidents_with_language;

CREATE OR REPLACE FUNCTION get_incidents_with_language(
  p_language TEXT DEFAULT 'en',
  p_category TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  feed_id UUID,
  feed_name TEXT,
  feed_slug TEXT,
  title TEXT,
  body TEXT,
  link TEXT,
  source_published_at TIMESTAMPTZ,
  category TEXT,
  severity INTEGER,
  relevance_score DECIMAL,
  has_translation BOOLEAN,
  original_language TEXT,
  enrichment_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH feed_info AS (
    SELECT 
      f.id,
      f.base_slug,
      CASE 
        WHEN p_language = 'zh-TW' THEN COALESCE(f.name_zh_tw, f.name_en)
        WHEN p_language = 'zh-CN' THEN COALESCE(f.name_zh_cn, f.name_zh_tw, f.name_en)
        ELSE f.name_en
      END as display_name
    FROM gov_feeds_unified f
  )
  SELECT 
    i.id,
    i.feed_id,
    fi.display_name as feed_name,
    fi.base_slug as feed_slug,
    
    -- Get title with fallback
    CASE 
      WHEN p_language = 'en' THEN 
        i.content->'en'->>'title'
      WHEN p_language = 'zh-TW' THEN 
        COALESCE(
          i.content->'zh-TW'->>'title',
          i.content->'zh-CN'->>'title',
          i.content->'en'->>'title'
        )
      WHEN p_language = 'zh-CN' THEN 
        COALESCE(
          i.content->'zh-CN'->>'title',
          i.content->'zh-TW'->>'title',
          i.content->'en'->>'title'
        )
    END as title,
    
    -- Get body with fallback
    CASE 
      WHEN p_language = 'en' THEN 
        i.content->'en'->>'body'
      WHEN p_language = 'zh-TW' THEN 
        COALESCE(
          i.content->'zh-TW'->>'body',
          i.content->'zh-CN'->>'body',
          i.content->'en'->>'body'
        )
      WHEN p_language = 'zh-CN' THEN 
        COALESCE(
          i.content->'zh-CN'->>'body',
          i.content->'zh-TW'->>'body',
          i.content->'en'->>'body'
        )
    END as body,
    
    -- Get link with fallback
    CASE 
      WHEN p_language = 'en' THEN 
        i.content->'en'->>'link'
      WHEN p_language = 'zh-TW' THEN 
        COALESCE(
          i.content->'zh-TW'->>'link',
          i.content->'zh-CN'->>'link',
          i.content->'en'->>'link'
        )
      WHEN p_language = 'zh-CN' THEN 
        COALESCE(
          i.content->'zh-CN'->>'link',
          i.content->'zh-TW'->>'link',
          i.content->'en'->>'link'
        )
    END as link,
    
    i.source_published_at,
    i.category,
    i.severity,
    i.relevance_score,
    
    -- Check if requested language is available
    CASE 
      WHEN p_language = 'en' THEN i.content ? 'en'
      WHEN p_language = 'zh-TW' THEN i.content ? 'zh-TW'
      WHEN p_language = 'zh-CN' THEN i.content ? 'zh-CN'
    END as has_translation,
    
    -- Detect actual content language for the returned result
    CASE 
      WHEN p_language = 'en' AND (i.content ? 'en') THEN 'en'
      WHEN p_language = 'zh-TW' AND (i.content ? 'zh-TW') THEN 'zh-TW'
      WHEN p_language = 'zh-TW' AND NOT (i.content ? 'zh-TW') AND (i.content ? 'zh-CN') THEN 'zh-CN'
      WHEN p_language = 'zh-CN' AND (i.content ? 'zh-CN') THEN 'zh-CN'
      WHEN p_language = 'zh-CN' AND NOT (i.content ? 'zh-CN') AND (i.content ? 'zh-TW') THEN 'zh-TW'
      ELSE CASE
        WHEN i.content ? 'en' THEN 'en'
        WHEN i.content ? 'zh-TW' THEN 'zh-TW'
        WHEN i.content ? 'zh-CN' THEN 'zh-CN'
      END
    END as original_language,
    
    i.enrichment_status
    
  FROM incidents_unified i
  JOIN feed_info fi ON fi.id = i.feed_id
  WHERE 
    -- Category filter
    (p_category IS NULL OR i.category = p_category)
    -- Only show from last 7 days
    AND i.source_published_at > NOW() - INTERVAL '7 days'
  ORDER BY 
    i.source_published_at DESC,
    i.relevance_score DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;`

  // 2. Create duplicate check function
  const duplicateCheckSQL = `
CREATE OR REPLACE FUNCTION get_duplicate_incidents()
RETURNS TABLE (
  source_published_at TIMESTAMPTZ,
  feed_slug TEXT,
  incident_count BIGINT,
  incident_ids UUID[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.source_published_at,
    f.base_slug as feed_slug,
    COUNT(*) as incident_count,
    array_agg(i.id) as incident_ids
  FROM incidents_unified i
  JOIN gov_feeds_unified f ON f.id = i.feed_id
  GROUP BY i.source_published_at, f.base_slug
  HAVING COUNT(*) > 1
  ORDER BY i.source_published_at DESC;
END;
$$ LANGUAGE plpgsql;`

  // Execute using Postgres client instead
  console.log('Using direct Postgres connection...')
  
  const { Client } = await import('pg')
  const client = new Client({
    connectionString: process.env.POSTGRES_URL,
    ssl: {
      rejectUnauthorized: false
    }
  })
  
  try {
    await client.connect()
    
    // Update function
    console.log('\nUpdating database function...')
    await client.query(updateFunctionSQL)
    console.log('✓ Function updated')
    
    // Create duplicate check
    console.log('\nCreating duplicate check function...')
    await client.query(duplicateCheckSQL)
    console.log('✓ Duplicate check function created')
    
    // Check current duplicates
    console.log('\nChecking for duplicates...')
    const dupResult = await client.query('SELECT * FROM get_duplicate_incidents() LIMIT 10')
    console.log(`Found ${dupResult.rowCount} duplicate incident groups`)
    
    if (dupResult.rows.length > 0) {
      console.log('\nExample duplicates:')
      dupResult.rows.forEach(row => {
        console.log(`  ${row.feed_slug} at ${row.source_published_at}: ${row.incident_count} copies`)
      })
    }
    
  } finally {
    await client.end()
  }
}

executeDirectSQL().catch(console.error)