import { type NextRequest, NextResponse } from "next/server"
import { generateUniqueHeadlines, saveUniqueHeadlines } from "@/lib/perplexity-hk-news-improved"

export async function GET(request: NextRequest) {
  // Allow both Vercel Cron and manual testing
  const userAgent = request.headers.get("user-agent")
  const isVercelCron = userAgent === "vercel-cron/1.0"
  const isLocalTest = request.headers.get("host")?.includes("localhost")
  
  if (!isVercelCron && !isLocalTest) {
    return new Response("Unauthorized", { status: 401 })
  }

  try {
    console.log("🚀 Unique headlines fetcher started:", new Date().toISOString())

    // Check if Perplexity API is configured
    if (!process.env.PERPLEXITY_API_KEY) {
      return NextResponse.json({
        success: false,
        error: "PERPLEXITY_API_KEY not configured"
      }, { status: 500 })
    }

    // Generate unique headlines
    const headlines = await generateUniqueHeadlines()
    
    if (headlines.length === 0) {
      return NextResponse.json({
        success: false,
        timestamp: new Date().toISOString(),
        message: "Failed to generate headlines"
      })
    }

    // Save headlines with deduplication
    const { saved, error } = await saveUniqueHeadlines(headlines)
    
    if (error) {
      return NextResponse.json({
        success: false,
        timestamp: new Date().toISOString(),
        error: "Failed to save headlines",
        details: error
      })
    }

    console.log(`✅ Headlines fetcher completed: ${saved} headlines saved`)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result: {
        generated: headlines.length,
        saved: saved,
        message: `Successfully saved ${saved} unique headlines`
      }
    })

  } catch (error) {
    console.error("💥 Headlines fetcher failed:", error)
    return NextResponse.json({
      success: false,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}