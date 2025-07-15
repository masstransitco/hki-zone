import { type NextRequest, NextResponse } from "next/server"
import { governmentFeeds } from "@/lib/government-feeds"

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

    console.log("🚀 Government feeds cron job started:", new Date().toISOString())

    // Process all government feeds
    const result = await governmentFeeds.processAllFeeds()

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      message: `Successfully processed ${result.totalIncidents} incidents from ${result.processedFeeds} government feeds`,
      result: {
        totalIncidents: result.totalIncidents,
        processedFeeds: result.processedFeeds,
        feedResults: result.results,
        errors: result.errors
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
    console.log("🧪 Manual government feeds processing triggered")
    
    const result = await governmentFeeds.processAllFeeds()
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: `Manually processed ${result.totalIncidents} incidents from ${result.processedFeeds} government feeds`,
      result: {
        totalIncidents: result.totalIncidents,
        processedFeeds: result.processedFeeds,
        feedResults: result.results,
        errors: result.errors
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