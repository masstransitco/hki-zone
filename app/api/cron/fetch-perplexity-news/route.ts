import { type NextRequest, NextResponse } from "next/server"
import { perplexityHKNews } from "@/lib/perplexity-hk-news"
import { savePerplexityHeadlines } from "@/lib/supabase-server"

export async function GET(request: NextRequest) {
  // Verify the request is from Vercel Cron
  const userAgent = request.headers.get("user-agent")
  if (userAgent !== "vercel-cron/1.0") {
    return new Response("Unauthorized", {
      status: 401,
    })
  }

  try {
    console.log("🚀 Perplexity headlines fetcher cron job started:", new Date().toISOString())

    // Check if Perplexity API is configured
    if (!process.env.PERPLEXITY_API_KEY) {
      console.error("❌ PERPLEXITY_API_KEY not configured")
      
      return NextResponse.json({
        success: false,
        timestamp: new Date().toISOString(),
        error: 'PERPLEXITY_API_KEY not configured',
        message: 'Cannot generate headlines without API key'
      }, { status: 500 })
    }

    // Fetch fresh headlines from Perplexity
    console.log("🔄 Starting Perplexity headlines processing...")
    const result = await perplexityHKNews.processHeadlines()

    console.log(`✅ Headlines fetcher completed: ${result.saved} headlines saved, cost: $${result.totalCost.toFixed(6)}`)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result: {
        method: 'perplexity',
        saved: result.saved,
        totalCost: result.totalCost,
        message: `Successfully saved ${result.saved} headlines`
      },
    })
  } catch (error) {
    console.error("💥 Perplexity headlines fetcher cron job failed:", error)

    // Don't save fallback headlines - just return the error
    return NextResponse.json({
      success: false,
      timestamp: new Date().toISOString(),
      error: error.message,
      message: 'Failed to generate headlines. No fallback headlines were saved.'
    }, { status: 500 })
  }
}