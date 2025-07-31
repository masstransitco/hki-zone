import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST() {
  try {
    console.log("🔧 Setting up Perplexity news database...")

    // Check if table already exists
    const { data: existingTable, error: checkError } = await supabase
      .from('perplexity_news')
      .select('id')
      .limit(1)
    
    if (!checkError) {
      return NextResponse.json({
        success: true,
        message: 'Perplexity news table already exists',
        alreadyExists: true
      })
    }

    // Create the table using individual SQL commands
    const migrationSQL = `
      -- Create perplexity_news table
      CREATE TABLE perplexity_news (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        published_at TIMESTAMPZ NOT NULL,
        inserted_at TIMESTAMPZ DEFAULT NOW(),
        url_hash TEXT GENERATED ALWAYS AS (encode(digest(url,'sha256'),'hex')) STORED,
        article_status TEXT NOT NULL DEFAULT 'pending',
        article_html TEXT,
        lede TEXT,
        image_prompt TEXT,
        image_status TEXT NOT NULL DEFAULT 'pending',
        image_url TEXT,
        image_license TEXT,
        source TEXT DEFAULT 'Perplexity AI',
        author TEXT DEFAULT 'AI Generated',
        perplexity_model TEXT DEFAULT 'sonar-pro',
        generation_cost DECIMAL(10,6),
        search_queries TEXT[],
        citations JSONB,
        created_at TIMESTAMPZ DEFAULT NOW(),
        updated_at TIMESTAMPZ DEFAULT NOW()
      );

      -- Add unique constraint
      ALTER TABLE perplexity_news ADD CONSTRAINT unique_perplexity_url UNIQUE (url_hash);

      -- Create basic indexes
      CREATE INDEX idx_perplexity_news_category ON perplexity_news(category);
      CREATE INDEX idx_perplexity_news_inserted_at ON perplexity_news(inserted_at DESC);
      CREATE INDEX idx_perplexity_news_article_status ON perplexity_news(article_status);

      -- Enable RLS
      ALTER TABLE perplexity_news ENABLE ROW LEVEL SECURITY;

      -- Create policies
      CREATE POLICY "Allow read access to all users" ON perplexity_news FOR SELECT USING (true);
      CREATE POLICY "Allow full access for service role" ON perplexity_news FOR ALL USING (auth.role() = 'service_role');
    `

    const { error } = await supabase.rpc('exec', { query: migrationSQL })

    if (error) {
      console.error('Migration failed:', error)
      return NextResponse.json({
        success: false,
        message: `Database setup failed: ${error.message}`,
        error: error.message,
        hint: 'You may need to run the SQL manually in Supabase dashboard'
      }, { status: 500 })
    }

    // Test the table
    const { data: testData, error: testError } = await supabase
      .from("perplexity_news")
      .select("id")
      .limit(1)

    if (testError) {
      throw new Error(`Table creation verification failed: ${testError.message}`)
    }

    console.log("✅ Perplexity news database setup completed successfully")

    return NextResponse.json({
      success: true,
      message: "Perplexity news database setup completed successfully",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Setup failed:", error)

    return NextResponse.json({
      success: false,
      message: `Database setup failed: ${error.message}`,
      timestamp: new Date().toISOString(),
      manualSetup: "Please run the SQL from scripts/add-perplexity-news-table.sql manually in Supabase dashboard"
    }, { status: 500 })
  }
}