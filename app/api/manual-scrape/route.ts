import { NextResponse } from "next/server"
import { runAllScrapers } from "@/lib/scraper-orchestrator"

// Manual trigger endpoint for testing the scraper
export async function POST() {
  try {
    console.log("🚀 Manual scrape triggered:", new Date().toISOString())

    // Call the scraper orchestrator with progress tracking
    const result = await runAllScrapers(true)

    console.log("📊 Manual scrape completed:", result)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result,
    })
  } catch (error) {
    console.error("💥 Manual scrape failed:", error)

    return NextResponse.json(
      {
        success: false,
        timestamp: new Date().toISOString(),
        error: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
        details: "Check server logs for more information",
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Use POST to trigger manual scrape",
    endpoints: {
      manual: "/api/manual-scrape (POST)",
      cron: "/api/cron/scrape-news (GET - Vercel only)",
    },
    note: "This endpoint calls the scraper orchestrator directly, bypassing the cron user-agent check",
    status: "Ready to scrape",
    timestamp: new Date().toISOString(),
  })
}
