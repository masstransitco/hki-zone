import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST() {
  try {
    console.log('Starting AI enhancement fields migration...')

    // Check if columns already exist
    const { data: columns, error: columnsError } = await supabase.rpc('exec', {
      query: `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'articles' 
        AND column_name IN ('is_ai_enhanced', 'original_article_id', 'enhancement_metadata');
      `
    })

    // If the query fails, try the migration anyway
    if (columnsError) {
      console.log('Could not check existing columns, proceeding with migration...')
    } else if (columns && columns.length >= 3) {
      return NextResponse.json({
        success: true,
        message: 'AI enhancement fields already exist',
        alreadyMigrated: true
      })
    }

    // Run the migration
    const migrationSQL = `
      -- Add AI enhancement fields to articles table
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
    `

    const { error: migrationError } = await supabase.rpc('exec', {
      query: migrationSQL
    })

    if (migrationError) {
      console.error('Migration failed:', migrationError)
      
      // Provide manual migration instructions
      return NextResponse.json({
        success: false,
        error: 'Automatic migration failed',
        message: 'Please run the migration manually',
        instructions: {
          step1: 'Go to your Supabase project dashboard',
          step2: 'Click on "SQL Editor" in the sidebar',
          step3: 'Create a new query and paste the migration script',
          step4: 'Run the script to add AI enhancement fields',
          migrationScript: migrationSQL
        }
      }, { status: 400 })
    }

    // Test if migration was successful
    const { error: testError } = await supabase
      .from('articles')
      .select('is_ai_enhanced, original_article_id, enhancement_metadata')
      .limit(1)

    if (testError) {
      console.error('Migration verification failed:', testError)
      return NextResponse.json({
        success: false,
        error: 'Migration verification failed',
        details: testError.message
      }, { status: 500 })
    }

    console.log('AI enhancement fields migration completed successfully')
    return NextResponse.json({
      success: true,
      message: 'AI enhancement fields migration completed successfully',
      migrationCompleted: true
    })

  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({
      success: false,
      error: 'Migration failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      instructions: {
        step1: 'Go to your Supabase project dashboard',
        step2: 'Click on "SQL Editor" in the sidebar', 
        step3: 'Run the migration script from /scripts/add-ai-enhancement-fields.sql',
        step4: 'Check that the new columns were added successfully'
      }
    }, { status: 500 })
  }
}

// GET endpoint to check migration status
export async function GET() {
  try {
    // Check if the new columns exist
    const { error } = await supabase
      .from('articles')
      .select('is_ai_enhanced, original_article_id, enhancement_metadata')
      .limit(1)

    const migrated = !error

    return NextResponse.json({
      migrated,
      status: migrated ? 'migrated' : 'not_migrated',
      message: migrated 
        ? 'AI enhancement fields are available'
        : 'AI enhancement fields need to be added to database'
    })
  } catch (error) {
    return NextResponse.json({
      migrated: false,
      status: 'error',
      error: 'Failed to check migration status'
    }, { status: 500 })
  }
}