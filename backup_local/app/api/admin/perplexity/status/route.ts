import { type NextRequest, NextResponse } from "next/server"
import { getPendingPerplexityNews, getPerplexityNews } from "@/lib/supabase-server"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    console.log("🔍 Checking Perplexity system status:", new Date().toISOString())

    // Get overall statistics
    const [
      pendingArticles,
      recentArticles
    ] = await Promise.all([
      getPendingPerplexityNews(100), // Get up to 100 pending articles
      getPerplexityNews('all', 50) // Get recent articles from all categories
    ])

    // Calculate status counts
    const statusCounts = recentArticles.reduce((acc, article) => {
      acc[article.article_status] = (acc[article.article_status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const imageStatusCounts = recentArticles.reduce((acc, article) => {
      acc[article.image_status] = (acc[article.image_status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Calculate total costs
    const totalCost = recentArticles.reduce((sum, article) => {
      return sum + (article.generation_cost || 0)
    }, 0)

    // Check system health
    const healthStatus = {
      hasApiKey: !!process.env.PERPLEXITY_API_KEY,
      hasGoogleApi: !!process.env.GOOGLE_API_KEY,
      hasGoogleCse: !!process.env.GOOGLE_CSE_ID,
      cronConfigured: true, // Vercel cron is configured in vercel.json
    }

    // Determine overall health
    const isHealthy = healthStatus.hasApiKey && healthStatus.hasGoogleApi && healthStatus.hasGoogleCse

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      status: {
        health: {
          overall: isHealthy ? 'healthy' : 'degraded',
          ...healthStatus
        },
        articles: {
          total: recentArticles.length,
          pending: pendingArticles.length,
          statusCounts,
          imageStatusCounts,
          totalCost: totalCost.toFixed(6)
        },
        cron: {
          headlinesSchedule: '*/5 * * * *',
          enrichmentSchedule: '2-57/5 * * * *',
          nextHeadlinesRun: getNextCronTime(5),
          nextEnrichmentRun: getNextCronTime(5, 2)
        }
      }
    })
  } catch (error) {
    console.error("💥 Failed to get Perplexity status:", error)

    return NextResponse.json({
      success: false,
      timestamp: new Date().toISOString(),
      error: error.message,
    }, { status: 500 })
  }
}

// Helper function to calculate next cron run time
function getNextCronTime(intervalMinutes: number, offsetMinutes: number = 0): string {
  const now = new Date()
  const currentMinutes = now.getMinutes()
  const currentSeconds = now.getSeconds()
  
  // Calculate next run based on interval
  const nextMinute = Math.ceil((currentMinutes + offsetMinutes) / intervalMinutes) * intervalMinutes
  const nextRun = new Date(now)
  nextRun.setMinutes(nextMinute)
  nextRun.setSeconds(0)
  nextRun.setMilliseconds(0)
  
  // If the calculated time is in the past, add the interval
  if (nextRun <= now) {
    nextRun.setMinutes(nextRun.getMinutes() + intervalMinutes)
  }
  
  return nextRun.toISOString()
}