import { type NextRequest, NextResponse } from "next/server"
import { getArticleById, checkDatabaseSetup } from "@/lib/supabase"

// Mock article data as fallback
const mockArticle = {
  id: "1",
  title: "AI Revolution: How Machine Learning is Transforming Healthcare",
  summary:
    "Artificial intelligence is revolutionizing healthcare with breakthrough applications in diagnosis, treatment planning, and drug discovery. Recent studies show AI can detect diseases earlier than traditional methods.",
  content: `The healthcare industry is experiencing a paradigm shift as artificial intelligence technologies become increasingly sophisticated and accessible. From diagnostic imaging to personalized treatment plans, AI is transforming how medical professionals approach patient care.

Recent breakthroughs in machine learning have enabled computers to analyze medical images with unprecedented accuracy. Studies have shown that AI systems can detect certain cancers, eye diseases, and neurological conditions earlier and more accurately than human specialists in many cases.

Drug discovery, traditionally a process that takes decades and billions of dollars, is being accelerated through AI-powered molecular analysis. Companies are now using machine learning to identify promising drug compounds in months rather than years.

The integration of AI in healthcare is not without challenges. Privacy concerns, regulatory hurdles, and the need for extensive validation remain significant obstacles. However, the potential benefits for patient outcomes and healthcare efficiency continue to drive innovation in this space.`,
  url: "https://example.com/ai-healthcare",
  source: "TechHealth Today",
  publishedAt: "2024-01-15T10:30:00Z",
  imageUrl: "/placeholder.svg?height=400&width=800",
  category: "Technology",
  readTime: 5,
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check if database is set up
    const isDatabaseReady = await checkDatabaseSetup()

    if (!isDatabaseReady) {
      console.warn("Database not set up, using mock data")
      return NextResponse.json({
        ...mockArticle,
        id: params.id,
        usingMockData: true,
      })
    }

    const article = await getArticleById(params.id)

    if (!article) {
      // Return mock article as fallback
      return NextResponse.json({
        ...mockArticle,
        id: params.id,
        usingMockData: true,
      })
    }

    // Transform to match frontend interface
    const transformedArticle = {
      id: article.id,
      title: article.title,
      summary: article.ai_summary || article.summary,
      content: article.content,
      url: article.url,
      source: article.source,
      publishedAt: article.published_at || article.created_at,
      imageUrl: article.image_url || "/placeholder.svg?height=400&width=800",
      category: article.category || "General",
      readTime: Math.ceil((article.content?.length || 0) / 200) || 3,
      isAiEnhanced: article.is_ai_enhanced || false,
      originalArticleId: article.original_article_id,
      enhancementMetadata: article.enhancement_metadata,
      usingMockData: false,
    }

    return NextResponse.json(transformedArticle)
  } catch (error) {
    console.error("Error fetching article:", error)

    // Return mock article as fallback
    return NextResponse.json({
      ...mockArticle,
      id: params.id,
      usingMockData: true,
      error: "Database connection failed, using mock data",
    })
  }
}
