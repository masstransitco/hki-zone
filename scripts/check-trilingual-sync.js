const { createClient } = require('@supabase/supabase-js');

// Use your database credentials
const supabaseUrl = 'https://egyuetfeubznhcvmtary.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVneXVldGZldWJ6bmhjdm10YXJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTM3NTAwNSwiZXhwIjoyMDY2OTUxMDA1fQ.euSeh4C7FDt3vLWkBm1nt9wjxo8ZH25hQqAGNyW1gaA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTrilingualSync() {
  console.log('=== Checking Trilingual Article Structure ===\n');

  try {
    // 1. Check if trilingual_batch_id column exists
    console.log('1. Checking database schema...');
    const { data: schemaCheck, error: schemaError } = await supabase
      .from('articles')
      .select('*')
      .limit(1)
      .single();

    if (schemaError) {
      console.error('Error checking schema:', schemaError);
      return;
    }

    if (schemaCheck) {
      const hasTrilingualBatchId = 'trilingual_batch_id' in schemaCheck;
      const hasLanguageVariant = 'language_variant' in schemaCheck;
      const hasIsAiEnhanced = 'is_ai_enhanced' in schemaCheck;
      
      console.log(`- trilingual_batch_id column: ${hasTrilingualBatchId ? '✓ EXISTS' : '✗ MISSING'}`);
      console.log(`- language_variant column: ${hasLanguageVariant ? '✓ EXISTS' : '✗ MISSING'}`);
      console.log(`- is_ai_enhanced column: ${hasIsAiEnhanced ? '✓ EXISTS' : '✗ MISSING'}`);
      
      if (!hasTrilingualBatchId) {
        console.error('\n❌ trilingual_batch_id column is missing! This is why sync is not working.');
        return;
      }
    }

    // 2. Find AI enhanced articles with trilingual_batch_id
    console.log('\n2. Finding AI enhanced articles with trilingual batch IDs...');
    const { data: enhancedArticles, error: enhancedError } = await supabase
      .from('articles')
      .select('id, title, is_ai_enhanced, trilingual_batch_id, language_variant, image_url')
      .eq('is_ai_enhanced', true)
      .not('trilingual_batch_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5);

    if (enhancedError) {
      console.error('Error fetching enhanced articles:', enhancedError);
      return;
    }

    if (!enhancedArticles || enhancedArticles.length === 0) {
      console.log('❌ No AI enhanced articles with trilingual_batch_id found!');
      
      // Check if there are any AI enhanced articles at all
      const { count: enhancedCount } = await supabase
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .eq('is_ai_enhanced', true);
        
      console.log(`\nTotal AI enhanced articles: ${enhancedCount}`);
      
      // Show some AI enhanced articles without trilingual_batch_id
      const { data: enhancedWithoutBatch } = await supabase
        .from('articles')
        .select('id, title, is_ai_enhanced, trilingual_batch_id')
        .eq('is_ai_enhanced', true)
        .is('trilingual_batch_id', null)
        .limit(3);
        
      if (enhancedWithoutBatch && enhancedWithoutBatch.length > 0) {
        console.log('\nAI enhanced articles WITHOUT trilingual_batch_id:');
        enhancedWithoutBatch.forEach(a => {
          console.log(`- ${a.title.substring(0, 60)}...`);
          console.log(`  ID: ${a.id}`);
        });
      }
      
      return;
    }

    console.log(`✓ Found ${enhancedArticles.length} AI enhanced articles with trilingual batch IDs\n`);

    // 3. For each unique trilingual_batch_id, show all related articles
    const uniqueBatchIds = [...new Set(enhancedArticles.map(a => a.trilingual_batch_id))];
    
    for (const batchId of uniqueBatchIds) {
      console.log(`\n3. Examining trilingual batch: ${batchId}`);
      console.log('─'.repeat(50));
      
      const { data: batchArticles, error: batchError } = await supabase
        .from('articles')
        .select('id, title, language_variant, image_url, is_ai_enhanced')
        .eq('trilingual_batch_id', batchId)
        .order('language_variant');

      if (batchError) {
        console.error('Error fetching batch articles:', batchError);
        continue;
      }

      if (batchArticles) {
        console.log(`Found ${batchArticles.length} articles in this batch:\n`);
        
        const languages = ['en', 'zh-TW', 'zh-CN'];
        languages.forEach(lang => {
          const langArticles = batchArticles.filter(a => a.language_variant === lang);
          if (langArticles.length > 0) {
            langArticles.forEach(article => {
              console.log(`[${lang}] ${article.title.substring(0, 50)}...`);
              console.log(`       ID: ${article.id}`);
              console.log(`       Image: ${article.image_url ? '✓ ' + article.image_url.substring(0, 50) + '...' : '✗ No image'}`);
              console.log(`       AI Enhanced: ${article.is_ai_enhanced}`);
            });
          } else {
            console.log(`[${lang}] ⚠️  No article found for this language`);
          }
          console.log('');
        });
        
        // Check if all articles have the same image URL
        const imageUrls = batchArticles.map(a => a.image_url).filter(Boolean);
        const uniqueImageUrls = [...new Set(imageUrls)];
        
        if (uniqueImageUrls.length === 0) {
          console.log('📸 Image sync status: No images in this batch');
        } else if (uniqueImageUrls.length === 1) {
          console.log('📸 Image sync status: ✓ All articles have the same image URL');
        } else {
          console.log(`📸 Image sync status: ⚠️  ${uniqueImageUrls.length} different image URLs found`);
          uniqueImageUrls.forEach((url, i) => {
            console.log(`   ${i + 1}. ${url.substring(0, 60)}...`);
          });
        }
      }
    }

    // 4. Summary statistics
    console.log('\n\n4. Summary Statistics');
    console.log('─'.repeat(50));
    
    const { count: totalArticles } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true });
      
    const { count: aiEnhancedCount } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('is_ai_enhanced', true);
      
    const { count: withBatchIdCount } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('is_ai_enhanced', true)
      .not('trilingual_batch_id', 'is', null);

    console.log(`Total articles: ${totalArticles}`);
    console.log(`AI enhanced articles: ${aiEnhancedCount}`);
    console.log(`AI enhanced with trilingual_batch_id: ${withBatchIdCount}`);
    console.log(`AI enhanced without trilingual_batch_id: ${aiEnhancedCount - withBatchIdCount}`);

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the check
checkTrilingualSync().then(() => {
  console.log('\n=== Check Complete ===');
  process.exit(0);
});