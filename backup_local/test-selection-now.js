const { createClient } = require('@supabase/supabase-js');

// Load environment variables
const supabaseUrl = 'https://egyuetfeubznhcvmtary.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVneXVldGZldWJ6bmhjdm10YXJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTM3NTAwNSwiZXhwIjoyMDY2OTUxMDA1fQ.euSeh4C7FDt3vLWkBm1nt9wjxo8ZH25hQqAGNyW1gaA';

const supabase = createClient(supabaseUrl, supabaseKey);

function getDateHoursAgo(hours) {
  const date = new Date();
  date.setTime(date.getTime() - (hours * 60 * 60 * 1000));
  return date.toISOString();
}

function getTimeAgo(dateString) {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffMins < 1440) {
    const hours = Math.floor(diffMins / 60);
    return `${hours}h ago`;
  } else {
    const days = Math.floor(diffMins / 1440);
    return `${days}d ago`;
  }
}

async function testArticleSelection() {
  console.log('🧪 Testing Article Selection Process\n');
  console.log(`⏰ Current time: ${new Date().toISOString()}`);
  
  // Simulate the exact same query that perplexity-article-selector.ts uses
  const scrapedSources = ['HKFP', 'SingTao', 'HK01', 'on.cc', 'RTHK'];
  const sixHoursAgo = getDateHoursAgo(6);
  
  console.log(`🔍 Simulating candidate selection (exactly like perplexity-article-selector.ts):`);
  console.log(`   Sources: ${scrapedSources.join(', ')}`);
  console.log(`   Time window: ${sixHoursAgo} (6 hours ago) to now`);
  
  const { data: articles, error } = await supabase
    .from('articles')
    .select('*')
    .is('is_ai_enhanced', false)
    .is('selected_for_enhancement', false)
    .in('source', scrapedSources)
    .gte('created_at', sixHoursAgo)
    .not('content', 'is', null)
    .is('enhancement_metadata->source_article_status', null)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`\n📊 Query Results:`);
  console.log(`   Found ${articles?.length || 0} candidate articles`);
  
  if (!articles || articles.length === 0) {
    console.log('❌ No candidates found - this explains why old articles are selected!');
    return;
  }

  // Filter and transform articles (same as selector)
  const candidateArticles = articles
    .map(article => ({
      id: article.id,
      title: article.title,
      summary: article.summary,
      content: article.content,
      url: article.url,
      source: article.source,
      category: article.category || 'general',
      published_at: article.published_at,
      created_at: article.created_at,
      image_url: article.image_url,
      author: article.author,
      content_length: article.content?.length || 0,
      has_summary: !!(article.summary && article.summary.length > 50),
      has_image: !!article.image_url
    }))
    .filter(article => {
      // Same quality filters as selector
      if (!article.title || article.title.length < 5) {
        return false;
      }
      
      const titleLower = article.title.toLowerCase();
      if (titleLower.includes('test') || titleLower.includes('測試') || titleLower === 'title') {
        return false;
      }
      
      if (article.content_length < 100) {
        console.log(`   ⚠️ Filtered "${article.title.substring(0, 50)}..." - insufficient content (${article.content_length} chars)`);
        return false;
      }
      
      return true;
    });

  console.log(`\n✅ After filtering: ${candidateArticles.length} quality candidates`);
  
  if (candidateArticles.length === 0) {
    console.log('❌ All candidates filtered out due to quality issues');
    return;
  }

  console.log(`\n🎯 Top 10 Candidate Articles (newest first):`);
  candidateArticles.slice(0, 10).forEach((article, i) => {
    const timeAgo = getTimeAgo(article.created_at);
    console.log(`   ${i + 1}. [${timeAgo}] "${article.title.substring(0, 60)}..." (${article.source}, ${article.content_length} chars)`);
  });

  // Check if we have very recent articles
  const veryRecentCount = candidateArticles.filter(a => {
    const ageMs = Date.now() - new Date(a.created_at).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    return ageHours < 1; // Less than 1 hour old
  }).length;

  const recentCount = candidateArticles.filter(a => {
    const ageMs = Date.now() - new Date(a.created_at).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    return ageHours < 6; // Less than 6 hours old
  }).length;

  console.log(`\n📈 Article Freshness Analysis:`);
  console.log(`   Very recent (<1h): ${veryRecentCount} articles`);
  console.log(`   Recent (<6h): ${recentCount} articles`);
  console.log(`   Average age of top 10: ${candidateArticles.slice(0, 10).map(a => {
    const ageMs = Date.now() - new Date(a.created_at).getTime();
    return Math.round(ageMs / (1000 * 60)); // minutes
  }).reduce((a, b) => a + b, 0) / Math.min(10, candidateArticles.length)} minutes`);

  if (veryRecentCount > 0) {
    console.log('✅ SUCCESS: Pipeline should now select very recent articles instead of 5-day-old ones!');
  } else {
    console.log('⚠️ No articles less than 1 hour old - may still select older articles');
  }

  // Test what the selector would pick (first article)
  const wouldSelect = candidateArticles[0];
  const ageMs = Date.now() - new Date(wouldSelect.created_at).getTime();
  const ageHours = Math.round(ageMs / (1000 * 60 * 60) * 10) / 10;

  console.log(`\n🎯 Article selector would choose:`);
  console.log(`   Title: "${wouldSelect.title}"`);
  console.log(`   Age: ${getTimeAgo(wouldSelect.created_at)} (${ageHours} hours)`);
  console.log(`   Source: ${wouldSelect.source}`);
  console.log(`   Content: ${wouldSelect.content_length} characters`);

  if (ageHours < 24) {
    console.log(`✅ SUCCESS: Would select article from ${ageHours} hours ago (much better than 5 days!)`);
  } else {
    console.log(`⚠️ Still selecting old article from ${ageHours} hours ago`);
  }
}

testArticleSelection().catch(console.error);