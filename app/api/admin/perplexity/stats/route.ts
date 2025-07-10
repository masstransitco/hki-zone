import { type NextRequest, NextResponse } from "next/server"
import { getPerplexityNewsByCategoryAdmin } from "@/lib/supabase-server"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Get all articles
    const newsGrouped = await getPerplexityNewsByCategoryAdmin()
    const allArticles = Object.values(newsGrouped).flat()
    
    // Calculate statistics
    const byStatus = allArticles.reduce((acc, article) => {
      acc[article.article_status] = (acc[article.article_status] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const byCategory = allArticles.reduce((acc, article) => {
      acc[article.category] = (acc[article.category] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const totalCost = allArticles.reduce((sum, article) => {
      return sum + (article.generation_cost || 0)
    }, 0)
    
    return NextResponse.json({
      total: allArticles.length,
      byStatus,
      byCategory,
      totalCost,
      lastUpdated: new Date().toISOString()
    })
  } catch (error) {
    console.error("Error in perplexity stats API:", error)
    return NextResponse.json(
      { 
        total: 0,
        byStatus: {},
        byCategory: {},
        totalCost: 0,
        error: "Failed to fetch statistics" 
      },
      { status: 500 }
    )
  }
}