const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function testSingleTrilingualEnhancement() {
  try {
    console.log('🧪 Testing trilingual enhancement with 1 article...\n');
    
    // Use require for TypeScript modules
    const { selectArticlesWithPerplexity } = require('./lib/perplexity-article-selector');
    const { batchEnhanceTrilingualArticles } = require('./lib/perplexity-trilingual-enhancer');
    const { saveEnhancedArticles } = require('./lib/article-saver');
    
    // 1. Select just 1 article
    console.log('📋 Selecting 1 article with Perplexity...');
    const selectedArticles = await selectArticlesWithPerplexity(1);
    
    if (!selectedArticles || selectedArticles.length === 0) {
      console.error('❌ No articles selected');
      return;
    }
    
    console.log(`✅ Selected article: "${selectedArticles[0].title}"\n`);
    
    // 2. Generate batch ID
    const batchId = `test_batch_${Date.now()}_single`;
    
    // 3. Enhance the article in 3 languages
    console.log('🌐 Enhancing article in 3 languages...');
    const enhancedArticles = await batchEnhanceTrilingualArticles(selectedArticles, batchId);
    
    console.log(`✅ Enhanced into ${enhancedArticles.length} articles (3 languages)\n`);
    
    // 4. Save the enhanced articles
    console.log('💾 Saving enhanced articles...');
    const savedArticles = await saveEnhancedArticles(enhancedArticles, batchId);
    
    console.log(`\n📊 Results:`);
    console.log(`- Articles enhanced: ${enhancedArticles.length}`);
    console.log(`- Articles saved: ${savedArticles.length}`);
    console.log(`- Success rate: ${(savedArticles.length / enhancedArticles.length * 100).toFixed(0)}%`);
    
    if (savedArticles.length > 0) {
      console.log('\n✅ Successfully saved articles:');
      savedArticles.forEach(article => {
        console.log(`  - ${article.title} (${article.language})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testSingleTrilingualEnhancement();