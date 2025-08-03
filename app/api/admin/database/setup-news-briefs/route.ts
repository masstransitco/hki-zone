import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

export async function POST(request: NextRequest) {
  try {
    console.log('🏗️ Setting up news briefs database schema...')

    // 1. Add new columns to articles table for TTS selection tracking
    console.log('1. Adding TTS selection columns to articles table...')
    
    const alterArticlesSQL = `
      -- Add column to track if article is selected for TTS news brief
      ALTER TABLE articles 
      ADD COLUMN IF NOT EXISTS selected_for_tts_brief boolean DEFAULT false;
      
      -- Add metadata for TTS selection (selection reason, priority, etc.)
      ALTER TABLE articles 
      ADD COLUMN IF NOT EXISTS tts_selection_metadata jsonb;
      
      -- Add indexes for efficient querying
      CREATE INDEX IF NOT EXISTS idx_articles_selected_for_tts_brief 
      ON articles(selected_for_tts_brief) WHERE selected_for_tts_brief = true;
      
      CREATE INDEX IF NOT EXISTS idx_articles_tts_selection_metadata 
      ON articles USING gin(tts_selection_metadata);
    `

    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: alterArticlesSQL
    })

    if (alterError) {
      console.error('Error altering articles table:', alterError)
      throw alterError
    }

    console.log('✅ Articles table updated successfully')

    // 2. Create news_briefs table
    console.log('2. Creating news_briefs table...')
    
    const createNewsBriefsSQL = `
      -- Create news_briefs table to store generated TTS scripts
      CREATE TABLE IF NOT EXISTS news_briefs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL, -- The TTS script content
        language VARCHAR(10) NOT NULL CHECK (language IN ('en', 'zh-TW', 'zh-CN')),
        category VARCHAR(50) NOT NULL, -- morning, afternoon, evening
        estimated_duration_seconds INTEGER NOT NULL,
        actual_word_count INTEGER,
        openai_model_used VARCHAR(50) DEFAULT 'gpt-4o-mini',
        generation_cost_usd DECIMAL(10,6),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Create indexes for efficient querying
      CREATE INDEX IF NOT EXISTS idx_news_briefs_created_at 
      ON news_briefs(created_at DESC);
      
      CREATE INDEX IF NOT EXISTS idx_news_briefs_language 
      ON news_briefs(language);
      
      CREATE INDEX IF NOT EXISTS idx_news_briefs_category 
      ON news_briefs(category);
      
      CREATE INDEX IF NOT EXISTS idx_news_briefs_language_category 
      ON news_briefs(language, category, created_at DESC);

      -- Add updated_at trigger
      CREATE OR REPLACE FUNCTION update_news_briefs_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER IF NOT EXISTS update_news_briefs_updated_at
        BEFORE UPDATE ON news_briefs
        FOR EACH ROW
        EXECUTE FUNCTION update_news_briefs_updated_at();
    `

    const { error: createTableError } = await supabase.rpc('exec_sql', {
      sql: createNewsBriefsSQL
    })

    if (createTableError) {
      console.error('Error creating news_briefs table:', createTableError)
      throw createTableError
    }

    console.log('✅ news_briefs table created successfully')

    // 3. Create junction table for articles included in each brief
    console.log('3. Creating news_brief_articles junction table...')
    
    const createJunctionSQL = `
      -- Create junction table to track which articles are included in each brief
      CREATE TABLE IF NOT EXISTS news_brief_articles (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        news_brief_id UUID NOT NULL REFERENCES news_briefs(id) ON DELETE CASCADE,
        article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
        inclusion_reason TEXT, -- Why this article was selected
        article_weight DECIMAL(3,2), -- How much of the brief this article represents (0.0-1.0)
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(news_brief_id, article_id)
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_news_brief_articles_brief_id 
      ON news_brief_articles(news_brief_id);
      
      CREATE INDEX IF NOT EXISTS idx_news_brief_articles_article_id 
      ON news_brief_articles(article_id);
      
      CREATE INDEX IF NOT EXISTS idx_news_brief_articles_created_at 
      ON news_brief_articles(created_at DESC);
    `

    const { error: junctionError } = await supabase.rpc('exec_sql', {
      sql: createJunctionSQL
    })

    if (junctionError) {
      console.error('Error creating junction table:', junctionError)
      throw junctionError
    }

    console.log('✅ news_brief_articles junction table created successfully')

    // 4. Create a view for easy querying of briefs with article counts
    console.log('4. Creating news_briefs_with_stats view...')
    
    const createViewSQL = `
      -- Create view that shows news briefs with article statistics
      CREATE OR REPLACE VIEW news_briefs_with_stats AS
      SELECT 
        nb.id,
        nb.title,
        nb.content,
        nb.language,
        nb.category,
        nb.estimated_duration_seconds,
        nb.actual_word_count,
        nb.openai_model_used,
        nb.generation_cost_usd,
        nb.created_at,
        nb.updated_at,
        COUNT(nba.article_id) as articles_count,
        ARRAY_AGG(nba.article_id) as article_ids,
        ROUND(AVG(a.quality_score), 1) as avg_article_quality_score
      FROM news_briefs nb
      LEFT JOIN news_brief_articles nba ON nb.id = nba.news_brief_id
      LEFT JOIN articles a ON nba.article_id = a.id
      GROUP BY nb.id, nb.title, nb.content, nb.language, nb.category, 
               nb.estimated_duration_seconds, nb.actual_word_count, 
               nb.openai_model_used, nb.generation_cost_usd, 
               nb.created_at, nb.updated_at
      ORDER BY nb.created_at DESC;
    `

    const { error: viewError } = await supabase.rpc('exec_sql', {
      sql: createViewSQL
    })

    if (viewError) {
      console.error('Error creating view:', viewError)
      throw viewError
    }

    console.log('✅ news_briefs_with_stats view created successfully')

    // 5. Verify the setup by checking table structures
    console.log('5. Verifying database setup...')
    
    const { data: articlesInfo, error: articlesInfoError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'articles' 
        AND column_name IN ('selected_for_tts_brief', 'tts_selection_metadata')
        ORDER BY column_name;
      `
    })

    const { data: briefsInfo, error: briefsInfoError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'news_briefs'
        ORDER BY ordinal_position;
      `
    })

    if (articlesInfoError || briefsInfoError) {
      console.error('Error verifying setup:', { articlesInfoError, briefsInfoError })
    }

    return NextResponse.json({
      success: true,
      message: 'News briefs database schema setup completed successfully',
      changes: {
        articlesTableUpdated: true,
        newsBriefsTableCreated: true,
        junctionTableCreated: true,
        viewCreated: true,
        indexesCreated: true
      },
      verification: {
        articlesColumns: articlesInfo,
        newsBriefsColumns: briefsInfo
      }
    })

  } catch (error) {
    console.error('❌ Error setting up news briefs schema:', error)
    return NextResponse.json({
      error: 'Failed to setup news briefs database schema',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET endpoint to check current schema status
export async function GET(request: NextRequest) {
  try {
    // Check if columns exist
    const { data: articlesColumns } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'articles' 
        AND column_name IN ('selected_for_tts_brief', 'tts_selection_metadata');
      `
    })

    // Check if tables exist
    const { data: tables } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('news_briefs', 'news_brief_articles');
      `
    })

    // Check if view exists
    const { data: views } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT table_name 
        FROM information_schema.views 
        WHERE table_schema = 'public' 
        AND table_name = 'news_briefs_with_stats';
      `
    })

    const isSetup = 
      (articlesColumns?.length || 0) === 2 &&
      (tables?.length || 0) === 2 &&
      (views?.length || 0) === 1

    return NextResponse.json({
      configured: isSetup,
      components: {
        articlesColumns: articlesColumns?.map(c => c.column_name) || [],
        tables: tables?.map(t => t.table_name) || [],
        views: views?.map(v => v.table_name) || []
      },
      message: isSetup ? 'News briefs schema is properly configured' : 'News briefs schema needs setup'
    })

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to check schema status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}