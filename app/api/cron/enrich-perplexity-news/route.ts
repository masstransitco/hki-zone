import { type NextRequest, NextResponse } from "next/server"
import { perplexityHKNews } from "@/lib/perplexity-hk-news"
import { perplexityImageSearch } from "@/lib/perplexity-image-search"
import { getPendingPerplexityNews, updatePerplexityArticle } from "@/lib/supabase-server"

export async function GET(request: NextRequest) {
  // Verify the request is from Vercel Cron
  const userAgent = request.headers.get("user-agent")
  if (userAgent !== "vercel-cron/1.0") {
    return new Response("Unauthorized", {
      status: 401,
    })
  }

  try {
    console.log("🚀 Perplexity content enricher cron job started:", new Date().toISOString())

    // Get pending articles that need enrichment
    const pendingArticles = await getPendingPerplexityNews(10)
    
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

    // Process articles in batches to respect rate limits
    for (const article of pendingArticles) {
      try {
        console.log(`📝 Processing article ${processed + 1}/${pendingArticles.length}: ${article.title}`)
        console.log(`   Status: ${article.article_status}, Image Status: ${article.image_status}`)

        // Step 1: Enrich article content (if not already enriched)
        if (article.article_status === 'pending') {
          console.log(`   🔄 Enriching article content...`)
          const enrichment = await perplexityHKNews.enrichArticle(article)
          
          console.log(`   💾 Updating article with enhanced structured content...`)
          
          // Prepare structured sources for JSON storage
          const structuredSources = {
            citations: enrichment.citations,
            sources: enrichment.sources,
            generated_at: new Date().toISOString()
          }
          
          // Prepare update object with only legacy fields first
          const updateData = {
            article_status: 'enriched',
            // Legacy fields for backward compatibility
            lede: enrichment.lede,
            article_html: `<p>${enrichment.lede}</p>${enrichment.body_html}`,
            image_prompt: enrichment.image_prompt
          }

          // Try to update with enhanced fields, fall back to legacy fields if schema not migrated
          try {
            await updatePerplexityArticle(article.id!, {
              ...updateData,
              // New enhanced fields
              enhanced_title: enrichment.enhanced_title,
              summary: enrichment.summary,
              key_points: enrichment.key_points,
              why_it_matters: enrichment.why_it_matters,
              structured_sources: structuredSources
            })
          } catch (schemaError) {
            if (schemaError.code === 'PGRST204') {
              console.log(`⚠️  Enhanced fields not available in schema, using legacy fields only`)
              await updatePerplexityArticle(article.id!, updateData)
            } else {
              throw schemaError
            }
          }

          console.log(`✅ Article enriched with enhanced structure: ${enrichment.enhanced_title}`)
          console.log(`   📋 Key points: ${enrichment.key_points.length} items`)
          console.log(`   🔗 Sources: ${enrichment.sources.length} citations`)
        } else {
          console.log(`   ⏭️  Article already enriched, skipping content enrichment`)
        }

        // Step 2: Process image (if image is pending or failed)
        // Use the article data we already have to avoid unnecessary DB calls
        const currentArticle = article

        if (currentArticle.image_status === 'pending' || currentArticle.image_status === 'failed') {
          // Use article title for more relevant image search
          const imageQuery = currentArticle.title
          try {
            const imageResult = await perplexityImageSearch.findImage(
              imageQuery,
              currentArticle.category
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
            
            // Mark article as ready even without image
            await updatePerplexityArticle(article.id!, {
              article_status: 'ready',
              image_status: 'failed'
            })
          }
        } else if (currentArticle.article_status === 'enriched') {
          // Mark as ready if no image needed
          await updatePerplexityArticle(article.id!, {
            article_status: 'ready'
          })
        }

        processed++

        // Rate limiting between requests (2 seconds for better API stability)
        if (processed < pendingArticles.length) {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }

      } catch (error) {
        console.error(`💥 Failed to process article "${article.title}":`, error)
        
        // Mark as ready with minimal content to prevent infinite reprocessing
        try {
          await updatePerplexityArticle(article.id!, {
            article_status: 'ready',
            article_html: `<p>${article.title}</p><p>Content processing failed. Please check the original source for details.</p>`,
            image_status: 'failed'
          })
        } catch (updateError) {
          console.error(`💥 Failed to update failed article:`, updateError)
        }
      }
    }

    console.log(`✅ Content enricher completed: ${processed}/${pendingArticles.length} articles processed, ${imageProcessed} images added`)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result: {
        processed,
        imageProcessed,
        totalCost,
        total: pendingArticles.length,
        message: `Successfully processed ${processed} articles with ${imageProcessed} images`
      },
    })
  } catch (error) {
    console.error("💥 Perplexity content enricher cron job failed:", error)

    return NextResponse.json({
      success: false,
      timestamp: new Date().toISOString(),
      error: error.message,
    }, { status: 500 })
  }
}