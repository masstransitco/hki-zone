import { type NextRequest, NextResponse } from "next/server"
import { collectDailyHeadlines } from "@/lib/scraper-orchestrator"

export async function GET(request: NextRequest) {
  // Verify the request is from Vercel Cron
  const userAgent = request.headers.get("user-agent")
  if (userAgent !== "vercel-cron/1.0") {
    return new Response("Unauthorized", {
      status: 401,
    })
  }

  try {
    console.log("Headlines collection cron job started:", new Date().toISOString())

    const result = await collectDailyHeadlines()

    console.log("Headlines collection cron job completed:", new Date().toISOString())

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result,
    })
  } catch (error) {
    console.error("Headlines collection cron job failed:", error)

    return NextResponse.json(
      {
        success: false,
        timestamp: new Date().toISOString(),
        error: error.message,
      },
      { status: 500 },
    )
  }
}