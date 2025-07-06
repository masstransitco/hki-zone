import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Check if deleted_at column already exists
    const { data: columns, error: checkError } = await supabase
      .rpc('get_table_columns', { 
        table_name: 'articles',
        schema_name: 'public' 
      })
      .select('*')
    
    if (!checkError && columns) {
      const hasDeletedAt = columns.some((col: any) => col.column_name === 'deleted_at')
      if (hasDeletedAt) {
        return NextResponse.json({ 
          success: true, 
          message: "deleted_at column already exists" 
        })
      }
    }
    
    // If RPC doesn't exist or fails, try a direct query
    const { data: testData, error: testError } = await supabase
      .from('articles')
      .select('deleted_at')
      .limit(1)
    
    if (!testError) {
      return NextResponse.json({ 
        success: true, 
        message: "deleted_at column already exists" 
      })
    }
    
    return NextResponse.json({ 
      success: false, 
      message: "deleted_at column does not exist",
      needsMigration: true
    })
  } catch (error) {
    console.error("Error checking deleted_at column:", error)
    return NextResponse.json({ 
      success: false, 
      error: "Failed to check deleted_at column status" 
    }, { status: 500 })
  }
}

export async function POST() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Run the migration to add deleted_at column
    const migrationSQL = `
      -- Add soft delete support to articles table
      ALTER TABLE articles 
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

      -- Create index for efficient filtering of non-deleted articles
      CREATE INDEX IF NOT EXISTS idx_articles_deleted_at ON articles(deleted_at);

      -- Add comment for documentation
      COMMENT ON COLUMN articles.deleted_at IS 'Timestamp when the article was soft-deleted. NULL means the article is active.';
    `
    
    // Execute the migration
    const { error } = await supabase.rpc('exec_sql', { 
      sql_query: migrationSQL 
    }).single()
    
    if (error) {
      // If RPC doesn't exist, try using direct SQL through Supabase client
      console.error("RPC exec_sql failed, attempting direct execution:", error)
      
      // For Supabase, we need to use the SQL editor or create a database function
      // Since we can't execute arbitrary SQL directly, we'll return instructions
      return NextResponse.json({
        success: false,
        message: "Cannot execute migration directly. Please run the following SQL in Supabase SQL editor:",
        sql: migrationSQL,
        error: error.message
      }, { status: 400 })
    }
    
    return NextResponse.json({ 
      success: true, 
      message: "Successfully added deleted_at column to articles table" 
    })
    
  } catch (error) {
    console.error("Error adding deleted_at column:", error)
    return NextResponse.json({ 
      success: false, 
      error: "Failed to add deleted_at column",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}