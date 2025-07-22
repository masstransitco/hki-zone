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

async function fixStuckSelections() {
  console.log('🔧 Fixing Stuck Article Selections (Simple Method)\n');
  
  // Find all articles that are marked as selected but not enhanced
  console.log('🔍 Finding stuck selections...');
  
  const { data: stuckArticles, error: findError } = await supabase
    .from('articles')
    .select('id, title, source, created_at')
    .eq('selected_for_enhancement', true)
    .eq('is_ai_enhanced', false);
    
  if (findError) {
    console.error('❌ Error finding stuck articles:', findError);
    return;
  }
  
  if (!stuckArticles || stuckArticles.length === 0) {
    console.log('✅ No stuck selections found');
    return;
  }
  
  console.log(`🔍 Found ${stuckArticles.length} articles marked as selected but not enhanced:`);
  
  stuckArticles.forEach((article, i) => {
    console.log(`   ${i + 1}. "${article.title.substring(0, 60)}..." (${article.source})`);
  });
  
  console.log(`\n⚠️ This will RESET these ${stuckArticles.length} articles to allow re-selection.`);
  
  // Reset all stuck selections
  const idsToReset = stuckArticles.map(a => a.id);
  
  console.log('🔄 Resetting stuck selections...');
  
  const { error: resetError } = await supabase
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
  console.log('🎯 New fresh articles should now be selected in the next cron run');
  
  // Show current status
  console.log('\n📊 Current pipeline status after reset:');
  
  const { count: available } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .in('source', ['HKFP', 'SingTao', 'HK01', 'on.cc', 'RTHK'])
    .eq('is_ai_enhanced', false)
    .eq('selected_for_enhancement', false)
    .not('content', 'is', null);
  
  const { count: selected } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('selected_for_enhancement', true)
    .eq('is_ai_enhanced', false);
    
  console.log(`   Available for selection: ${available || 0} articles`);
  console.log(`   Currently selected: ${selected || 0} articles`);
  
  if ((selected || 0) === 0) {
    console.log('✅ Pipeline is clear - next cron run should select fresh articles');
  } else {
    console.log('⚠️ Still some articles marked as selected - may need manual intervention');
  }
}

fixStuckSelections().catch(console.error);