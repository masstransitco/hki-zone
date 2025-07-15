import { type NextRequest, NextResponse } from "next/server"
import { checkDatabaseSetup } from "@/lib/supabase"

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { articleIds } = await request.json()

    if (!articleIds || !Array.isArray(articleIds) || articleIds.length === 0) {
      return NextResponse.json({
        error: "Invalid or empty articleIds array"
      }, { status: 400 })
    }

    console.log(`Batch delete request for ${articleIds.length} articles:`, articleIds)

    // Check if database is set up
    const isDatabaseReady = await checkDatabaseSetup()
    if (!isDatabaseReady) {
      return NextResponse.json({
        error: "Database not set up"
      }, { status: 500 })
    }

    // Import supabase inside the function to avoid connection issues
    const { supabase } = await import("@/lib/supabase")

    // Perform soft delete by setting deleted_at timestamp
    const { data, error } = await supabase
      .from("articles")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", articleIds)
      .select("id")

    if (error) {
      console.error("Database error during batch delete:", error)
      return NextResponse.json({
        error: "Failed to delete articles",
        details: error.message
      }, { status: 500 })
    }

    const deletedCount = data?.length || 0
    console.log(`Successfully soft-deleted ${deletedCount} articles`)

    return NextResponse.json({
      success: true,
      deletedCount,
      message: `Successfully deleted ${deletedCount} articles`
    })

  } catch (error) {
    console.error("Error in batch delete API:", error)
    
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}