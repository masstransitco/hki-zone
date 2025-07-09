import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin, checkPerplexityNewsTableSetup } from "@/lib/supabase-server"
import { transformPerplexityToArticle } from "@/lib/perplexity-utils"
import type { PerplexityArticle } from "@/lib/types"

// Mock perplexity article data as fallback
const mockPerplexityArticle: PerplexityArticle = {
  id: "ppl-mock-1",
  title: "Hong Kong Government Unveils 2024 Digital Governance Initiative",
  category: "politics",
  url: "https://example.com/hk-digital-governance-2024",
  published_at: "2024-01-15T10:30:00Z",
  inserted_at: "2024-01-15T10:32:00Z",
  created_at: "2024-01-15T10:32:00Z",
  updated_at: "2024-01-15T10:32:00Z",
  article_status: "ready",
  image_status: "ready",
  article_html: `<p>The Hong Kong government has announced a comprehensive digital governance initiative for 2024, focusing on streamlining public services and enhancing citizen engagement through technology.</p>
    <p>The initiative includes plans for a unified digital identity system, online service portals, and AI-powered citizen support services. Officials expect the new system to reduce bureaucratic delays and improve service delivery across all government departments.</p>
    <p>Chief Executive John Lee emphasized that this digital transformation represents a significant step toward making Hong Kong a world-class smart city. The project will be implemented in phases over the next 18 months, with the first services launching in Q3 2024.</p>`,
  lede: "The Hong Kong government has announced a comprehensive digital governance initiative for 2024, focusing on streamlining public services and enhancing citizen engagement through technology.",
  summary: "A comprehensive digital governance initiative for 2024 focusing on streamlining public services and enhancing citizen engagement through technology.",
  enhanced_title: "Hong Kong Government Unveils Comprehensive 2024 Digital Governance Initiative",
  key_points: [
    "Unified digital identity system implementation",
    "Online service portals for all government departments",
    "AI-powered citizen support services",
    "Phased implementation over 18 months",
    "First services launching in Q3 2024"
  ],
  why_it_matters: "This initiative represents Hong Kong's significant step toward becoming a world-class smart city, potentially reducing bureaucratic delays and improving service delivery for millions of residents.",
  image_url: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&h=400&fit=crop",
  image_license: "Unsplash License - Photo by Unsplash",
  source: "Perplexity AI",
  author: "AI Generated",
  perplexity_model: "sonar-pro",
  generation_cost: 0.0001,
  citations: [
    "https://gov.hk/digital-governance-2024",
    "https://smartcity.gov.hk/initiatives"
  ],
  structured_sources: {
    citations: [
      "https://gov.hk/digital-governance-2024",
      "https://smartcity.gov.hk/initiatives"
    ],
    sources: [
      {
        title: "Hong Kong Digital Governance Initiative 2024",
        url: "https://gov.hk/digital-governance-2024",
        domain: "gov.hk",
        description: "Official government announcement of digital governance initiative"
      },
      {
        title: "Smart City Hong Kong Initiatives",
        url: "https://smartcity.gov.hk/initiatives",
        domain: "smartcity.gov.hk",
        description: "Overview of Hong Kong's smart city development plans"
      }
    ],
    generated_at: "2024-01-15T10:32:00Z"
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    console.log(`🔍 Fetching perplexity article with ID: ${params.id}`)

    // Check if Perplexity news table is set up
    const isTableReady = await checkPerplexityNewsTableSetup()
    console.log("Perplexity news table ready status:", isTableReady)

    if (!isTableReady) {
      console.warn("Perplexity news table not set up, using mock data")
      const mockArticle = transformPerplexityToArticle({
        ...mockPerplexityArticle,
        id: params.id
      })
      return NextResponse.json({
        ...mockArticle,
        usingMockData: true,
        debug: "Perplexity news table not set up"
      })
    }

    // Fetch the specific perplexity article from database
    console.log(`🔍 Querying database for article ID: ${params.id}`)
    const { data: article, error } = await supabaseAdmin
      .from("perplexity_news")
      .select("*")
      .eq("id", params.id)
      .single()

    if (error) {
      console.error(`❌ Database error for article ${params.id}:`, error)
    }

    if (!article) {
      console.warn(`⚠️  Article not found in database: ${params.id}`)
      
      // Try to find any articles to see what IDs look like
      const { data: allArticles } = await supabaseAdmin
        .from("perplexity_news")
        .select("id, title")
        .limit(5)
      
      console.log(`🔍 Sample article IDs in database:`, allArticles?.map(a => a.id))
      
      const mockArticle = transformPerplexityToArticle({
        ...mockPerplexityArticle,
        id: params.id
      })
      return NextResponse.json({
        ...mockArticle,
        usingMockData: true,
        debug: `Article not found in database. Sample IDs: ${allArticles?.map(a => a.id).join(', ')}`
      })
    }

    console.log(`Found perplexity article: ${article.title}`)

    // Transform PerplexityArticle to Article for consistency
    const transformedArticle = transformPerplexityToArticle(article)

    return NextResponse.json({
      ...transformedArticle,
      usingMockData: false,
      debug: "Using real database data"
    })

  } catch (error) {
    console.error("Error fetching perplexity article:", error)

    // Return mock article as fallback
    const mockArticle = transformPerplexityToArticle({
      ...mockPerplexityArticle,
      id: params.id
    })
    return NextResponse.json({
      ...mockArticle,
      usingMockData: true,
      error: "Database connection failed, using mock data",
      debug: error instanceof Error ? error.message : "Unknown error"
    })
  }
}