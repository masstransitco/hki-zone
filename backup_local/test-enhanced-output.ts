import { config } from 'dotenv';
// Load environment variables FIRST
config({ path: '.env.cli' });

import { createClient } from '@supabase/supabase-js';

async function testEnhancedOutput() {
  const { batchEnhanceTrilingualArticles } = await import('./lib/perplexity-trilingual-enhancer');
  
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('🧪 Testing Enhanced Output with Fixed Metadata Structure\n');

  try {
    // 1. Find a different unenhanced article
    console.log('📋 Finding an unenhanced article...');
    const { data: articles, error } = await supabase
      .from('articles')
      .select('*')
      .eq('is_ai_enhanced', false)
      .neq('source', 'perplexity')
      .neq('id', '55638323-c829-4113-8332-a104ecd82b60') // Skip the one we already tested
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

    // 2. Prepare as source article
    const sourceArticle = {
      id: testArticle.id,
      title: testArticle.title,
      url: testArticle.url,
      category: testArticle.category || 'general',
      source: testArticle.source,
      content: testArticle.content,
      summary: testArticle.summary,
      published_at: testArticle.published_at,
      created_at: testArticle.created_at,
      image_url: testArticle.image_url,
      author: testArticle.author,
      selection_reason: 'Test enhancement with fixed metadata',
      priority_score: 90
    };

    // 3. Test the enhanced trilingual method
    console.log('\n🚀 Testing trilingual enhancement with fixed metadata...');
    const testBatchId = `test_enhanced_${Date.now()}`;
    const startTime = Date.now();
    
    const enhancedArticles = await batchEnhanceTrilingualArticles(
      [sourceArticle],
      testBatchId
    );
    
    const duration = Date.now() - startTime;
    
    console.log(`\n✅ Enhancement completed in ${Math.round(duration/1000)} seconds`);
    console.log(`   Generated ${enhancedArticles.length} articles (should be 3)`);

    // 4. Verify the English version structure
    const englishArticle = enhancedArticles.find(a => a.enhancement_metadata.language === 'en');
    if (englishArticle) {
      console.log('\n📊 English Article Structure Verification:');
      console.log('\n1️⃣ Basic Fields:');
      console.log(`   Title: ${englishArticle.title}`);
      console.log(`   Language: ${englishArticle.language}`);
      console.log(`   Has structured_sources: ${!!englishArticle.structured_sources}`);
      console.log(`   Sources count: ${englishArticle.structured_sources?.length || 0}`);

      console.log('\n2️⃣ Enhancement Metadata:');
      const metadata = englishArticle.enhancement_metadata;
      console.log(`   ✅ one_shot_generation: ${metadata.one_shot_generation}`);
      console.log(`   ✅ sources: ${metadata.sources?.length || 0} items`);
      console.log(`   ✅ keyPoints: ${metadata.keyPoints?.length || 0} items`);
      console.log(`   ✅ whyItMatters: ${!!metadata.whyItMatters}`);
      console.log(`   ✅ citationsText: ${!!metadata.citationsText}`);
      console.log(`   ✅ structuredContent: ${!!metadata.structuredContent}`);
      console.log(`   ✅ extractedImages: ${Array.isArray(metadata.extractedImages)}`);
      console.log(`   ✅ enhancedTitle: ${!!metadata.enhancedTitle}`);
      console.log(`   ✅ enhancedSummary: ${!!metadata.enhancedSummary}`);
      console.log(`   ✅ enhancedContent: ${!!metadata.enhancedContent}`);

      console.log('\n3️⃣ Content Format Check:');
      const content = englishArticle.content;
      console.log(`   Has **Summary**: ${content.includes('**Summary**')}`);
      console.log(`   Has **Key Points**: ${content.includes('**Key Points**')}`);
      console.log(`   Has **Why It Matters**: ${content.includes('**Why It Matters**')}`);
      console.log(`   Has bullet points (•): ${content.includes('•')}`);
      console.log(`   Has bold formatting (**): ${content.includes('**')}`);
      console.log(`   Has citations ([1]): ${content.includes('[1]') || content.includes('[2]')}`);

      console.log('\n4️⃣ Sample Content (first 500 chars):');
      console.log(content.substring(0, 500) + '...');

      console.log('\n5️⃣ Sources Structure:');
      if (metadata.sources && metadata.sources.length > 0) {
        const firstSource = metadata.sources[0];
        console.log('   First source:');
        console.log(`     url: ${firstSource.url}`);
        console.log(`     title: ${firstSource.title}`);
        console.log(`     domain: ${firstSource.domain}`);
        console.log(`     snippet: ${firstSource.snippet}`);
        console.log(`     accessedAt: ${firstSource.accessedAt}`);
      }
    }

    // 5. Save to database
    console.log('\n💾 Saving enhanced articles to database...');
    const { data: savedArticles, error: saveError } = await supabase
      .from('articles')
      .insert(enhancedArticles)
      .select();
    
    if (saveError) {
      console.error('❌ Error saving:', saveError);
    } else {
      console.log(`✅ Successfully saved ${savedArticles.length} articles`);
      console.log(`   Batch ID: ${testBatchId}`);
    }

    // 6. Verification query
    console.log('\n🔍 Database Verification:');
    console.log(`Run this query to check the saved articles:
    
SELECT 
  id,
  title,
  enhancement_metadata->>'language' as lang,
  enhancement_metadata->>'one_shot_generation' as one_shot,
  jsonb_array_length(enhancement_metadata->'sources') as sources_count,
  jsonb_array_length(enhancement_metadata->'keyPoints') as keypoints_count,
  enhancement_metadata->>'citationsText' IS NOT NULL as has_citations_text,
  structured_sources IS NOT NULL as has_structured_sources
FROM articles 
WHERE enhancement_metadata->>'trilingual_batch_id' = '${testBatchId}'
ORDER BY enhancement_metadata->>'language';`);

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    }
  }
}

// Run the test
console.log('Starting enhanced output test...\n');
testEnhancedOutput().catch(console.error);