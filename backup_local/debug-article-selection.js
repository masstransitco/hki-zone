const { createClient } = require('@supabase/supabase-js');

// Load environment variables
const supabaseUrl = 'https://egyuetfeubznhcvmtary.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVneXVldGZldWJ6bmhjdm10YXJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTM3NTAwNSwiZXhwIjoyMDY2OTUxMDA1fQ.euSeh4C7FDt3vLWkBm1nt9wjxo8ZH25hQqAGNyW1gaA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugArticleSelection() {
  console.log('🔍 Debugging Article Selection Issue\n');
  
  // 1. Get the most recently selected article
  const { data: selectedArticle, error: selectedError } = await supabase
    .from('articles')
    .select('id, title, content, summary, source, selected_for_enhancement, selection_metadata')
    .eq('selected_for_enhancement', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
    
  if (selectedError) {
    console.error('Error fetching selected article:', selectedError);
    return;
  }
  
  console.log('📰 Most Recently Selected Article:');
  console.log('   ID:', selectedArticle.id);
  console.log('   Title:', selectedArticle.title);
  console.log('   Source:', selectedArticle.source);
  console.log('   Content Length:', selectedArticle.content?.length || 0);
  console.log('   Has Summary:', !!selectedArticle.summary);
  
  if (selectedArticle.selection_metadata) {
    console.log('\n📋 Selection Metadata:');
    console.log('   Reason:', selectedArticle.selection_metadata.selection_reason?.substring(0, 200) + '...');
    console.log('   Score:', selectedArticle.selection_metadata.priority_score);
    console.log('   Session:', selectedArticle.selection_metadata.selection_session);
    console.log('   Selected At:', selectedArticle.selection_metadata.selected_at);
  }
  
  console.log('\n🎯 Content Preview:');
  console.log('   First 500 chars:', selectedArticle.content?.substring(0, 500) || 'NO CONTENT');
  
  // 2. Check for articles with similar titles to what Perplexity mentioned
  console.log('\n🔍 Searching for articles about "bad bank" or "non-performing loans":');
  
  const { data: bankArticles, error: bankError } = await supabase
    .from('articles')
    .select('id, title, source, created_at')
    .or('title.ilike.%bad bank%,title.ilike.%non-performing%,title.ilike.%不良貸款%,title.ilike.%壞賬銀行%,content.ilike.%bad bank%,content.ilike.%non-performing%')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (bankArticles && bankArticles.length > 0) {
    console.log(`   Found ${bankArticles.length} articles matching financial keywords:`);
    bankArticles.forEach((article, i) => {
      console.log(`   ${i + 1}. ${article.title} (${article.source})`);
    });
  } else {
    console.log('   No articles found with financial/banking keywords');
  }
  
  // 3. Get recent candidate articles that were considered
  console.log('\n📚 Recent Articles (potential candidates):');
  
  const { data: recentArticles, error: recentError } = await supabase
    .from('articles')
    .select('id, title, source, content_length, created_at')
    .eq('is_ai_enhanced', false)
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (recentArticles) {
    recentArticles.forEach((article, i) => {
      console.log(`   ${i + 1}. ${article.title.substring(0, 80)}... (${article.source}, ${article.content_length} chars)`);
    });
  }
  
  // 4. Check for enhanced versions
  console.log('\n🌐 Enhanced Versions:');
  
  const { data: enhancedVersions, error: enhancedError } = await supabase
    .from('articles')
    .select('id, title, source, enhancement_metadata')
    .eq('is_ai_enhanced', true)
    .or(`title.ilike.%${selectedArticle.title.substring(0, 30)}%,enhancement_metadata->>source_article_id.eq.${selectedArticle.id}`)
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (enhancedVersions && enhancedVersions.length > 0) {
    console.log(`   Found ${enhancedVersions.length} enhanced versions`);
    enhancedVersions.forEach((article, i) => {
      console.log(`   ${i + 1}. ${article.title} (${article.source})`);
    });
  } else {
    console.log('   No enhanced versions found yet');
  }
}

debugArticleSelection().catch(console.error);