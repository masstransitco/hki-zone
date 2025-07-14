import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { selectArticlesWithPerplexity } from '@/lib/perplexity-article-selector';
import { batchEnhanceTrilingualArticles } from '@/lib/perplexity-trilingual-enhancer';
import { saveEnhancedArticles } from '@/lib/article-saver';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

function generateBatchId(): string {
  return `batch_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

function calculateTrilingualCost(enhancedArticles: any[]): number {
  // Estimate: ~$0.05-$0.10 per enhanced article
  return enhancedArticles.length * 0.075;
}

export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now();
    const batchId = generateBatchId();

    // Check if Perplexity API is configured
    if (!process.env.PERPLEXITY_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'Perplexity API key not configured'
      }, { status: 503 });
    }

    // 1. Let Perplexity select 10 best articles from existing non-enhanced articles
    const selectedArticles = await selectArticlesWithPerplexity(10);

    if (!selectedArticles || selectedArticles.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No articles available for selection or Perplexity selection failed'
      }, { status: 422 });
    }

    // 2. Trilingual enhancement for each selected article
    const enhancedArticles = await batchEnhanceTrilingualArticles(selectedArticles, batchId);

    if (!enhancedArticles || enhancedArticles.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Failed to enhance articles',
        sourceArticles: selectedArticles.length
      }, { status: 500 });
    }

    // 4. Save all enhanced articles to database
    const savedArticles = await saveEnhancedArticles(enhancedArticles, batchId);

    const processingTime = Date.now() - startTime;
    const estimatedCost = calculateTrilingualCost(enhancedArticles);

    return NextResponse.json({
      success: true,
      batchId,
      sourceArticles: selectedArticles.length,
      totalEnhanced: enhancedArticles.length,
      totalSaved: savedArticles.length,
      articlesByLanguage: {
        english: enhancedArticles.filter(a => a.language === 'en').length,
        traditionalChinese: enhancedArticles.filter(a => a.language === 'zh-TW').length,
        simplifiedChinese: enhancedArticles.filter(a => a.language === 'zh-CN').length
      },
      processingTime,
      processingTimeMinutes: Math.round(processingTime / 60000),
      estimatedCost: estimatedCost.toFixed(4),
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
    console.error('Auto-select headlines error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

// GET endpoint to check configuration status and candidate articles
export async function GET(request: NextRequest) {
  const isConfigured = !!process.env.PERPLEXITY_API_KEY;
  
  if (!isConfigured) {
    return NextResponse.json({
      configured: false,
      message: 'Please configure PERPLEXITY_API_KEY environment variable'
    });
  }

  try {
    // Import here to avoid circular dependency
    const { getSelectionStatistics } = require('@/lib/perplexity-article-selector');
    const stats = await getSelectionStatistics();
    
    return NextResponse.json({
      configured: true,
      message: 'Trilingual auto-enhancement is ready',
      candidateStats: stats
    });
  } catch (error) {
    return NextResponse.json({
      configured: true,
      message: 'API configured but could not fetch candidate statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}