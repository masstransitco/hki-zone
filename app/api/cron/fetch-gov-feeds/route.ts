import { type NextRequest, NextResponse } from "next/server"
import { getUnifiedFeedsV2 } from "@/lib/government-feeds-unified-v2"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Verify the request is from Vercel Cron
    const userAgent = request.headers.get("user-agent")
    const cronSecret = request.headers.get("x-cron-secret")
    
    // Allow requests from Vercel Cron or with valid secret
    if (userAgent !== "vercel-cron/1.0" && cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    console.log("🚀 Government feeds cron job started (Unified V2):", new Date().toISOString())

    // Process all government feeds using the new unified system
    const unifiedFeeds = getUnifiedFeedsV2()
    await unifiedFeeds.processAllFeeds()
    
    // Create a result object for compatibility
    const result = {
      totalIncidents: 0, // V2 doesn't return detailed stats yet
      processedFeeds: 0,
      results: [],
      errors: []
    }

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      message: `Successfully processed government feeds using unified system V2`,
      result: {
        totalIncidents: result.totalIncidents,
        processedFeeds: result.processedFeeds,
        feedResults: result.results,
        errors: result.errors,
        system: "unified-v2"
      }
    }

    console.log("✅ Government feeds cron job completed:", response.message)
    
    if (result.errors.length > 0) {
      console.warn("⚠️ Some feeds had errors:", result.errors)
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error("💥 Government feeds cron job failed:", error)

    return NextResponse.json({
      success: false,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to process government feeds'
    }, { status: 500 })
  }
}

// POST endpoint for manual testing
export async function POST(request: NextRequest) {
  try {
    console.log("🧪 Manual government feeds processing triggered (Unified V2)")
    
    const unifiedFeeds = getUnifiedFeedsV2()
    await unifiedFeeds.processAllFeeds()
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: `Manually processed government feeds using unified system V2`,
      result: {
        totalIncidents: 0, // V2 doesn't return detailed stats yet
        processedFeeds: 0,
        feedResults: [],
        errors: [],
        system: "unified-v2"
      }
    })
    
  } catch (error) {
    console.error("💥 Manual government feeds processing failed:", error)
    
    return NextResponse.json({
      success: false,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to manually process government feeds'
    }, { status: 500 })
  }
}