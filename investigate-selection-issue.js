const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = 'https://egyuetfeubznhcvmtary.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVneXVldGZldWJ6bmhjdm10YXJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTM3NTAwNSwiZXhwIjoyMDY2OTUxMDA1fQ.euSeh4C7FDt3vLWkBm1nt9wjxo8ZH25hQqAGNyW1gaA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function investigateSelectionIssue() {
  console.log('🔍 Deep Investigation of Article Selection Issue\n');
  
  // 1. Get recent articles to understand what was available
  console.log('📚 Step 1: Fetching recent candidate articles...');
  
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const { data: candidates, error: candidatesError } = await supabase
    .from('articles')
    .select('*')
    .eq('is_ai_enhanced', false)
    .eq('selected_for_enhancement', false)
    .gte('published_at', sevenDaysAgo.toISOString())
    .order('published_at', { ascending: false })
    .limit(50);
    
  if (candidatesError) {
    console.error('Error fetching candidates:', candidatesError);
    return;
  }
  
  console.log(`Found ${candidates.length} candidate articles\n`);
  
  // 2. Look for the "bad bank" article that Perplexity mentioned
  console.log('🏦 Step 2: Looking for "bad bank" articles...');
  
  const bankArticles = candidates.filter(article => 
    article.title.toLowerCase().includes('bank') || 
    article.title.includes('銀行') ||
    article.title.includes('貸款') ||
    article.content?.toLowerCase().includes('bad bank') ||
    article.content?.toLowerCase().includes('non-performing')
  );
  
  if (bankArticles.length > 0) {
    console.log(`Found ${bankArticles.length} banking-related articles:`);
    bankArticles.forEach((article, i) => {
      console.log(`${i + 1}. [${article.source}] ${article.title}`);
      console.log(`   Content length: ${article.content?.length || 0} chars`);
      console.log(`   Content preview: ${article.content?.substring(0, 200) || 'NO CONTENT'}...`);
    });
  } else {
    console.log('No banking-related articles found in candidates');
  }
  
  // 3. Look for the hydropower article
  console.log('\n💧 Step 3: Looking for hydropower article...');
  
  const hydropowerArticles = candidates.filter(article => 
    article.title.includes('雅魯藏布江') || 
    article.title.includes('水電') ||
    article.content?.includes('雅魯藏布江')
  );
  
  if (hydropowerArticles.length > 0) {
    console.log(`Found ${hydropowerArticles.length} hydropower articles:`);
    hydropowerArticles.forEach((article, i) => {
      console.log(`${i + 1}. [${article.source}] ${article.title}`);
      console.log(`   Content length: ${article.content?.length || 0} chars`);
      console.log(`   Content preview: ${article.content?.substring(0, 200) || 'NO CONTENT'}...`);
    });
  }
  
  // 4. Simulate the deduplication process
  console.log('\n🔄 Step 4: Simulating deduplication process...');
  
  // Get recently enhanced articles
  const { data: recentEnhanced, error: enhancedError } = await supabase
    .from('articles')
    .select('title, summary')
    .eq('is_ai_enhanced', true)
    .gte('created_at', sevenDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(50);
    
  if (recentEnhanced) {
    console.log(`Found ${recentEnhanced.length} recently enhanced articles`);
    
    // Show typhoon-related ones
    const typhoonRelated = recentEnhanced.filter(a => 
      a.title.toLowerCase().includes('typhoon') || 
      a.title.includes('颱風') || 
      a.title.includes('韋帕')
    );
    console.log(`   - ${typhoonRelated.length} typhoon-related articles`);
  }
  
  // 5. Show what the article numbering would look like
  console.log('\n📊 Step 5: Article numbering analysis...');
  console.log('First 10 candidates in order:');
  candidates.slice(0, 10).forEach((article, i) => {
    console.log(`   ${i + 1}. "${article.title.substring(0, 60)}..." (${article.source}, ${article.content?.length || 0} chars)`);
  });
  
  // 6. Check the specific session mentioned in logs
  console.log('\n🔍 Step 6: Checking specific selection session...');
  
  const { data: sessionArticles, error: sessionError } = await supabase
    .from('articles')
    .select('id, title, source, selection_metadata')
    .or('selection_metadata->selection_session.eq.selection_1752991731890_zvq2a,selection_metadata->selection_session.eq.selection_1752991321200_3fu355')
    .order('created_at', { ascending: false });
    
  if (sessionArticles && sessionArticles.length > 0) {
    console.log(`Found ${sessionArticles.length} articles from recent selection sessions:`);
    sessionArticles.forEach(article => {
      console.log(`\n   Article: ${article.title}`);
      console.log(`   ID: ${article.id}`);
      if (article.selection_metadata) {
        console.log(`   Session: ${article.selection_metadata.selection_session}`);
        console.log(`   Reason: ${article.selection_metadata.selection_reason?.substring(0, 150)}...`);
        console.log(`   Score: ${article.selection_metadata.priority_score}`);
        console.log(`   Perplexity ID: ${article.selection_metadata.perplexity_selection_id}`);
      }
    });
  }
  
  // 7. Test Perplexity API directly with a simple example
  console.log('\n🧪 Step 7: Testing Perplexity API with controlled example...');
  
  const testArticles = [
    { id: 1, title: "香港銀行業面臨壞賬危機 考慮設立壞賬銀行", content: "根據彭博報導，香港銀行業不良貸款率上升..." },
    { id: 2, title: "香港微生物研究獲重大突破 AI技術治療腸道疾病", content: "香港中文大學研究團隊開發新技術..." },
    { id: 3, title: "雅魯藏布江水電工程正式開工 投資逾萬億", content: "中國最大水電項目今日在西藏開工..." }
  ];
  
  console.log('Test articles:');
  testArticles.forEach(a => console.log(`   ${a.id}. ${a.title}`));
  
  // We'll create a test prompt similar to what the system uses
  const testPrompt = `Select the MOST newsworthy article from these 3 options:

${testArticles.map(a => `
ARTICLE_NUMBER: ${a.id}
Title: ${a.title}
Content: ${a.content}
---`).join('\n')}

Return ONLY a JSON array with your selection:
[{"id": "2", "reason": "Your reason here", "score": 85}]`;

  console.log('\nTest prompt created (truncated):', testPrompt.substring(0, 200) + '...');
  
  // Note: We can't actually call Perplexity here without the full implementation,
  // but this shows how to test it
}

investigateSelectionIssue().catch(console.error);