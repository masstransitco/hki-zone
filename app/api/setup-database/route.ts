import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST() {
  try {
    console.log("Starting database setup...")

    // Step 1: Create the articles table
    const { error: createTableError } = await supabase.rpc("exec", {
      query: `
        CREATE TABLE IF NOT EXISTS articles (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          title TEXT NOT NULL,
          content TEXT,
          summary TEXT,
          ai_summary TEXT,
          url TEXT UNIQUE NOT NULL,
          source TEXT NOT NULL,
          author TEXT,
          published_at TIMESTAMPTZ,
          image_url TEXT,
          category TEXT DEFAULT 'General',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `,
    })

    // If rpc doesn't work, try direct table creation
    if (createTableError) {
      console.log("RPC method failed, trying direct approach...")

      // Try using the REST API approach
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        },
        body: JSON.stringify({
          query: `
            CREATE TABLE IF NOT EXISTS articles (
              id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
              title TEXT NOT NULL,
              content TEXT,
              summary TEXT,
              ai_summary TEXT,
              url TEXT UNIQUE NOT NULL,
              source TEXT NOT NULL,
              author TEXT,
              published_at TIMESTAMPTZ,
              image_url TEXT,
              category TEXT DEFAULT 'General',
              created_at TIMESTAMPTZ DEFAULT NOW(),
              updated_at TIMESTAMPTZ DEFAULT NOW()
            );
          `,
        }),
      })

      if (!response.ok) {
        // If both methods fail, provide manual setup instructions
        return NextResponse.json(
          {
            success: false,
            error: "Automatic setup failed",
            message: "Please set up the database manually using the Supabase dashboard",
            instructions: {
              step1: "Go to your Supabase project dashboard",
              step2: "Click on 'SQL Editor' in the sidebar",
              step3: "Create a new query and paste the SQL script",
              step4: "Run the script to create the articles table",
              sqlScript: `
CREATE TABLE IF NOT EXISTS articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  summary TEXT,
  ai_summary TEXT,
  url TEXT UNIQUE NOT NULL,
  source TEXT NOT NULL,
  author TEXT,
  published_at TIMESTAMPTZ,
  image_url TEXT,
  category TEXT DEFAULT 'General',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_articles_updated_at 
    BEFORE UPDATE ON articles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to all users" ON articles
    FOR SELECT USING (true);

CREATE POLICY "Allow insert/update for service role" ON articles
    FOR ALL USING (auth.role() = 'service_role');
            `,
            },
          },
          { status: 400 },
        )
      }
    }

    // Test if table was created by trying to query it
    const { error: testError } = await supabase.from("articles").select("id").limit(1)

    if (testError) {
      console.error("Table creation verification failed:", testError)
      return NextResponse.json(
        {
          success: false,
          error: "Table creation failed",
          message: "Please set up the database manually using the Supabase dashboard",
          details: testError.message,
        },
        { status: 500 },
      )
    }

    console.log("Database setup completed successfully")
    return NextResponse.json({
      success: true,
      message: "Database setup completed successfully",
      tableCreated: true,
    })
  } catch (error) {
    console.error("Database setup error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Database setup failed",
        message: "Please set up the database manually using the Supabase dashboard",
        details: error.message,
        instructions: {
          step1: "Go to your Supabase project dashboard",
          step2: "Click on 'SQL Editor' in the sidebar",
          step3: "Create a new query and paste the provided SQL script",
          step4: "Run the script to create the articles table",
        },
      },
      { status: 500 },
    )
  }
}
