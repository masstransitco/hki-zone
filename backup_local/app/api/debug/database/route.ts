import { NextResponse } from "next/server"
import { supabase, checkDatabaseSetup } from "@/lib/supabase"

export async function GET() {
  try {
    console.log("=== Database Debug Info ===")

    // Check environment variables
    const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL
    const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY

    console.log("Environment check:", { hasSupabaseUrl, hasServiceKey })

    // Test basic connection
    let connectionTest = null
    try {
      const { data, error } = await supabase.from("articles").select("count").limit(1)
      connectionTest = { success: !error, error: error?.message, data }
    } catch (err) {
      connectionTest = { success: false, error: err.message }
    }

    // Test database setup function
    const setupCheck = await checkDatabaseSetup()

    // Try to check if articles table exists using direct query
    let tablesCheck = null
    try {
      const { data, error } = await supabase
        .from("articles")
        .select("id")
        .limit(1)
      tablesCheck = { success: !error, data: error ? null : 'Articles table exists', error: error?.message }
    } catch (err) {
      tablesCheck = { success: false, error: err.message }
    }

    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: {
        hasSupabaseUrl,
        hasServiceKey,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + "...",
      },
      connectionTest,
      setupCheck,
      tablesCheck,
    }

    console.log("Debug info:", debugInfo)

    return NextResponse.json(debugInfo)
  } catch (error) {
    console.error("Debug endpoint error:", error)
    return NextResponse.json(
      {
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
