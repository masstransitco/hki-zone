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

async function debugTimeWindowIssue() {
  console.log('🔍 Debugging Article Time Window Issue\n');
  console.log(`⏰ Current time: ${new Date().toISOString()}`);
  
  // Check the 6-hour window that the selector uses
  const sixHoursAgo = getDateHoursAgo(6);
  console.log(`🕕 6 hours ago: ${sixHoursAgo}`);
  
  // Check various time windows
  const timeWindows = [1, 2, 6, 12, 24, 48];
  const scrapedSources = ['HKFP', 'SingTao', 'HK01', 'on.cc', 'RTHK'];
  
  console.log('\n📊 Article counts by time window:');
  
  for (const hours of timeWindows) {
    const cutoff = getDateHoursAgo(hours);
    
    const { count: total } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .in('source', scrapedSources)
      .gte('created_at', cutoff);
      
    const { count: unenhanced } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .in('source', scrapedSources)
      .gte('created_at', cutoff)
      .eq('is_ai_enhanced', false);
      
    const { count: unselected } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .in('source', scrapedSources)
      .gte('created_at', cutoff)
      .eq('is_ai_enhanced', false)
      .eq('selected_for_enhancement', false);
    
    console.log(`   Last ${hours}h: ${total || 0} total, ${unenhanced || 0} unenhanced, ${unselected || 0} candidates`);
  }
  
  // Show most recent articles within 6-hour window
  console.log('\n📚 Recent articles within 6-hour window (candidates):');
  
  const { data: candidates } = await supabase
    .from('articles')
    .select('id, title, source, created_at, is_ai_enhanced, selected_for_enhancement, content')
    .in('source', scrapedSources)
    .gte('created_at', sixHoursAgo)
    .eq('is_ai_enhanced', false)
    .eq('selected_for_enhancement', false)
    .not('content', 'is', null)
    .order('created_at', { ascending: false })
    .limit(15);
    
  if (candidates && candidates.length > 0) {
    candidates.forEach((article, i) => {
      const timeAgo = getTimeAgo(article.created_at);
      const contentLength = article.content?.length || 0;
      console.log(`   ${i + 1}. [${timeAgo}] "${article.title.substring(0, 60)}..." (${article.source}, ${contentLength} chars)`);
    });
  } else {
    console.log('   No candidate articles found in 6-hour window');
  }
  
  // Check most recent articles overall (ignoring time window)
  console.log('\n📱 Most recent articles (all sources, ignoring time window):');
  
  const { data: recentAll } = await supabase
    .from('articles')
    .select('id, title, source, created_at, is_ai_enhanced, selected_for_enhancement')
    .in('source', scrapedSources)
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (recentAll) {
    recentAll.forEach((article, i) => {
      const timeAgo = getTimeAgo(article.created_at);
      const status = article.is_ai_enhanced ? '✅ Enhanced' : article.selected_for_enhancement ? '🔄 Selected' : '⏸️ Available';
      console.log(`   ${i + 1}. [${timeAgo}] ${status} "${article.title.substring(0, 60)}..." (${article.source})`);
    });
  }
  
  // Check for stuck selections (selected but not enhanced)
  console.log('\n🔒 Stuck selections (selected but not enhanced):');
  
  const { data: stuck } = await supabase
    .from('articles')
    .select('id, title, source, created_at, selection_metadata')
    .eq('selected_for_enhancement', true)
    .eq('is_ai_enhanced', false)
    .order('selection_metadata->selected_at', { ascending: true })
    .limit(10);
    
  if (stuck && stuck.length > 0) {
    stuck.forEach((article, i) => {
      const selectedAt = article.selection_metadata?.selected_at;
      const timeAgo = selectedAt ? getTimeAgo(selectedAt) : 'unknown';
      console.log(`   ${i + 1}. [Selected ${timeAgo}] "${article.title.substring(0, 60)}..." (${article.source})`);
    });
  } else {
    console.log('   No stuck selections found');
  }
  
  // Check recent enhanced articles (for deduplication analysis)
  console.log('\n🌟 Recently enhanced articles (last 7 days):');
  
  const sevenDaysAgo = getDateHoursAgo(7 * 24);
  const { data: enhanced } = await supabase
    .from('articles')
    .select('title, created_at, source')
    .eq('is_ai_enhanced', true)
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (enhanced && enhanced.length > 0) {
    enhanced.forEach((article, i) => {
      const timeAgo = getTimeAgo(article.created_at);
      console.log(`   ${i + 1}. [${timeAgo}] "${article.title.substring(0, 60)}..." (${article.source})`);
    });
  } else {
    console.log('   No enhanced articles found in last 7 days');
  }
}

debugTimeWindowIssue().catch(console.error);