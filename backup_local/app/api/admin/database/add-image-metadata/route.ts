import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST() {
  try {
    console.log("Running image_metadata migration...")
    
    // First check if column already exists
    const { error: checkError } = await supabase
      .from("articles")
      .select("image_metadata")
      .limit(1)
    
    if (!checkError || !checkError.message.includes('column "image_metadata"')) {
      return NextResponse.json({
        success: true,
        message: "image_metadata column already exists",
        alreadyExists: true
      })
    }
    
    // Since we can't run ALTER TABLE directly through Supabase client,
    // we need to provide instructions
    const migrationSQL = `-- Add image_metadata column to store different image versions
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS image_metadata JSONB;

-- Add comment explaining the structure
COMMENT ON COLUMN articles.image_metadata IS 'Stores URLs for different image versions: {original, optimized, whatsapp}';`
    
    // Get the project reference for the SQL editor link
    const projectRef = supabaseUrl.split('.')[0].replace('https://', '')
    
    return NextResponse.json({
      success: false,
      message: "Column needs to be added via Supabase SQL Editor",
      instructions: {
        step1: "Go to Supabase SQL Editor",
        sqlEditorUrl: `https://app.supabase.com/project/${projectRef}/sql/new`,
        step2: "Copy and paste the following SQL",
        sql: migrationSQL,
        step3: "Click 'Run' to execute the migration",
        step4: "The column will be added immediately"
      },
      checkEndpoint: "/api/admin/database/status"
    })
    
  } catch (error) {
    console.error("Error in migration:", error)
    return NextResponse.json(
      { 
        error: "Migration failed", 
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}