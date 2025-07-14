import { NextRequest, NextResponse } from 'next/server';
import { selectArticlesWithPerplexity } from '@/lib/perplexity-article-selector';
import { batchEnhanceTrilingualArticles } from '@/lib/perplexity-trilingual-enhancer';
import { saveEnhancedArticles } from '@/lib/article-saver';

function generateBatchId(): string {
  return `cron_single_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

function calculateTrilingualCost(enhancedArticles: any[]): number {
  // Estimate: ~$0.075 per enhanced article
  return enhancedArticles.length * 0.075;
}

export async function GET(request: NextRequest) {
  // Verify this is a Vercel cron request
  const authHeader = request.headers.get('authorization');
  const isVercelCron = request.headers.get('user-agent')?.includes('vercel-cron') || 
                       authHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (!isVercelCron) {
    console.log('Unauthorized cron request blocked');
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const startTime = Date.now();
    const batchId = generateBatchId();

    console.log('🤖 [CRON] Starting hourly single article trilingual enhancement...');

    // Check if Perplexity API is configured
    if (!process.env.PERPLEXITY_API_KEY) {
      console.error('[CRON] Perplexity API key not configured');
      return NextResponse.json({
        success: false,
        error: 'Perplexity API key not configured',
        timestamp: new Date().toISOString()
      }, { status: 503 });
    }

    // 1. Let Perplexity select 1 best article from existing non-enhanced articles
    console.log('[CRON] 🔍 AI selecting 1 article for trilingual enhancement...');
    const selectedArticles = await selectArticlesWithPerplexity(1);

    if (!selectedArticles || selectedArticles.length === 0) {
      console.log('[CRON] ⚠️ No articles available for selection');
      return NextResponse.json({
        success: false,
        error: 'No articles available for selection or Perplexity selection failed',
        timestamp: new Date().toISOString(),
        details: 'This usually means all recent articles have already been enhanced'
      }, { status: 422 });
    }

    console.log(`[CRON] ✅ Selected article: "${selectedArticles[0].title}"`);

    // 2. Trilingual enhancement for the selected article
    console.log('[CRON] 🌐 Enhancing article in 3 languages...');
    const enhancedArticles = await batchEnhanceTrilingualArticles(selectedArticles, batchId);

    if (!enhancedArticles || enhancedArticles.length === 0) {
      console.error('[CRON] ❌ Failed to enhance article');
      return NextResponse.json({
        success: false,
        error: 'Failed to enhance article',
        sourceArticles: selectedArticles.length,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

    // 3. Save all enhanced articles to database
    console.log('[CRON] 💾 Saving enhanced articles to database...');
    const savedArticles = await saveEnhancedArticles(enhancedArticles, batchId);

    const processingTime = Date.now() - startTime;
    const estimatedCost = calculateTrilingualCost(enhancedArticles);

    console.log(`[CRON] ✅ Single trilingual enhancement complete: 1 → ${savedArticles.length} articles in ${Math.round(processingTime / 1000)}s`);

    return NextResponse.json({
      success: true,
      message: `Hourly trilingual enhancement completed: 1 → ${savedArticles.length} articles`,
      batchId,
      sourceArticles: selectedArticles.length,
      totalEnhanced: enhancedArticles.length,
      totalSaved: savedArticles.length,
      selectedArticle: {
        id: selectedArticles[0].id,
        title: selectedArticles[0].title,
        source: selectedArticles[0].source,
        selectionReason: selectedArticles[0].selection_reason,
        priorityScore: selectedArticles[0].priority_score
      },
      articlesByLanguage: {
        english: enhancedArticles.filter(a => a.language === 'en').length,
        traditionalChinese: enhancedArticles.filter(a => a.language === 'zh-TW').length,
        simplifiedChinese: enhancedArticles.filter(a => a.language === 'zh-CN').length
      },
      processingTime,
      processingTimeMinutes: Math.round(processingTime / 60000 * 10) / 10,
      estimatedCost: estimatedCost.toFixed(4),
      timestamp: new Date().toISOString(),
      articles: savedArticles.map(article => ({
        id: article.id,
        title: article.title,
        language: article.language,
        url: article.url,
        source: article.source,
        qualityScore: article.quality_score
      }))
    });

  } catch (error) {
    console.error('[CRON] Auto-enhance single article error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
      type: 'cron_error'
    }, { status: 500 });
  }
}

// Optional: Support manual testing via POST
export async function POST(request: NextRequest) {
  console.log('Manual trigger of single article enhancement cron job');
  return GET(request);
}