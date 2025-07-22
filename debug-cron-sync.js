const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load environment variables from .env.cli
try {
  const envFile = fs.readFileSync('.env.cli', 'utf8');
  const envVars = {};
  envFile.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  Object.assign(process.env, envVars);
} catch (error) {
  console.error('Could not load .env.cli:', error.message);
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function getTimeAgo(dateString) {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  
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

async function simulateSelectionCron() {
  console.log('🎯 SIMULATING ARTICLE SELECTION CRON JOB');
  console.log('='.repeat(50));
  
  // This mimics the exact logic from /api/cron/select-article
  const scrapedSources = ['HKFP', 'SingTao', 'HK01', 'on.cc', 'RTHK'];
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  
  console.log(`🔍 Looking for candidates to select...`);
  console.log(`   Sources: ${scrapedSources.join(', ')}`);
  console.log(`   Time window: ${sixHoursAgo} to now`);
  
  // Step 1: Get candidate articles (same query as selector)
  const { data: candidateArticles, error: candidateError } = await supabase
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
  
  if (candidateError) {
    console.error('❌ Error getting candidates:', candidateError);
    return null;
  }
  
  console.log(`📊 Found ${candidateArticles?.length || 0} candidate articles`);
  
  if (!candidateArticles || candidateArticles.length === 0) {
    console.log('⚠️ No candidates found - selection would return early');
    return null;
  }
  
  // Step 2: Apply quality filters (same as selector)
  const qualityFiltered = candidateArticles.filter(article => {
    if (!article.title || article.title.length < 5) {
      return false;
    }
    
    const titleLower = article.title.toLowerCase();
    if (titleLower.includes('test') || titleLower.includes('測試') || titleLower === 'title') {
      return false;
    }
    
    const contentLength = article.content?.length || 0;
    if (contentLength < 100) {
      return false;
    }
    
    return true;
  });
  
  console.log(`✅ After quality filtering: ${qualityFiltered.length} articles`);
  
  if (qualityFiltered.length === 0) {
    console.log('⚠️ No quality candidates found - selection would return early');
    return null;
  }
  
  // Step 3: Select the first (newest) article
  const selectedArticle = qualityFiltered[0];
  const timeAgo = getTimeAgo(selectedArticle.created_at);
  
  console.log(`🎯 Would select article:`);
  console.log(`   Title: "${selectedArticle.title}"`);
  console.log(`   Source: ${selectedArticle.source}`);
  console.log(`   Age: ${timeAgo}`);
  console.log(`   Content: ${selectedArticle.content.length} chars`);
  console.log(`   ID: ${selectedArticle.id}`);
  
  return selectedArticle;
}

async function simulateActualSelection(articleToSelect) {
  console.log('\\n🔄 SIMULATING ACTUAL SELECTION PROCESS');
  console.log('='.repeat(50));
  
  if (!articleToSelect) {
    console.log('⚠️ No article provided - skipping selection');
    return null;
  }
  
  // This mimics the actual selection update
  const selectionTimestamp = new Date().toISOString();
  
  console.log(`🔐 Marking article as selected...`);
  console.log(`   Article ID: ${articleToSelect.id}`);
  console.log(`   Selection time: ${selectionTimestamp}`);
  
  const { data: updatedArticle, error: updateError } = await supabase
    .from('articles')
    .update({
      selected_for_enhancement: true,
      selection_metadata: {
        selected_at: selectionTimestamp,
        selection_reason: 'Most recent quality article from scraped sources',
        priority_score: 85,
        selection_method: 'cron_automated'
      }
    })
    .eq('id', articleToSelect.id)
    .eq('selected_for_enhancement', false) // Safety check
    .select()
    .single();
  
  if (updateError) {
    console.error('❌ Error marking article as selected:', updateError);
    return null;
  }
  
  console.log(`✅ Successfully marked article as selected`);
  console.log(`   Updated at: ${updatedArticle.updated_at}`);
  console.log(`   Selection metadata: ${JSON.stringify(updatedArticle.selection_metadata, null, 2)}`);
  
  return updatedArticle;
}

async function simulateEnhancementCron() {
  console.log('\\n⚡ SIMULATING ENHANCEMENT CRON JOB');
  console.log('='.repeat(50));
  
  // This mimics the logic from /api/cron/enhance-selected
  console.log('🔍 Looking for articles marked for enhancement...');
  
  const { data: selectedArticles, error: findError } = await supabase
    .from('articles')
    .select('*')
    .eq('selected_for_enhancement', true)
    .is('is_ai_enhanced', false)
    .order('selection_metadata->selected_at', { ascending: true })
    .limit(1);
  
  if (findError) {
    console.error('❌ Error finding selected articles:', findError);
    return null;
  }
  
  console.log(`📊 Found ${selectedArticles?.length || 0} articles marked for enhancement`);
  
  if (!selectedArticles || selectedArticles.length === 0) {
    console.log('⚠️ No articles found for enhancement');
    console.log('   This is the exact issue you\'re seeing in production!');
    return null;
  }
  
  const articleToEnhance = selectedArticles[0];
  const selectedTime = articleToEnhance.selection_metadata?.selected_at;
  const timeSinceSelection = selectedTime ? getTimeAgo(selectedTime) : 'unknown';
  
  console.log(`🎯 Found article to enhance:`);
  console.log(`   Title: "${articleToEnhance.title}"`);
  console.log(`   Selected: ${timeSinceSelection}`);
  console.log(`   Selection metadata: ${JSON.stringify(articleToEnhance.selection_metadata, null, 2)}`);
  
  return articleToEnhance;
}

async function checkCurrentState() {
  console.log('\\n📊 CURRENT DATABASE STATE ANALYSIS');
  console.log('='.repeat(50));
  
  // Check articles in various states
  const { count: totalArticles } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true });
  
  const { count: selectedForEnhancement } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('selected_for_enhancement', true)
    .eq('is_ai_enhanced', false);
  
  const { count: recentlyEnhanced } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('is_ai_enhanced', true)
    .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());
  
  const { count: availableCandidates } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('selected_for_enhancement', false)
    .eq('is_ai_enhanced', false)
    .in('source', ['HKFP', 'SingTao', 'HK01', 'on.cc', 'RTHK'])
    .gte('created_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
    .not('content', 'is', null);
  
  console.log(`📈 Database State Summary:`);
  console.log(`   Total articles: ${totalArticles || 0}`);
  console.log(`   Available candidates: ${availableCandidates || 0}`);
  console.log(`   Currently selected for enhancement: ${selectedForEnhancement || 0}`);
  console.log(`   Recently enhanced (last 2h): ${recentlyEnhanced || 0}`);
  
  // Get the most recent selections and enhancements
  const { data: recentSelections } = await supabase
    .from('articles')
    .select('title, source, selection_metadata, created_at')
    .eq('selected_for_enhancement', true)
    .order('selection_metadata->selected_at', { ascending: false })
    .limit(5);
  
  const { data: recentEnhancements } = await supabase
    .from('articles')
    .select('title, source, created_at, enhancement_metadata')
    .eq('is_ai_enhanced', true)
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (recentSelections && recentSelections.length > 0) {
    console.log(`\\n📝 Recent Selections:`);
    recentSelections.forEach((article, i) => {
      const selectedAt = article.selection_metadata?.selected_at;
      const timeAgo = selectedAt ? getTimeAgo(selectedAt) : 'unknown';
      console.log(`   ${i + 1}. [${timeAgo}] "${article.title?.substring(0, 40)}..." (${article.source})`);
    });
  } else {
    console.log(`\\n📝 No recent selections found`);
  }
  
  if (recentEnhancements && recentEnhancements.length > 0) {
    console.log(`\\n⚡ Recent Enhancements:`);
    recentEnhancements.forEach((article, i) => {
      const timeAgo = getTimeAgo(article.created_at);
      const batchId = article.enhancement_metadata?.batch_id || 'no-batch';
      console.log(`   ${i + 1}. [${timeAgo}] "${article.title?.substring(0, 40)}..." (${article.source}) [${batchId}]`);
    });
  } else {
    console.log(`\\n⚡ No recent enhancements found`);
  }
  
  return {
    selectedForEnhancement,
    availableCandidates,
    recentlyEnhanced
  };
}

async function diagnoseIssue() {
  console.log('\\n🔍 ISSUE DIAGNOSIS');
  console.log('='.repeat(50));
  
  console.log('\\n🕐 Cron Schedule Analysis:');
  console.log('   Selection cron:    :00, :15, :30, :45 (every 15 min)');
  console.log('   Enhancement cron:  :05, :20, :35, :50 (every 15 min, 5 min after)');
  console.log('\\n   Expected flow:');
  console.log('   14:30 → Selection runs, marks article selected_for_enhancement=true');
  console.log('   14:35 → Enhancement runs, finds selected article, processes it');
  console.log('\\n🔍 Possible Issues:');
  console.log('   1. Selection cron is not running or failing silently');
  console.log('   2. Selection cron runs but doesn\'t find suitable candidates');
  console.log('   3. Selection cron marks articles but they get processed immediately');
  console.log('   4. Database transaction race conditions between jobs');
  console.log('   5. Different environment variables between local and production');
}

async function main() {
  try {
    console.log('🚀 CRON JOB SYNCHRONIZATION DEBUG');
    console.log('='.repeat(70));
    console.log(`⏰ Debug time: ${new Date().toISOString()}`);
    
    const currentState = await checkCurrentState();
    await diagnoseIssue();
    
    console.log('\\n' + '='.repeat(70));
    console.log('🧪 SIMULATION TEST');
    console.log('='.repeat(70));
    
    const candidateToSelect = await simulateSelectionCron();
    if (candidateToSelect) {
      const selectedArticle = await simulateActualSelection(candidateToSelect);
      
      // Wait a moment to simulate the 5-minute gap
      console.log('\\n⏱️ Waiting 2 seconds to simulate cron gap...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const articleToEnhance = await simulateEnhancementCron();
      
      if (articleToEnhance) {
        console.log('\\n✅ SUCCESS: Selection → Enhancement flow working!');
        
        // Clean up test selection
        console.log('\\n🧹 Cleaning up test selection...');
        await supabase
          .from('articles')
          .update({
            selected_for_enhancement: false,
            selection_metadata: null
          })
          .eq('id', selectedArticle.id);
        console.log('✅ Test selection cleaned up');
      } else {
        console.log('\\n❌ ISSUE: Selection worked but enhancement failed to find article');
        console.log('   This matches your production issue!');
      }
    } else {
      console.log('\\n⚠️ Selection simulation found no candidates');
      console.log('   This could be why production cron jobs find nothing');
    }
    
    console.log('\\n\\n🎯 RECOMMENDED ACTIONS:');
    console.log('   1. Check Vercel cron logs for selection job output');
    console.log('   2. Add more detailed logging to both cron endpoints');
    console.log('   3. Verify cron jobs are actually running in production');
    console.log('   4. Check if environment variables differ between local/production');
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
    console.error('Stack:', error.stack);
  }
}

main().catch(console.error);