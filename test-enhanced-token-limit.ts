import { config } from 'dotenv';
config({ path: '.env.cli' });

import { createClient } from '@supabase/supabase-js';
import { perplexityEnhancerV2 } from './lib/perplexity-enhancer-v2';

async function testEnhancedTokenLimit() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('🧪 Testing Enhanced Token Limit (2500 tokens)\n');

  try {
    // Find a recent unenhanced article
    console.log('📋 Finding an unenhanced article...');
    const { data: articles, error } = await supabase
      .from('articles')
      .select('*')
      .eq('is_ai_enhanced', false)
      .neq('source', 'perplexity')
      .order('created_at', { ascending: false })
      .limit(1);

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
    console.log(`   Content length: ${testArticle.content.length} chars`);

    // Test with increased token limit
    console.log('\n🚀 Testing ONE-SHOT enhancement with 2500 tokens...');
    
    const startTime = Date.now();
    
    try {
      const result = await perplexityEnhancerV2.enhanceTrilingual(
        testArticle.title,
        testArticle.content,
        testArticle.summary || '',
        {
          searchDepth: 'high',
          recencyFilter: 'day',
          maxTokens: 2500 // Explicit token limit
        }
      );
      
      const duration = Date.now() - startTime;
      
      console.log(`\n✅ Enhancement successful! Duration: ${Math.round(duration/1000)} seconds`);
      
      // Analyze results
      console.log('\n📊 Enhanced Results Analysis:');
      
      console.log('\n1️⃣ English Version:');
      console.log(`   Title: ${result.en.title}`);
      console.log(`   Summary length: ${result.en.summary.length} chars`);
      console.log(`   Content length: ${result.en.content.length} chars`);
      console.log(`   Citations count: ${result.en.citations.length}`);
      console.log(`   Key points: ${result.en.key_points.length}`);
      
      if (result.en.citations.length > 0) {
        console.log('\n   Citation URLs:');
        result.en.citations.forEach((cite, idx) => {
          console.log(`   ${idx + 1}. ${cite.url || 'No URL'}`);
          console.log(`      Text: ${cite.text.substring(0, 50)}...`);
        });
      }
      
      // Check if content was truncated
      const contentComplete = result.en.content.includes('</p>') && 
                            result.en.why_it_matters.length > 10;
      console.log(`\n   Content appears complete: ${contentComplete ? '✅' : '❌'}`);
      
      console.log('\n2️⃣ Traditional Chinese:');
      console.log(`   Title: ${result.zh_HK.title}`);
      console.log(`   Citations count: ${result.zh_HK.citations.length}`);
      console.log(`   Content length: ${result.zh_HK.content.length} chars`);
      
      console.log('\n3️⃣ Simplified Chinese:');
      console.log(`   Title: ${result.zh_CN.title}`);
      console.log(`   Citations count: ${result.zh_CN.citations.length}`);
      console.log(`   Content length: ${result.zh_CN.content.length} chars`);
      
      // Calculate total response size
      const totalSize = JSON.stringify(result).length;
      console.log(`\n📏 Total response size: ${totalSize} characters`);
      console.log(`   Average per language: ${Math.round(totalSize / 3)} characters`);
      
      // Save a test result
      console.log('\n💾 Saving test result...');
      const testRecord = {
        title: `TOKEN_TEST: ${result.en.title}`,
        content: result.en.content,
        summary: result.en.summary,
        url: `${testArticle.url}#token-test-2500`,
        source: testArticle.source,
        category: testArticle.category || 'general',
        published_at: testArticle.published_at,
        is_ai_enhanced: true,
        original_article_id: testArticle.id,
        enhancement_metadata: {
          test_type: 'token_limit_test_2500',
          one_shot_generation: true,
          token_limit: 2500,
          citations_count: result.en.citations.length,
          response_complete: contentComplete,
          processing_time_ms: duration,
          total_response_size: totalSize,
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
      
      console.log('\n🎯 Summary:');
      console.log(`   Token limit: 2500`);
      console.log(`   Parse success: ${contentComplete ? 'YES' : 'NO'}`);
      console.log(`   Sources found: ${result.en.citations.length}`);
      console.log(`   Quality: ${result.en.citations.length >= 2 ? '✅ Good' : '⚠️  Needs improvement'}`);
      
    } catch (enhanceError) {
      console.error('\n❌ Enhancement failed:', enhanceError);
      if (enhanceError instanceof Error) {
        console.error('   Error message:', enhanceError.message);
        console.error('   Stack:', enhanceError.stack);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

// Run the test
console.log('Starting enhanced token limit test...\n');
testEnhancedTokenLimit().catch(console.error);