import { config } from 'dotenv';
config({ path: '.env.cli' });

import { createClient } from '@supabase/supabase-js';
import { batchEnhanceTrilingualArticles } from './lib/perplexity-trilingual-enhancer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function testEnhanceExisting() {
  console.log('🧪 Testing one-shot enhancement on existing articles...\n');

  try {
    // 1. Get articles that are selected but not enhanced
    const { data: pendingArticles, error } = await supabase
      .from('articles')
      .select('*')
      .eq('selected_for_enhancement', true)
      .eq('is_ai_enhanced', false)
      .limit(1);

    if (error) throw error;

    if (!pendingArticles || pendingArticles.length === 0) {
      console.log('No pending articles found. Let me get a recent unenhanced article...');
      
      // Get any recent article that hasn't been enhanced
      const { data: recentArticles, error: recentError } = await supabase
        .from('articles')
        .select('*')
        .eq('is_ai_enhanced', false)
        .neq('source', 'perplexity')
        .order('created_at', { ascending: false })
        .limit(1);

      if (recentError) throw recentError;
      
      if (!recentArticles || recentArticles.length === 0) {
        console.log('❌ No unenhanced articles found');
        return;
      }

      pendingArticles.push(...recentArticles);
    }

    const article = pendingArticles[0];
    console.log('📄 Selected article for enhancement:');
    console.log(`   Title: "${article.title}"`);
    console.log(`   ID: ${article.id}`);
    console.log(`   Source: ${article.source}`);
    console.log(`   Created: ${article.created_at}\n`);

    // 2. Prepare article for enhancement
    const sourceArticle = {
      id: article.id,
      title: article.title,
      url: article.url,
      category: article.category || 'general',
      source: article.source,
      content: article.content,
      summary: article.summary,
      published_at: article.published_at,
      created_at: article.created_at,
      image_url: article.image_url,
      author: article.author,
      selection_reason: 'Manual test selection',
      priority_score: 85
    };

    // 3. Test the one-shot enhancement
    console.log('🚀 Starting ONE-SHOT trilingual enhancement...');
    console.log('   This should make only 1 API call for all 3 languages\n');
    
    const batchId = `test_oneshot_${Date.now()}`;
    const startTime = Date.now();
    
    const enhancedArticles = await batchEnhanceTrilingualArticles(
      [sourceArticle],
      batchId
    );
    
    const duration = Date.now() - startTime;
    
    console.log(`\n✅ Enhancement completed in ${Math.round(duration/1000)} seconds`);
    console.log(`   Generated ${enhancedArticles.length} articles (should be 3)\n`);

    // 4. Show results
    console.log('📊 Enhanced articles summary:');
    enhancedArticles.forEach((article, index) => {
      console.log(`\n${index + 1}. ${article.language} version:`);
      console.log(`   Title: ${article.title}`);
      console.log(`   Summary: ${article.summary.substring(0, 100)}...`);
      console.log(`   Key points: ${article.key_points?.length || 0}`);
      console.log(`   One-shot flag: ${article.enhancement_metadata?.one_shot_generation || false}`);
    });

    // 5. Cost analysis
    console.log('\n💰 Cost Analysis:');
    console.log('   One-shot method: ~$0.025 (1 API call for 3 languages)');
    console.log('   Old sequential method: ~$0.075 (3 separate API calls)');
    console.log('   Savings: 66% reduction\n');

    // 6. Check if we would save to database
    console.log('📝 Note: These enhanced articles were NOT saved to the database');
    console.log('   This was just a test of the one-shot enhancement method');

  } catch (error) {
    console.error('\n❌ Error:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    }
  }
}

// Run the test
testEnhanceExisting();