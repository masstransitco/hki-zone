const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Use your database credentials
const supabaseUrl = 'https://egyuetfeubznhcvmtary.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVneXVldGZldWJ6bmhjdm10YXJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTM3NTAwNSwiZXhwIjoyMDY2OTUxMDA1fQ.euSeh4C7FDt3vLWkBm1nt9wjxo8ZH25hQqAGNyW1gaA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function linkByOriginalArticle() {
  console.log('=== Linking Articles by Original Article ID ===\n');

  try {
    // 1. Find AI enhanced articles with original_article_id
    console.log('1. Finding AI enhanced articles with original_article_id...');
    
    const { data: articlesWithOriginal, error: fetchError } = await supabase
      .from('articles')
      .select('id, title, source, language_variant, original_article_id, trilingual_batch_id, image_url, created_at')
      .eq('is_ai_enhanced', true)
      .not('original_article_id', 'is', null)
      .is('trilingual_batch_id', null) // Only articles without batch ID
      .order('created_at', { ascending: false })
      .limit(500);

    if (fetchError) {
      console.error('Error fetching articles:', fetchError);
      return;
    }

    if (!articlesWithOriginal || articlesWithOriginal.length === 0) {
      console.log('No AI enhanced articles with original_article_id but without trilingual_batch_id found.');
      
      // Let's check if there are any with original_article_id at all
      const { count } = await supabase
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .eq('is_ai_enhanced', true)
        .not('original_article_id', 'is', null);
        
      console.log(`\nTotal AI enhanced articles with original_article_id: ${count}`);
      return;
    }

    console.log(`Found ${articlesWithOriginal.length} AI enhanced articles to process\n`);

    // 2. Group articles by original_article_id
    console.log('2. Grouping articles by original_article_id...\n');
    
    const articleGroups = {};
    
    for (const article of articlesWithOriginal) {
      const originalId = article.original_article_id;
      if (!articleGroups[originalId]) {
        articleGroups[originalId] = [];
      }
      articleGroups[originalId].push(article);
    }
    
    const groupsWithMultiple = Object.entries(articleGroups)
      .filter(([_, articles]) => articles.length > 1)
      .map(([originalId, articles]) => ({ originalId, articles }));
    
    console.log(`Found ${groupsWithMultiple.length} groups with multiple articles\n`);
    
    // 3. Link articles in each group
    let totalLinked = 0;
    
    for (let i = 0; i < Math.min(groupsWithMultiple.length, 20); i++) {
      const group = groupsWithMultiple[i];
      const batchId = generateBatchId();
      
      console.log(`\nGroup ${i + 1}: Original Article ID: ${group.originalId}`);
      console.log(`Batch ID: ${batchId}`);
      console.log('─'.repeat(70));
      
      // First, let's get info about the original article
      const { data: originalArticle } = await supabase
        .from('articles')
        .select('title, source')
        .eq('id', group.originalId)
        .single();
        
      if (originalArticle) {
        console.log(`Original: ${originalArticle.title.substring(0, 50)}...`);
        console.log(`Source: ${originalArticle.source}\n`);
      }
      
      console.log('Enhanced versions:');
      group.articles.forEach(article => {
        const lang = article.language_variant || detectLanguage(article.title);
        console.log(`[${lang}] ${article.title.substring(0, 60)}...`);
        console.log(`     Image: ${article.image_url ? 'Yes' : 'No'}`);
      });
      
      // Link the articles
      console.log('\nLinking articles...');
      
      for (const article of group.articles) {
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
          totalLinked++;
        }
      }
    }
    
    // 4. Check for single article groups (might need manual review)
    const singleArticleGroups = Object.entries(articleGroups)
      .filter(([_, articles]) => articles.length === 1);
    
    console.log(`\n\n4. Articles with original_article_id but no siblings: ${singleArticleGroups.length}`);
    if (singleArticleGroups.length > 0) {
      console.log('\nFirst 5 examples:');
      singleArticleGroups.slice(0, 5).forEach(([originalId, articles]) => {
        const article = articles[0];
        console.log(`- ${article.title.substring(0, 50)}...`);
        console.log(`  Original ID: ${originalId}`);
      });
    }
    
    // 5. Summary
    console.log('\n\n5. Summary');
    console.log('─'.repeat(70));
    console.log(`Total groups processed: ${Math.min(groupsWithMultiple.length, 20)}`);
    console.log(`Total articles linked: ${totalLinked}`);
    console.log(`Groups with multiple articles: ${groupsWithMultiple.length}`);
    console.log(`Single article groups: ${singleArticleGroups.length}`);
    
    if (totalLinked > 0) {
      console.log('\n🎉 Articles have been successfully linked with trilingual_batch_id!');
      console.log('Image URL syncing will now work for these articles.');
    }
    
    if (groupsWithMultiple.length > 20) {
      console.log(`\n⚠️  Only processed first 20 groups. ${groupsWithMultiple.length - 20} more groups available.`);
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
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
    if (title.includes('習') || title.includes('學') || title.includes('國') || title.includes('會') || title.includes('發')) {
      return 'zh-TW'; // Traditional Chinese
    } else if (title.includes('习') || title.includes('学') || title.includes('国') || title.includes('会') || title.includes('发')) {
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
linkByOriginalArticle().then(() => {
  console.log('\n=== Linking Complete ===');
  process.exit(0);
});