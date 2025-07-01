import { type NextRequest, NextResponse } from "next/server"
import { runAllScrapers } from "@/lib/scraper-orchestrator"

export async function GET(request: NextRequest) {
  // Verify the request is from Vercel Cron
  const userAgent = request.headers.get("user-agent")
  if (userAgent !== "vercel-cron/1.0") {
    return new Response("Unauthorized", {
      status: 401,
    })
  }

  try {
    console.log("Cron job started:", new Date().toISOString())

    const result = await runAllScrapers()

    console.log("Cron job completed:", new Date().toISOString())

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result,
    })
  } catch (error) {
    console.error("Cron job failed:", error)

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
