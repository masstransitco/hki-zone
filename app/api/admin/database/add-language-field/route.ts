import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST() {
  try {
    console.log('Starting language field migration...')

    // Check if language column already exists
    const { data: columns, error: columnsError } = await supabase.rpc('exec', {
      query: `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'articles' 
        AND column_name = 'language';
      `
    })

    // If the query fails, try the migration anyway
    if (columnsError) {
      console.log('Could not check existing columns, proceeding with migration...')
    } else if (columns && columns.length >= 1) {
      return NextResponse.json({
        success: true,
        message: 'Language field already exists',
        alreadyMigrated: true
      })
    }

    // Run the migration
    const migrationSQL = `
      -- Add language field to articles table
      ALTER TABLE articles 
      ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en';

      -- Add index for language field for efficient filtering
      CREATE INDEX IF NOT EXISTS idx_articles_language ON articles(language);

      -- Update existing articles to have 'en' as default language
      UPDATE articles 
      SET language = 'en' 
      WHERE language IS NULL;

      -- Add comment to the language column
      COMMENT ON COLUMN articles.language IS 'Language of the article content: en, zh-TW, zh-CN';
    `

    const { error: migrationError } = await supabase.rpc('exec', {
      query: migrationSQL
    })

    if (migrationError) {
      console.error('Language field migration failed:', migrationError)
      
      // Provide manual migration instructions
      return NextResponse.json({
        success: false,
        error: 'Automatic migration failed',
        message: 'Please run the migration manually',
        instructions: {
          step1: 'Go to your Supabase project dashboard',
          step2: 'Click on "SQL Editor" in the sidebar',
          step3: 'Create a new query and paste the migration script',
          step4: 'Run the script to add language field',
          migrationScript: migrationSQL
        }
      }, { status: 400 })
    }

    // Test if migration was successful
    const { error: testError } = await supabase
      .from('articles')
      .select('language')
      .limit(1)

    if (testError) {
      console.error('Language field migration verification failed:', testError)
      return NextResponse.json({
        success: false,
        error: 'Migration verification failed',
        details: testError.message
      }, { status: 500 })
    }

    console.log('Language field migration completed successfully')
    return NextResponse.json({
      success: true,
      message: 'Language field migration completed successfully',
      migrationCompleted: true
    })

  } catch (error) {
    console.error('Language field migration error:', error)
    return NextResponse.json({
      success: false,
      error: 'Migration failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      instructions: {
        step1: 'Go to your Supabase project dashboard',
        step2: 'Click on "SQL Editor" in the sidebar', 
        step3: 'Run the migration script from /scripts/add-language-field.sql',
        step4: 'Check that the language column was added successfully'
      }
    }, { status: 500 })
  }
}

// GET endpoint to check migration status
export async function GET() {
  try {
    // Check if the language column exists
    const { error } = await supabase
      .from('articles')
      .select('language')
      .limit(1)

    const migrated = !error

    return NextResponse.json({
      migrated,
      status: migrated ? 'migrated' : 'not_migrated',
      message: migrated 
        ? 'Language field is available'
        : 'Language field needs to be added to database'
    })
  } catch (error) {
    return NextResponse.json({
      migrated: false,
      status: 'error',
      error: 'Failed to check language field migration status'
    }, { status: 500 })
  }
}