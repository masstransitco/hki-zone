import { config } from 'dotenv';
// Load environment variables FIRST
config({ path: '.env.cli' });

import { createClient } from '@supabase/supabase-js';

async function testSearchEnhancement() {
  const { perplexityEnhancerV2 } = await import('./lib/perplexity-enhancer-v2');
  
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('🧪 Testing One-Shot Enhancement with Search Functionality\n');

  try {
    // 1. Find a recent unenhanced article
    console.log('📋 Finding an unenhanced article...');
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

    const testArticle = articles[0];
    console.log(`\n📄 Selected article:`);
    console.log(`   Title: "${testArticle.title}"`);
    console.log(`   ID: ${testArticle.id}`);
    console.log(`   Source: ${testArticle.source}`);

    // 2. Test the one-shot enhancement with search
    console.log('\n🚀 Testing ONE-SHOT enhancement with search instructions...');
    console.log('   The API should now search for recent information');
    
    const startTime = Date.now();
    
    try {
      const result = await perplexityEnhancerV2.enhanceTrilingual(
        testArticle.title,
        testArticle.content,
        testArticle.summary || '',
        {
          searchDepth: 'high',
          recencyFilter: 'day',
          maxTokens: 2000 // Increase to accommodate search results
        }
      );
      
      const duration = Date.now() - startTime;
      
      console.log(`\n✅ Enhancement successful! Duration: ${Math.round(duration/1000)} seconds`);
      
      // 3. Analyze results
      console.log('\n📊 Search Enhancement Results:');
      
      console.log('\n1️⃣ English Version Analysis:');
      console.log(`   Title: ${result.en.title}`);
      console.log(`   Citations count: ${result.en.citations.length}`);
      console.log(`   Has multiple sources: ${result.en.citations.length > 3 ? '✅ YES' : '❌ NO'}`);
      
      if (result.en.citations.length > 0) {
        console.log('\n   Citation URLs:');
        result.en.citations.forEach((cite, idx) => {
          console.log(`   ${idx + 1}. ${cite.url || 'No URL'}`);
        });
      }
      
      console.log('\n2️⃣ Content Analysis:');
      const content = result.en.content || '';
      console.log(`   References recent events: ${content.includes('2025') || content.includes('recent') ? '✅' : '❌'}`);
      console.log(`   Has contextual information: ${content.length > 500 ? '✅' : '❌'}`);
      console.log(`   Key points with citations: ${result.en.key_points.some(kp => kp.includes('[')) ? '✅' : '❌'}`);
      
      console.log('\n3️⃣ Traditional Chinese:');
      console.log(`   Citations count: ${result.zh_HK.citations.length}`);
      
      console.log('\n4️⃣ Simplified Chinese:');
      console.log(`   Citations count: ${result.zh_CN.citations.length}`);
      
      // 4. Save test results
      console.log('\n💾 Saving test results...');
      const testBatchId = `test_search_${Date.now()}`;
      
      // Create a test record
      const testRecord = {
        title: `TEST: ${result.en.title}`,
        content: result.en.content || 'Test content',
        summary: result.en.summary,
        url: `${testArticle.url}#test-search`,
        source: testArticle.source,
        category: testArticle.category || 'general',
        published_at: testArticle.published_at,
        is_ai_enhanced: true,
        original_article_id: testArticle.id,
        enhancement_metadata: {
          test_type: 'search_enhancement_test',
          trilingual_batch_id: testBatchId,
          one_shot_generation: true,
          search_enabled: true,
          citations_count: result.en.citations.length,
          processing_time_ms: duration,
          sources: result.en.citations.map((cite, idx) => ({
            url: cite.url || '',
            title: cite.text || `Source ${idx + 1}`,
            domain: cite.url ? new URL(cite.url).hostname.replace('www.', '') : 'unknown',
            snippet: cite.text || '',
            accessedAt: new Date().toISOString()
          }))
        }
      };
      
      const { error: saveError } = await supabase
        .from('articles')
        .insert(testRecord);
      
      if (saveError) {
        console.error('❌ Save error:', saveError);
      } else {
        console.log('✅ Test record saved');
      }
      
      // 5. Comparison
      console.log('\n📈 Comparison with Old Method:');
      console.log('   Old method: 9-15 sources, 3 separate API calls');
      console.log(`   New method: ${result.en.citations.length} sources, 1 API call`);
      console.log(`   Search quality: ${result.en.citations.length >= 5 ? '✅ Good' : '⚠️  Needs improvement'}`);
      
    } catch (enhanceError) {
      console.error('\n❌ Enhancement failed:', enhanceError);
      if (enhanceError instanceof Error) {
        console.error('   Error message:', enhanceError.message);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

// Run the test
console.log('Starting search enhancement test...\n');
testSearchEnhancement().catch(console.error);