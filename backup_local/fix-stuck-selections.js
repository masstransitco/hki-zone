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

async function fixStuckSelections() {
  console.log('🔧 Fixing Stuck Article Selections\n');
  
  // Find articles selected more than 4 hours ago but not enhanced
  const fourHoursAgo = getDateHoursAgo(4);
  console.log(`🕐 Cutoff time: ${fourHoursAgo} (4 hours ago)`);
  
  const { data: stuckArticles, error: findError } = await supabase
    .from('articles')
    .select('id, title, source, created_at, selection_metadata')
    .eq('selected_for_enhancement', true)
    .eq('is_ai_enhanced', false)
    .lt('selection_metadata->selected_at', fourHoursAgo)
    .order('selection_metadata->selected_at', { ascending: true });
    
  if (findError) {
    console.error('❌ Error finding stuck articles:', findError);
    return;
  }
  
  if (!stuckArticles || stuckArticles.length === 0) {
    console.log('✅ No stuck selections found');
    return;
  }
  
  console.log(`🔍 Found ${stuckArticles.length} stuck selections (selected >4 hours ago but not enhanced):`);
  
  stuckArticles.forEach((article, i) => {
    const selectedAt = article.selection_metadata?.selected_at;
    const timeAgo = selectedAt ? getTimeAgo(selectedAt) : 'unknown';
    console.log(`   ${i + 1}. [${timeAgo}] "${article.title.substring(0, 60)}..." (${article.source})`);
  });
  
  // Ask for confirmation
  console.log(`\n⚠️ This will RESET these ${stuckArticles.length} articles to allow re-selection by the AI pipeline.`);
  console.log('The articles were likely selected but the enhancement process failed or was interrupted.');
  console.log('Resetting them will allow fresh articles to be selected.');
  
  // Extract IDs to reset
  const idsToReset = stuckArticles.map(a => a.id);
  
  // Reset stuck selections
  const { data: resetResult, error: resetError } = await supabase
    .from('articles')
    .update({
      selected_for_enhancement: false,
      selection_metadata: null
    })
    .in('id', idsToReset);
  
  if (resetError) {
    console.error('❌ Error resetting stuck selections:', resetError);
    return;
  }
  
  console.log(`\n✅ Successfully reset ${stuckArticles.length} stuck selections`);
  console.log('🔄 These articles are now available for re-selection by the AI pipeline');
  console.log('🎯 New fresh articles should now be selected in the next cron run');
  
  // Show current candidate count after reset
  const sixHoursAgo = getDateHoursAgo(6);
  const { count: newCandidates } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .in('source', ['HKFP', 'SingTao', 'HK01', 'on.cc', 'RTHK', 'AM730', 'SCMP'])
    .gte('created_at', sixHoursAgo)
    .eq('is_ai_enhanced', false)
    .eq('selected_for_enhancement', false)
    .not('content', 'is', null);
    
  console.log(`\n📊 Current candidate articles available for selection: ${newCandidates || 0}`);
  
  // Trigger a test selection to verify
  console.log('\n🧪 Testing article selection after reset...');
  try {
    const testResponse = await fetch('http://localhost:3000/api/cron/select-article', {
      method: 'GET',
    });
    
    if (testResponse.ok) {
      const stats = await testResponse.json();
      console.log('✅ Selection endpoint is working');
      console.log(`📈 Candidates available: ${stats.candidateStats?.recentCandidates || 'unknown'}`);
    } else {
      console.log('⚠️ Cannot test selection (app not running locally)');
    }
  } catch (error) {
    console.log('⚠️ Cannot test selection (app not running locally)');
  }
}

fixStuckSelections().catch(console.error);