import { config } from 'dotenv';
// Load environment variables FIRST
config({ path: '.env.cli' });

import { createClient } from '@supabase/supabase-js';

// Verify env vars are loaded
console.log('🔧 Environment Check:');
console.log('   PERPLEXITY_API_KEY:', process.env.PERPLEXITY_API_KEY?.substring(0, 10) + '...');
console.log('   SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('   CRON_SECRET:', process.env.CRON_SECRET);
console.log('');

// Dynamic import to ensure env vars are loaded
async function runTest() {
  const { perplexityEnhancerV2 } = await import('./lib/perplexity-enhancer-v2');
  
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('🧪 Testing One-Shot Enhancement Implementation\n');

  try {
    // 1. Find an unenhanced article
    console.log('📋 Step 1: Finding unenhanced articles...');
    const { data: articles, error } = await supabase
      .from('articles')
      .select('*')
      .eq('is_ai_enhanced', false)
      .neq('source', 'perplexity')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) throw error;
    if (!articles || articles.length === 0) {
      console.log('❌ No unenhanced articles found');
      return;
    }

    console.log(`   Found ${articles.length} unenhanced articles`);
    
    // Pick the most recent one
    const testArticle = articles[0];
    console.log(`\n📄 Selected article for testing:`);
    console.log(`   Title: "${testArticle.title}"`);
    console.log(`   ID: ${testArticle.id}`);
    console.log(`   Source: ${testArticle.source}`);
    console.log(`   Content length: ${testArticle.content.length} chars`);

    // 2. Test the one-shot enhancement
    console.log('\n🚀 Step 2: Testing ONE-SHOT trilingual enhancement...');
    console.log('   This should make only 1 API call for all 3 languages');
    
    const startTime = Date.now();
    
    try {
      const result = await perplexityEnhancerV2.enhanceTrilingual(
        testArticle.title,
        testArticle.content,
        testArticle.summary || '',
        {
          searchDepth: 'low',
          recencyFilter: 'day',
          maxTokens: 1800
        }
      );
      
      const duration = Date.now() - startTime;
      
      console.log(`\n✅ Enhancement successful! Duration: ${Math.round(duration/1000)} seconds`);
      
      // 3. Display results
      console.log('\n📊 Step 3: Results Summary');
      console.log('\n1️⃣ English Version:');
      console.log(`   Title: ${result.en.title}`);
      console.log(`   Summary: ${result.en.summary.substring(0, 80)}...`);
      console.log(`   Key points: ${result.en.key_points.length}`);
      console.log(`   Citations: ${result.en.citations.length}`);
      console.log(`   Sample key point: ${result.en.key_points[0]}`);
      
      console.log('\n2️⃣ Traditional Chinese (zh-TW):');
      console.log(`   Title: ${result.zh_HK.title}`);
      console.log(`   Key points: ${result.zh_HK.key_points.length}`);
      console.log(`   Sample key point: ${result.zh_HK.key_points[0]}`);
      
      console.log('\n3️⃣ Simplified Chinese (zh-CN):');
      console.log(`   Title: ${result.zh_CN.title}`);
      console.log(`   Key points: ${result.zh_CN.key_points.length}`);
      console.log(`   Sample key point: ${result.zh_CN.key_points[0]}`);
      
      // 4. Save test results to database
      console.log('\n💾 Step 4: Saving test results to database...');
      
      const testBatchId = `test_oneshot_${Date.now()}`;
      const enhancedAt = new Date().toISOString();
      
      // Prepare the enhanced articles
      const enhancedArticles = [
        // English version
        {
          title: result.en.title,
          content: `<p>${result.en.summary}</p><h3>Key Points</h3><ul>${result.en.key_points.map(p => `<li>${p}</li>`).join('')}</ul><h3>Why It Matters</h3><p>${result.en.why_it_matters}</p>`,
          summary: result.en.summary,
          url: `${testArticle.url}#test-en-${Date.now()}`,
          source: testArticle.source,
          category: testArticle.category || 'general',
          published_at: testArticle.published_at,
          is_ai_enhanced: true,
          original_article_id: testArticle.id,
          enhancement_metadata: {
            language: 'en',
            trilingual_batch_id: testBatchId,
            source_article_id: testArticle.id,
            enhanced_at: enhancedAt,
            one_shot_generation: true,
            test_run: true,
            enhancement_method: 'one-shot',
            processing_time_ms: duration,
            estimated_cost: 0.025
          }
        },
        // Traditional Chinese version
        {
          title: result.zh_HK.title,
          content: `<p>${result.zh_HK.summary}</p><h3>重點</h3><ul>${result.zh_HK.key_points.map(p => `<li>${p}</li>`).join('')}</ul><h3>重要性</h3><p>${result.zh_HK.why_it_matters}</p>`,
          summary: result.zh_HK.summary,
          url: `${testArticle.url}#test-zh-TW-${Date.now()}`,
          source: testArticle.source,
          category: testArticle.category || 'general',
          published_at: testArticle.published_at,
          is_ai_enhanced: true,
          original_article_id: testArticle.id,
          enhancement_metadata: {
            language: 'zh-TW',
            trilingual_batch_id: testBatchId,
            source_article_id: testArticle.id,
            enhanced_at: enhancedAt,
            one_shot_generation: true,
            test_run: true,
            enhancement_method: 'one-shot',
            processing_time_ms: duration,
            estimated_cost: 0.025
          }
        },
        // Simplified Chinese version
        {
          title: result.zh_CN.title,
          content: `<p>${result.zh_CN.summary}</p><h3>重点</h3><ul>${result.zh_CN.key_points.map(p => `<li>${p}</li>`).join('')}</ul><h3>重要性</h3><p>${result.zh_CN.why_it_matters}</p>`,
          summary: result.zh_CN.summary,
          url: `${testArticle.url}#test-zh-CN-${Date.now()}`,
          source: testArticle.source,
          category: testArticle.category || 'general',
          published_at: testArticle.published_at,
          is_ai_enhanced: true,
          original_article_id: testArticle.id,
          enhancement_metadata: {
            language: 'zh-CN',
            trilingual_batch_id: testBatchId,
            source_article_id: testArticle.id,
            enhanced_at: enhancedAt,
            one_shot_generation: true,
            test_run: true,
            enhancement_method: 'one-shot',
            processing_time_ms: duration,
            estimated_cost: 0.025
          }
        }
      ];
      
      const { data: savedArticles, error: saveError } = await supabase
        .from('articles')
        .insert(enhancedArticles)
        .select();
      
      if (saveError) {
        console.error('❌ Error saving to database:', saveError);
      } else {
        console.log(`✅ Successfully saved ${savedArticles.length} enhanced articles`);
        console.log(`   Batch ID: ${testBatchId}`);
      }
      
      // 5. Cost Analysis
      console.log('\n💰 Step 5: Cost Analysis');
      console.log('   One-shot method: ~$0.025 (1 API call)');
      console.log('   Old sequential method: ~$0.075 (3 API calls)');
      console.log('   Savings: $0.05 per article (66% reduction)');
      console.log('   If processing 1000 articles/day: $50 saved daily');
      
      // 6. Verification
      console.log('\n🔍 Step 6: Verification Query');
      console.log('   Run this SQL to verify the test results:');
      console.log(`   
SELECT 
  id,
  title,
  enhancement_metadata->>'language' as language,
  enhancement_metadata->>'one_shot_generation' as one_shot,
  enhancement_metadata->>'trilingual_batch_id' as batch_id,
  created_at
FROM articles 
WHERE enhancement_metadata->>'trilingual_batch_id' = '${testBatchId}'
ORDER BY enhancement_metadata->>'language';`);
      
    } catch (enhanceError) {
      console.error('\n❌ Enhancement failed:', enhanceError);
      if (enhanceError instanceof Error) {
        console.error('   Error message:', enhanceError.message);
        console.error('   Stack:', enhanceError.stack);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
    }
  }
}

// Run the test
console.log('Starting test...\n');
runTest().catch(console.error);