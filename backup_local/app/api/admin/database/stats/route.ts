import { NextResponse } from "next/server"
import { getArticleStats } from "@/lib/supabase"

export async function GET() {
  try {
    const stats = await getArticleStats()
    
    if (!stats) {
      return NextResponse.json({
        total: 0,
        bySource: {},
        latest: null,
        oldest: null,
        error: "Unable to fetch database statistics"
      })
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error("Error fetching database stats:", error)
    
    return NextResponse.json({
      total: 0,
      bySource: {},
      latest: null,
      oldest: null,
      error: "Failed to fetch statistics"
    }, { status: 500 })
  }
}