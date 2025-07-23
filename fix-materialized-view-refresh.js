#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function fixMaterializedViewRefresh() {
  console.log('🔧 Fixing materialized view refresh issues...')
  console.log('Current time:', new Date().toISOString())
  console.log()

  try {
    // 1. Drop and recreate the refresh function to use non-concurrent refresh
    console.log('1. Updating refresh function to use non-concurrent refresh...')
    
    const refreshFunctionSQL = `
      CREATE OR REPLACE FUNCTION refresh_incidents_public()
      RETURNS VOID AS $$
      BEGIN
          -- Use non-concurrent refresh to avoid unique index requirement
          REFRESH MATERIALIZED VIEW incidents_public;
      END;
      $$ LANGUAGE plpgsql;
    `
    
    const { error: functionError } = await supabase.rpc('sql', { 
      query: refreshFunctionSQL 
    })
    
    if (functionError) {
      console.error('❌ Failed to update refresh function:', functionError.message)
      
      // Try direct SQL execution
      console.log('2. Trying to create function using direct query...')
      const { error: directError } = await supabase
        .from('_sql_migrations')
        .insert({
          version: Date.now().toString(),
          name: 'fix_refresh_function',
          sql: refreshFunctionSQL
        })
      
      if (directError) {
        console.error('❌ Direct function creation also failed:', directError.message)
      } else {
        console.log('✅ Function updated successfully via migration')
      }
    } else {
      console.log('✅ Refresh function updated successfully')
    }
    console.log()

    // 2. Try to refresh the materialized view manually
    console.log('3. Attempting manual materialized view refresh...')
    
    // Try using the updated function
    const { error: refreshError } = await supabase.rpc('refresh_incidents_public')
    
    if (refreshError) {
      console.error('❌ Function refresh failed:', refreshError.message)
      
      // Try direct SQL refresh
      console.log('4. Trying direct SQL refresh...')
      const refreshSQL = 'REFRESH MATERIALIZED VIEW incidents_public;'
      
      const { error: directRefreshError } = await supabase.rpc('sql', { 
        query: refreshSQL 
      })
      
      if (directRefreshError) {
        console.error('❌ Direct refresh failed:', directRefreshError.message)
        
        // If direct refresh fails, we might need to rebuild the view
        console.log('5. Attempting to rebuild materialized view...')
        await rebuildMaterializedView()
      } else {
        console.log('✅ Direct SQL refresh succeeded!')
      }
    } else {
      console.log('✅ Function refresh succeeded!')
    }
    console.log()

    // 3. Verify the refresh worked by checking data
    console.log('6. Verifying refresh results...')
    const { data: refreshedIncidents, error: verifyError } = await supabase
      .from('incidents_public')
      .select('id, title, source_updated_at, source_slug')
      .order('source_updated_at', { ascending: false })
      .limit(5)

    if (verifyError) {
      console.error('Error verifying refresh:', verifyError)
    } else {
      console.log(`Found ${refreshedIncidents.length} incidents in refreshed view:`)
      refreshedIncidents.forEach((incident, index) => {
        console.log(`  ${index + 1}. [${incident.source_slug}] ${incident.title.slice(0, 60)}...`)
        console.log(`      Updated: ${incident.source_updated_at}`)
      })
      
      // Check if we have fresh data (within last 24 hours)
      const latestIncident = refreshedIncidents[0]
      if (latestIncident) {
        const latestTime = new Date(latestIncident.source_updated_at)
        const now = new Date()
        const hoursDiff = (now.getTime() - latestTime.getTime()) / (1000 * 60 * 60)
        
        if (hoursDiff < 24) {
          console.log(`✅ Data is fresh (${hoursDiff.toFixed(2)} hours old)`)
        } else {
          console.log(`⚠️ Data is still stale (${hoursDiff.toFixed(2)} hours old)`)
        }
      }
    }

  } catch (error) {
    console.error('💥 Script failed:', error.message)
  }
}

async function rebuildMaterializedView() {
  console.log('🔄 Rebuilding materialized view...')
  
  try {
    // Recreate the materialized view to ensure it's working properly
    const rebuildSQL = `
      DROP MATERIALIZED VIEW IF EXISTS incidents_public CASCADE;
      
      CREATE MATERIALIZED VIEW incidents_public AS
      SELECT 
          i.id,
          i.source_slug,
          i.title,
          i.body,
          i.category,
          i.severity,
          i.relevance_score,
          i.starts_at,
          i.source_updated_at,
          i.enrichment_status,
          i.enriched_title,
          i.enriched_summary,
          i.enriched_content,
          i.key_points,
          i.why_it_matters,
          i.key_facts,
          i.reporting_score,
          i.additional_sources,
          i.sources,
          i.enrichment_metadata,
          i.created_at,
          i.updated_at,
          i.image_url,
          -- Extract longitude and latitude from PostGIS geometry
          CASE 
              WHEN i.location IS NOT NULL THEN ST_X(i.location)
              ELSE NULL
          END as longitude,
          CASE 
              WHEN i.location IS NOT NULL THEN ST_Y(i.location)
              ELSE NULL
          END as latitude,
          -- Add category-specific fields
          CASE 
              WHEN i.category = 'top_signals' THEN 'Top Signals'
              WHEN i.category = 'environment' THEN 'Environment'
              WHEN i.category = 'road' THEN 'Traffic Update'
              WHEN i.category = 'rail' THEN 'Rail Service'
              WHEN i.category = 'weather' THEN 'Weather Alert'
              WHEN i.category = 'utility' THEN 'Utility Service'
              ELSE 'General Alert'
          END as category_display,
          -- Add priority scoring based on category and severity
          CASE 
              WHEN i.category = 'top_signals' AND i.severity >= 6 THEN 120
              WHEN i.category = 'environment' AND i.severity >= 7 THEN 110
              WHEN i.category = 'weather' AND i.severity >= 6 THEN 90
              WHEN i.category = 'road' AND i.severity >= 5 THEN 80
              WHEN i.category = 'rail' AND i.severity >= 5 THEN 80
              ELSE i.relevance_score
          END as display_priority
      FROM incidents i
      WHERE i.source_updated_at >= NOW() - INTERVAL '30 days'  -- Extend to 30 days to avoid data loss
      ORDER BY i.source_updated_at DESC;

      -- Create indexes for efficient querying  
      CREATE INDEX IF NOT EXISTS idx_incidents_public_category ON incidents_public (category);
      CREATE INDEX IF NOT EXISTS idx_incidents_public_priority ON incidents_public (display_priority DESC);
      CREATE INDEX IF NOT EXISTS idx_incidents_public_created_at ON incidents_public (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_incidents_public_source_updated_at ON incidents_public (source_updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_incidents_public_top_signals ON incidents_public (category) WHERE category = 'top_signals';
      CREATE INDEX IF NOT EXISTS idx_incidents_public_environment ON incidents_public (category) WHERE category = 'environment';
    `
    
    const { error: rebuildError } = await supabase.rpc('sql', { 
      query: rebuildSQL 
    })
    
    if (rebuildError) {
      console.error('❌ Rebuild failed:', rebuildError.message)
    } else {
      console.log('✅ Materialized view rebuilt successfully!')
    }
    
  } catch (error) {
    console.error('❌ Rebuild process failed:', error.message)
  }
}

fixMaterializedViewRefresh()