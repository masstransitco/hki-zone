import { type NextRequest, NextResponse } from "next/server";
import { perplexityHKNews } from "@/lib/perplexity-hk-news";
import { perplexityImageSearch } from "@/lib/perplexity-image-search";
import { 
  getPendingUnifiedArticles, 
  updateArticleProcessingStatus,
  updateUnifiedArticle,
  trackImageUsage 
} from "@/lib/supabase-unified";
import type { UnifiedArticle } from "@/lib/types/unified";

export async function GET(request: NextRequest) {
  // Verify the request is from Vercel Cron
  const userAgent = request.headers.get("user-agent");
  if (userAgent !== "vercel-cron/1.0") {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    console.log("🚀 Unified article enricher cron job started:", new Date().toISOString());

    // Get pending AI-generated articles that need enrichment
    const pendingArticles = await getPendingUnifiedArticles(10, 'ai_generated');
    
    if (pendingArticles.length === 0) {
      console.log("📄 No pending articles to enrich");
      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        result: {
          processed: 0,
          totalCost: 0,
          message: 'No pending articles to process'
        },
      });
    }

    console.log(`🔄 Processing ${pendingArticles.length} pending articles...`);

    let totalCost = 0;
    let processed = 0;
    let imageProcessed = 0;

    // Process articles one by one to respect rate limits
    for (const article of pendingArticles) {
      try {
        console.log(`📝 Processing article ${processed + 1}/${pendingArticles.length}: ${article.title}`);
        console.log(`   Status: ${article.processing_status}, Has Image: ${article.features.has_image}`);

        // Mark as processing
        await updateArticleProcessingStatus(article.id, 'processing');

        // Step 1: Enrich article content
        console.log(`   🔄 Enriching article content with contextual data...`);
        
        // Convert UnifiedArticle to format expected by enrichment
        const perplexityArticle = {
          id: article.id,
          title: article.title,
          category: article.category,
          url: article.url,
          created_at: article.created_at,
          updated_at: article.updated_at
        };
        
        const contextualEnrichment = await perplexityHKNews.enrichArticleWithContext(perplexityArticle);
        const enrichment = perplexityHKNews.contextualToArticleEnrichment(contextualEnrichment);
        
        console.log(`   💾 Updating article with enhanced structured content...`);
        
        // Prepare updates - NEVER modify published_at
        const updates: Partial<UnifiedArticle> = {
          summary: enrichment.summary,
          lede: enrichment.lede,
          key_points: enrichment.key_points,
          why_it_matters: enrichment.why_it_matters,
          content: `<p>${enrichment.lede}</p>${enrichment.body_html}`,
          generation_metadata: {
            ...article.generation_metadata,
            enhanced_title: enrichment.enhanced_title,
            image_prompt: enrichment.image_prompt,
            citations: enrichment.citations,
            generated_at: new Date().toISOString()
          },
          structured_sources: {
            citations: enrichment.citations,
            sources: enrichment.sources,
            generated_at: new Date().toISOString()
          },
          contextual_data: {
            contextual_bullets: contextualEnrichment.contextual_bullets,
            data_points: contextualEnrichment.data_points,
            historical_references: contextualEnrichment.historical_references,
            enrichment_version: 'contextual_v1'
          }
        };

        // Update the article
        const { error: updateError } = await updateUnifiedArticle(article.id, updates);
        
        if (updateError) {
          throw updateError;
        }

        console.log(`✅ Article enriched: ${enrichment.enhanced_title}`);
        console.log(`   📋 Key points: ${enrichment.key_points.length} items`);
        console.log(`   🔗 Sources: ${enrichment.sources.length} citations`);

        // Step 2: Process image if needed
        if (!article.features.has_image) {
          try {
            console.log(`🎯 Searching for image using enriched metadata`);
            
            const imageResult = await perplexityImageSearch.findImageWithMetadata(
              {
                title: enrichment.enhanced_title,
                imagePrompt: enrichment.image_prompt,
                summary: enrichment.summary,
                keyPoints: enrichment.key_points,
                sources: enrichment.sources,
                citations: enrichment.citations
              },
              article.category
            );

            // Update article with image
            await updateUnifiedArticle(article.id, {
              image_url: imageResult.url,
              image_metadata: {
                license: imageResult.license,
                attribution: imageResult.attribution,
                original: imageResult.url
              },
              features: {
                ...article.features,
                has_image: true
              }
            });

            // Track image usage
            if (imageResult.source === 'unsplash') {
              await trackImageUsage('unsplash', imageResult.id, article.id);
            } else if (imageResult.source === 'google_cse') {
              await trackImageUsage('google_cse', imageResult.url, article.id);
            }

            imageProcessed++;
            console.log(`   ✅ Image added: ${imageResult.source} - ${imageResult.url}`);
          } catch (imageError) {
            console.error(`   ❌ Failed to add image: ${imageError.message}`);
            // Don't fail the whole enrichment if image fails
          }
        }

        // Mark as ready
        await updateArticleProcessingStatus(article.id, 'ready', {
          generation_cost: article.generation_cost + (contextualEnrichment.cost || 0)
        });

        processed++;
        totalCost += contextualEnrichment.cost || 0;

        // Add delay between articles to respect rate limits
        if (processed < pendingArticles.length) {
          console.log(`   ⏳ Waiting 2 seconds before next article...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (error) {
        console.error(`❌ Failed to process article "${article.title}":`, error);
        
        // Mark as failed
        await updateArticleProcessingStatus(article.id, 'failed');
      }
    }

    console.log("✅ Enrichment cron job completed successfully");
    console.log(`   Articles processed: ${processed}`);
    console.log(`   Images added: ${imageProcessed}`);
    console.log(`   Total cost: $${totalCost.toFixed(4)}`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result: {
        processed,
        imagesAdded: imageProcessed,
        totalCost,
        message: `Successfully enriched ${processed} articles`
      },
    });

  } catch (error) {
    console.error("💥 Enrichment cron job failed:", error);
    return NextResponse.json(
      {
        success: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}