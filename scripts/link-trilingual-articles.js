const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Use your database credentials
const supabaseUrl = 'https://egyuetfeubznhcvmtary.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVneXVldGZldWJ6bmhjdm10YXJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTM3NTAwNSwiZXhwIjoyMDY2OTUxMDA1fQ.euSeh4C7FDt3vLWkBm1nt9wjxo8ZH25hQqAGNyW1gaA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function linkTrilingualArticles() {
  console.log('=== Linking Trilingual Articles ===\n');

  try {
    // 1. Find AI enhanced articles that might be related
    console.log('1. Finding AI enhanced articles to link...');
    
    // Get AI enhanced articles ordered by creation time
    const { data: aiArticles, error: fetchError } = await supabase
      .from('articles')
      .select('id, title, source, language_variant, created_at, original_article_id, trilingual_batch_id, image_url')
      .eq('is_ai_enhanced', true)
      .is('trilingual_batch_id', null) // Only articles without batch ID
      .order('created_at', { ascending: false })
      .limit(300); // Process recent articles

    if (fetchError) {
      console.error('Error fetching articles:', fetchError);
      return;
    }

    if (!aiArticles || aiArticles.length === 0) {
      console.log('No AI enhanced articles without trilingual_batch_id found.');
      return;
    }

    console.log(`Found ${aiArticles.length} AI enhanced articles without trilingual_batch_id\n`);

    // 2. Group articles by similar creation time and title patterns
    console.log('2. Grouping articles by similarity...\n');
    
    const potentialBatches = [];
    const processedIds = new Set();
    
    for (const article of aiArticles) {
      if (processedIds.has(article.id)) continue;
      
      const createdTime = new Date(article.created_at).getTime();
      const batch = [article];
      processedIds.add(article.id);
      
      // Find articles created within 5 minutes of this one
      for (const candidate of aiArticles) {
        if (processedIds.has(candidate.id)) continue;
        
        const candidateTime = new Date(candidate.created_at).getTime();
        const timeDiff = Math.abs(createdTime - candidateTime);
        
        // Check if created within 5 minutes and has different language
        if (timeDiff < 5 * 60 * 1000 && // 5 minutes
            candidate.source === article.source &&
            candidate.language_variant !== article.language_variant) {
          
          // Check if titles are similar (might be translations)
          if (areTitlesSimilar(article.title, candidate.title)) {
            batch.push(candidate);
            processedIds.add(candidate.id);
          }
        }
      }
      
      // Only keep batches with multiple languages
      if (batch.length > 1) {
        potentialBatches.push(batch);
      }
    }
    
    console.log(`Found ${potentialBatches.length} potential trilingual batches\n`);
    
    // 3. Display and optionally link the batches
    let linkedCount = 0;
    
    for (let i = 0; i < Math.min(potentialBatches.length, 10); i++) {
      const batch = potentialBatches[i];
      const batchId = generateBatchId();
      
      console.log(`\nBatch ${i + 1} (${batch.length} articles):`);
      console.log(`Batch ID: ${batchId}`);
      console.log('─'.repeat(60));
      
      batch.forEach(article => {
        const lang = article.language_variant || detectLanguage(article.title);
        console.log(`[${lang}] ${article.title.substring(0, 50)}...`);
        console.log(`     Created: ${article.created_at}`);
      });
      
      // Link the articles
      console.log('\nLinking articles...');
      
      for (const article of batch) {
        const lang = article.language_variant || detectLanguage(article.title);
        const langOrder = getLanguageOrder(lang);
        
        const { error: updateError } = await supabase
          .from('articles')
          .update({
            trilingual_batch_id: batchId,
            language_variant: lang,
            language_order: langOrder,
            updated_at: new Date().toISOString()
          })
          .eq('id', article.id);
        
        if (updateError) {
          console.error(`❌ Error updating article ${article.id}:`, updateError.message);
        } else {
          console.log(`✅ Linked: [${lang}] ${article.title.substring(0, 40)}...`);
          linkedCount++;
        }
      }
    }
    
    // 4. Summary
    console.log('\n\n4. Summary');
    console.log('─'.repeat(60));
    console.log(`Total potential batches found: ${potentialBatches.length}`);
    console.log(`Articles linked: ${linkedCount}`);
    console.log(`Batches processed: ${Math.min(potentialBatches.length, 10)}`);
    
    if (linkedCount > 0) {
      console.log('\n🎉 Articles have been linked with trilingual_batch_id!');
      console.log('Image URL syncing will now work for these articles.');
    }
    
    if (potentialBatches.length > 10) {
      console.log(`\n⚠️  Only processed first 10 batches. ${potentialBatches.length - 10} more batches available.`);
      console.log('Run the script again to process more batches.');
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Helper function to check if titles might be translations of each other
function areTitlesSimilar(title1, title2) {
  // Simple heuristic: check if they have similar length or share common patterns
  const len1 = title1.length;
  const len2 = title2.length;
  
  // If lengths are very different, probably not translations
  if (Math.abs(len1 - len2) > len1 * 0.5) {
    return false;
  }
  
  // Check for common patterns (numbers, special characters)
  const numbers1 = title1.match(/\d+/g) || [];
  const numbers2 = title2.match(/\d+/g) || [];
  
  // If both have numbers, they should match
  if (numbers1.length > 0 && numbers2.length > 0) {
    return numbers1.sort().join(',') === numbers2.sort().join(',');
  }
  
  // If created close together and similar length, assume they're related
  return true;
}

// Generate a unique batch ID
function generateBatchId() {
  return `batch_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

// Detect language from title
function detectLanguage(title) {
  // Simple detection based on character sets
  if (/[\u4e00-\u9fff]/.test(title)) {
    // Contains Chinese characters
    if (title.includes('習') || title.includes('學') || title.includes('國')) {
      return 'zh-TW'; // Traditional Chinese
    } else if (title.includes('习') || title.includes('学') || title.includes('国')) {
      return 'zh-CN'; // Simplified Chinese
    }
    // Default to Traditional if can't determine
    return 'zh-TW';
  }
  return 'en'; // Default to English
}

// Get language order for consistent ordering
function getLanguageOrder(lang) {
  const orderMap = {
    'en': 1,
    'zh-TW': 2,
    'zh-CN': 3
  };
  return orderMap[lang] || 99;
}

// Run the linking process
linkTrilingualArticles().then(() => {
  console.log('\n=== Linking Complete ===');
  process.exit(0);
});