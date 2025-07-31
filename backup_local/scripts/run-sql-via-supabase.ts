import dotenv from 'dotenv'
dotenv.config({ path: '.env.cli' })

async function executeSQLCommands() {
  console.log('Executing SQL commands via Supabase Dashboard API...')
  
  const projectRef = 'egyuetfeubznhcvmtary' // from the URL
  const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  // SQL commands to execute
  const commands = [
    {
      name: 'Update database function with slug',
      sql: `DROP FUNCTION IF EXISTS get_incidents_with_language;

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
    i.content->'en'->>'title',
    i.content->'en'->>'body',
    i.content->'en'->>'link',
    i.source_published_at,
    i.category,
    i.severity,
    i.relevance_score,
    i.content ? 'en',
    CASE 
      WHEN i.content ? 'en' THEN 'en'
      WHEN i.content ? 'zh-TW' THEN 'zh-TW'
      WHEN i.content ? 'zh-CN' THEN 'zh-CN'
    END,
    i.enrichment_status
  FROM incidents_unified i
  JOIN feed_info fi ON fi.id = i.feed_id
  WHERE 
    p_language = 'en'
    AND (p_category IS NULL OR i.category = p_category)
    AND i.source_published_at > NOW() - INTERVAL '7 days'
  ORDER BY 
    i.source_published_at DESC,
    i.relevance_score DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;`
    },
    {
      name: 'Create duplicate check function',
      sql: `CREATE OR REPLACE FUNCTION get_duplicate_incidents()
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
    }
  ]
  
  console.log('\nNote: Please run these SQL commands directly in your Supabase SQL editor:')
  console.log('https://supabase.com/dashboard/project/egyuetfeubznhcvmtary/sql/new\n')
  
  commands.forEach((cmd, idx) => {
    console.log(`\n-- ${idx + 1}. ${cmd.name} --`)
    console.log(cmd.sql)
    console.log('\n' + '='.repeat(80))
  })
}

executeSQLCommands().catch(console.error)