import { type NextRequest, NextResponse } from "next/server"
import { perplexityHKNews } from "@/lib/perplexity-hk-news"
import { perplexityImageSearch } from "@/lib/perplexity-image-search"
import { getPendingPerplexityNews, updatePerplexityArticle } from "@/lib/supabase-server"

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { batchSize = 10, forceAll = false } = body

    console.log("🚀 Manual Perplexity enrichment trigger started:", new Date().toISOString())
    console.log(`📊 Settings: batchSize=${batchSize}, forceAll=${forceAll}`)

    // Get pending articles that need enrichment
    const pendingArticles = await getPendingPerplexityNews(batchSize)
    
    if (pendingArticles.length === 0) {
      console.log("📄 No pending articles to enrich")
      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        result: {
          processed: 0,
          totalCost: 0,
          message: 'No pending articles to process'
        },
      })
    }

    console.log(`🔄 Processing ${pendingArticles.length} pending articles...`)

    let totalCost = 0
    let processed = 0
    let imageProcessed = 0
    let errors = []

    // Process articles in batches to respect rate limits
    for (const article of pendingArticles) {
      try {
        console.log(`📝 Processing article ${processed + 1}/${pendingArticles.length}: ${article.title}`)
        console.log(`   Status: ${article.article_status}, Image Status: ${article.image_status}`)

        // Step 1: Enrich article content (if not already enriched or if forced)
        if (article.article_status === 'pending' || forceAll) {
          console.log(`   🔄 Enriching article content...`)
          const enrichment = await perplexityHKNews.enrichArticle(article)
          
          console.log(`   💾 Updating article with enriched content...`)
          await updatePerplexityArticle(article.id!, {
            article_status: 'enriched',
            lede: enrichment.lede,
            article_html: `<p>${enrichment.lede}</p>${enrichment.body_html}`,
            image_prompt: enrichment.image_prompt
          })

          console.log(`✅ Article enriched: ${article.title}`)
          totalCost += enrichment.cost || 0
        } else {
          console.log(`   ⏭️  Article already enriched, skipping content enrichment`)
        }

        // Step 2: Process image (if image is pending, failed, or forced)
        if (article.image_status === 'pending' || article.image_status === 'failed' || forceAll) {
          // Use article title for more relevant image search
          const imageQuery = article.title
          try {
            console.log(`   🖼️  Searching for image with query: "${imageQuery}"`)
            const imageResult = await perplexityImageSearch.findImage(
              imageQuery,
              article.category
            )

            await updatePerplexityArticle(article.id!, {
              article_status: 'ready',
              image_status: 'ready',
              image_url: imageResult.url,
              image_license: `${imageResult.license} - ${imageResult.attribution}`
            })

            imageProcessed++
            console.log(`🖼️ Image added: ${imageResult.source} - ${imageResult.url}`)
          } catch (imageError) {
            console.error(`❌ Image processing failed for "${article.title}":`, imageError)
            errors.push({
              articleId: article.id,
              articleTitle: article.title,
              error: 'Image processing failed',
              details: imageError.message
            })
            
            // Mark article as ready even without image
            await updatePerplexityArticle(article.id!, {
              article_status: 'ready',
              image_status: 'failed'
            })
          }
        } else if (article.article_status === 'enriched') {
          // Mark as ready if no image needed
          await updatePerplexityArticle(article.id!, {
            article_status: 'ready'
          })
        }

        processed++

        // Rate limiting between requests (2 seconds for better API stability)
        if (processed < pendingArticles.length) {
          console.log(`   ⏱️  Rate limiting - waiting 2 seconds...`)
          await new Promise(resolve => setTimeout(resolve, 2000))
        }

      } catch (error) {
        console.error(`💥 Failed to process article "${article.title}":`, error)
        errors.push({
          articleId: article.id,
          articleTitle: article.title,
          error: 'Processing failed',
          details: error.message
        })
        
        // Mark as ready with minimal content to prevent infinite reprocessing
        try {
          await updatePerplexityArticle(article.id!, {
            article_status: 'ready',
            article_html: `<p>${article.title}</p><p>Content processing failed. Please check the original source for details.</p>`,
            image_status: 'failed'
          })
        } catch (updateError) {
          console.error(`💥 Failed to update failed article:`, updateError)
          errors.push({
            articleId: article.id,
            articleTitle: article.title,
            error: 'Failed to update after processing error',
            details: updateError.message
          })
        }
      }
    }

    console.log(`✅ Manual enrichment completed: ${processed}/${pendingArticles.length} articles processed, ${imageProcessed} images added`)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result: {
        processed,
        imageProcessed,
        totalCost,
        total: pendingArticles.length,
        errors: errors.length,
        errorDetails: errors,
        message: `Successfully processed ${processed} articles with ${imageProcessed} images${errors.length > 0 ? ` (${errors.length} errors)` : ''}`
      },
    })
  } catch (error) {
    console.error("💥 Manual Perplexity enrichment trigger failed:", error)

    return NextResponse.json({
      success: false,
      timestamp: new Date().toISOString(),
      error: error.message,
    }, { status: 500 })
  }
}