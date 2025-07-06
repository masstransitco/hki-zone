import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST() {
  try {
    console.log("Attempting to refresh Supabase schema cache...")
    
    // Option 1: Try to force a schema refresh by making a query that will fail
    // This often triggers Supabase to refresh its cache
    try {
      await supabase
        .from("articles")
        .select("*")
        .eq("id", "00000000-0000-0000-0000-000000000000")
        .single()
    } catch (e) {
      // Expected to fail, but triggers cache refresh
    }
    
    // Option 2: Make a test query to check if the column is now accessible
    const { error: testError } = await supabase
      .from("articles")
      .select("id, image_metadata")
      .limit(1)
    
    if (testError && testError.message.includes("image_metadata")) {
      // The column still isn't recognized
      return NextResponse.json({
        success: false,
        message: "Schema cache not refreshed. Manual intervention required.",
        instructions: [
          "Option 1: Restart your Supabase project",
          "- Go to your Supabase dashboard",
          "- Navigate to Settings > General",
          "- Click 'Restart project' (this takes a few seconds)",
          "",
          "Option 2: Use Supabase SQL Editor to add the column",
          "- Go to SQL Editor in your Supabase dashboard",
          "- Run: ALTER TABLE articles ADD COLUMN IF NOT EXISTS image_metadata JSONB;",
          "- The schema cache will automatically refresh",
          "",
          "Option 3: Wait for automatic refresh",
          "- Supabase typically refreshes schema cache within 60 seconds",
          "- Try again in a minute"
        ],
        error: testError.message
      })
    }
    
    // Success! The column is recognized
    return NextResponse.json({
      success: true,
      message: "Schema cache appears to be refreshed",
      test: "Successfully queried image_metadata column"
    })
    
  } catch (error) {
    console.error("Error refreshing schema:", error)
    return NextResponse.json(
      { 
        error: "Failed to refresh schema", 
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}