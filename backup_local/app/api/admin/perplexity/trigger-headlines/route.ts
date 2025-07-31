import { type NextRequest, NextResponse } from "next/server"
import { perplexityHKNews } from "@/lib/perplexity-hk-news"
import { savePerplexityHeadlines } from "@/lib/supabase-server"

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    console.log("🚀 Manual Perplexity headlines trigger started:", new Date().toISOString())

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
    console.log("🔄 Starting manual Perplexity headlines processing...")
    const result = await perplexityHKNews.processHeadlines()

    console.log(`✅ Manual headlines trigger completed: ${result.saved} headlines saved, cost: $${result.totalCost.toFixed(6)}`)

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
    console.error("💥 Manual Perplexity headlines trigger failed:", error)

    // Don't save fallback headlines - just return the error
    return NextResponse.json({
      success: false,
      timestamp: new Date().toISOString(),
      error: error.message,
      message: 'Failed to generate headlines. No fallback headlines were saved.'
    }, { status: 500 })
  }
}