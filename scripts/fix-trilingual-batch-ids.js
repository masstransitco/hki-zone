const { createClient } = require('@supabase/supabase-js');

// Use your database credentials
const supabaseUrl = 'https://egyuetfeubznhcvmtary.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVneXVldGZldWJ6bmhjdm10YXJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTM3NTAwNSwiZXhwIjoyMDY2OTUxMDA1fQ.euSeh4C7FDt3vLWkBm1nt9wjxo8ZH25hQqAGNyW1gaA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixTrilingualBatchIds() {
  console.log('=== Fixing Trilingual Batch IDs ===\n');

  try {
    // 1. First, find all AI enhanced articles with enhancement_metadata
    console.log('1. Finding AI enhanced articles with enhancement_metadata...');
    const { data: enhancedArticles, error: fetchError } = await supabase
      .from('articles')
      .select('id, title, enhancement_metadata, trilingual_batch_id, language_variant')
      .eq('is_ai_enhanced', true)
      .not('enhancement_metadata', 'is', null)
      .limit(100); // Process in batches

    if (fetchError) {
      console.error('Error fetching articles:', fetchError);
      return;
    }

    console.log(`Found ${enhancedArticles?.length || 0} AI enhanced articles with metadata\n`);

    if (!enhancedArticles || enhancedArticles.length === 0) {
      console.log('No articles to process.');
      return;
    }

    // 2. Check which articles have trilingual_batch_id in metadata but not as column
    let articlesToFix = [];
    let alreadyFixed = 0;
    
    for (const article of enhancedArticles) {
      const metadata = article.enhancement_metadata;
      const metadataBatchId = metadata?.trilingual_batch_id;
      const columnBatchId = article.trilingual_batch_id;
      
      if (metadataBatchId && !columnBatchId) {
        articlesToFix.push({
          id: article.id,
          title: article.title,
          trilingual_batch_id: metadataBatchId,
          language_variant: metadata?.language_variant || metadata?.language || null,
          language_order: metadata?.language_order || null,
          quality_score: metadata?.quality_score || null
        });
      } else if (columnBatchId) {
        alreadyFixed++;
      }
    }

    console.log(`2. Analysis results:`);
    console.log(`   - Articles needing fix: ${articlesToFix.length}`);
    console.log(`   - Articles already fixed: ${alreadyFixed}`);
    console.log(`   - Articles without batch ID: ${enhancedArticles.length - articlesToFix.length - alreadyFixed}\n`);

    if (articlesToFix.length === 0) {
      console.log('✅ No articles need fixing!');
      return;
    }

    // 3. Update articles to have trilingual_batch_id as column
    console.log('3. Updating articles with trilingual_batch_id column...\n');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const article of articlesToFix) {
      try {
        const { error: updateError } = await supabase
          .from('articles')
          .update({
            trilingual_batch_id: article.trilingual_batch_id,
            language_variant: article.language_variant,
            language_order: article.language_order,
            quality_score: article.quality_score,
            updated_at: new Date().toISOString()
          })
          .eq('id', article.id);

        if (updateError) {
          console.error(`❌ Error updating ${article.title}:`, updateError.message);
          errorCount++;
        } else {
          console.log(`✅ Fixed: ${article.title.substring(0, 50)}...`);
          console.log(`   Batch ID: ${article.trilingual_batch_id}`);
          console.log(`   Language: ${article.language_variant}\n`);
          successCount++;
        }
      } catch (error) {
        console.error(`❌ Unexpected error for ${article.title}:`, error);
        errorCount++;
      }
    }

    // 4. Verify the fix by checking trilingual batches
    console.log('\n4. Verifying trilingual batches...\n');
    
    const uniqueBatchIds = [...new Set(articlesToFix.map(a => a.trilingual_batch_id))];
    
    for (const batchId of uniqueBatchIds.slice(0, 3)) { // Check first 3 batches
      const { data: batchArticles, error: batchError } = await supabase
        .from('articles')
        .select('id, title, trilingual_batch_id, language_variant, image_url')
        .eq('trilingual_batch_id', batchId)
        .order('language_variant');

      if (!batchError && batchArticles) {
        console.log(`Batch ${batchId}:`);
        batchArticles.forEach(article => {
          console.log(`  [${article.language_variant || 'unknown'}] ${article.title.substring(0, 40)}...`);
          console.log(`    Image: ${article.image_url ? 'Yes' : 'No'}`);
        });
        console.log('');
      }
    }

    // 5. Summary
    console.log('\n5. Summary');
    console.log('─'.repeat(50));
    console.log(`✅ Successfully fixed: ${successCount} articles`);
    console.log(`❌ Failed to fix: ${errorCount} articles`);
    console.log(`📊 Total batch IDs processed: ${uniqueBatchIds.length}`);

    if (successCount > 0) {
      console.log('\n🎉 Trilingual batch IDs have been fixed!');
      console.log('Image URL syncing should now work for these articles.');
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the fix
fixTrilingualBatchIds().then(() => {
  console.log('\n=== Fix Complete ===');
  process.exit(0);
});