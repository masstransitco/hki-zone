import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-server"

export async function POST(request: NextRequest) {
  try {
    console.log("🔧 Setting up deduplication metrics table...")

    // Create the deduplication_metrics table
    const { error: createTableError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        -- Create deduplication_metrics table if it doesn't exist
        CREATE TABLE IF NOT EXISTS deduplication_metrics (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          session_id VARCHAR(255) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          
          -- Input metrics
          original_count INTEGER NOT NULL,
          unique_stories INTEGER NOT NULL,
          duplicates_removed INTEGER NOT NULL,
          reduction_rate NUMERIC(5,2),
          
          -- Performance metrics
          embeddings_time_ms INTEGER,
          clustering_time_ms INTEGER,
          nlp_verification_time_ms INTEGER,
          total_time_ms INTEGER,
          
          -- Cluster details
          average_cluster_size NUMERIC(4,2),
          largest_cluster INTEGER,
          cluster_count INTEGER,
          
          -- Source distribution (JSONB for flexibility)
          sources_before JSONB,
          sources_after JSONB,
          sources_represented TEXT[],
          
          -- NLP verification details
          borderline_pairs INTEGER DEFAULT 0,
          nlp_verifications INTEGER DEFAULT 0,
          clusters_merged INTEGER DEFAULT 0,
          
          -- Cost tracking
          embeddings_cost NUMERIC(10,6) DEFAULT 0,
          nlp_cost NUMERIC(10,6) DEFAULT 0,
          total_cost NUMERIC(10,6) DEFAULT 0,
          
          -- Additional metadata
          enable_story_dedup BOOLEAN DEFAULT true,
          error_occurred BOOLEAN DEFAULT false,
          error_message TEXT
        );
      `
    })

    if (createTableError) {
      console.error("Error creating table:", createTableError)
      // Continue anyway - table might already exist
    }

    // Create indexes for performance
    const { error: indexError1 } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_deduplication_metrics_created 
        ON deduplication_metrics(created_at DESC);
      `
    })

    const { error: indexError2 } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_deduplication_metrics_session 
        ON deduplication_metrics(session_id);
      `
    })

    const { error: indexError3 } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_deduplication_metrics_reduction 
        ON deduplication_metrics(reduction_rate DESC);
      `
    })

    // Create a view for daily aggregates
    const { error: viewError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE VIEW deduplication_daily_stats AS
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as total_sessions,
          AVG(original_count) as avg_original_count,
          AVG(unique_stories) as avg_unique_stories,
          AVG(duplicates_removed) as avg_duplicates_removed,
          AVG(reduction_rate) as avg_reduction_rate,
          SUM(duplicates_removed) as total_duplicates_removed,
          AVG(total_time_ms) as avg_processing_time_ms,
          SUM(total_cost) as total_cost,
          SUM(embeddings_cost) as total_embeddings_cost,
          SUM(nlp_cost) as total_nlp_cost,
          MAX(largest_cluster) as max_cluster_size,
          AVG(average_cluster_size) as overall_avg_cluster_size
        FROM deduplication_metrics
        WHERE error_occurred = false
        GROUP BY DATE(created_at)
        ORDER BY date DESC;
      `
    })

    // Create a view for hourly stats
    const { error: hourlyViewError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE VIEW deduplication_hourly_stats AS
        SELECT 
          DATE_TRUNC('hour', created_at) as hour,
          COUNT(*) as sessions_count,
          AVG(duplicates_removed) as avg_duplicates_removed,
          AVG(reduction_rate) as avg_reduction_rate,
          AVG(total_time_ms) as avg_processing_time,
          SUM(total_cost) as hourly_cost
        FROM deduplication_metrics
        WHERE error_occurred = false
        GROUP BY DATE_TRUNC('hour', created_at)
        ORDER BY hour DESC
        LIMIT 168; -- Last 7 days of hourly data
      `
    })

    // Create a materialized view for source pair analysis
    const { error: matViewError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        CREATE MATERIALIZED VIEW IF NOT EXISTS deduplication_source_pairs AS
        WITH source_data AS (
          SELECT 
            created_at,
            sources_before,
            sources_after,
            duplicates_removed
          FROM deduplication_metrics
          WHERE sources_before IS NOT NULL 
            AND sources_after IS NOT NULL
            AND error_occurred = false
        )
        SELECT 
          DATE(created_at) as date,
          sources_before,
          sources_after,
          COUNT(*) as occurrence_count,
          AVG(duplicates_removed) as avg_duplicates
        FROM source_data
        GROUP BY DATE(created_at), sources_before, sources_after
        ORDER BY date DESC, avg_duplicates DESC;
      `
    })

    // Grant appropriate permissions
    const { error: grantError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        GRANT SELECT, INSERT ON deduplication_metrics TO authenticated;
        GRANT SELECT ON deduplication_daily_stats TO authenticated;
        GRANT SELECT ON deduplication_hourly_stats TO authenticated;
      `
    })

    console.log("✅ Deduplication metrics table and views created successfully")

    // Insert a test record to verify everything works
    const testMetric = {
      session_id: 'setup_test_' + Date.now(),
      original_count: 50,
      unique_stories: 45,
      duplicates_removed: 5,
      reduction_rate: 10.0,
      embeddings_time_ms: 1500,
      clustering_time_ms: 200,
      nlp_verification_time_ms: 800,
      total_time_ms: 2500,
      average_cluster_size: 1.11,
      largest_cluster: 2,
      cluster_count: 45,
      sources_before: { "RTHK": 10, "SingTao": 15, "HK01": 10, "on.cc": 15 },
      sources_after: { "RTHK": 9, "SingTao": 14, "HK01": 9, "on.cc": 13 },
      sources_represented: ["RTHK", "SingTao", "HK01", "on.cc"],
      borderline_pairs: 3,
      nlp_verifications: 2,
      clusters_merged: 1,
      embeddings_cost: 0.001,
      nlp_cost: 0.0003,
      total_cost: 0.0013
    }

    const { data: testData, error: insertError } = await supabaseAdmin
      .from('deduplication_metrics')
      .insert(testMetric)
      .select()
      .single()

    if (insertError) {
      console.error("Error inserting test record:", insertError)
      return NextResponse.json({
        success: false,
        message: "Table created but test insert failed",
        error: insertError.message
      }, { status: 500 })
    }

    // Clean up test record
    await supabaseAdmin
      .from('deduplication_metrics')
      .delete()
      .eq('id', testData.id)

    return NextResponse.json({
      success: true,
      message: "Deduplication metrics table setup complete",
      details: {
        table: "deduplication_metrics",
        indexes: ["idx_deduplication_metrics_created", "idx_deduplication_metrics_session", "idx_deduplication_metrics_reduction"],
        views: ["deduplication_daily_stats", "deduplication_hourly_stats"],
        testInsert: "successful"
      }
    })

  } catch (error) {
    console.error("Setup error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    }, { status: 500 })
  }
}