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

async function directDatabaseAnalysis() {
  console.log('🔍 DIRECT DATABASE ANALYSIS - ROOT CAUSE INVESTIGATION');
  console.log('='.repeat(70));
  console.log(`⏰ Analysis time: ${new Date().toISOString()}`);
  
  // 1. Check when articles were last selected
  console.log('\\n1️⃣ SELECTION TIMELINE ANALYSIS');
  console.log('-'.repeat(40));
  
  const { data: recentSelections } = await supabase
    .from('articles')
    .select('title, source, created_at, selection_metadata')
    .not('selection_metadata', 'is', null)
    .order('selection_metadata->selected_at', { ascending: false })
    .limit(10);
  
  console.log('Recent selections (last 10):');
  if (recentSelections && recentSelections.length > 0) {
    recentSelections.forEach((article, i) => {
      const selectedAt = article.selection_metadata?.selected_at;
      const timeAgo = selectedAt ? getTimeAgo(selectedAt) : 'unknown';
      console.log(`   ${i + 1}. [${timeAgo}] "${article.title?.substring(0, 40)}..." (${article.source})`);
    });
  } else {
    console.log('   ❌ NO SELECTIONS FOUND - This confirms the selection cron is NOT working!');
  }
  
  // 2. Check when articles were last enhanced
  console.log('\\n2️⃣ ENHANCEMENT TIMELINE ANALYSIS');
  console.log('-'.repeat(40));
  
  const { data: recentEnhancements } = await supabase
    .from('articles')
    .select('title, source, created_at, enhancement_metadata')
    .eq('is_ai_enhanced', true)
    .order('created_at', { ascending: false })
    .limit(10);
  
  console.log('Recent enhancements (last 10):');
  if (recentEnhancements && recentEnhancements.length > 0) {
    recentEnhancements.forEach((article, i) => {
      const timeAgo = getTimeAgo(article.created_at);
      const method = article.enhancement_metadata?.enhancement_method || 'unknown';
      console.log(`   ${i + 1}. [${timeAgo}] "${article.title?.substring(0, 40)}..." (${article.source}) [${method}]`);
    });
  } else {
    console.log('   ❌ NO ENHANCEMENTS FOUND');
  }
  
  // 3. Check current stuck state
  console.log('\\n3️⃣ CURRENT PIPELINE STATE');
  console.log('-'.repeat(40));
  
  const { count: stuckSelections } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('selected_for_enhancement', true)
    .eq('is_ai_enhanced', false);
  
  const { count: availableCandidates } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('selected_for_enhancement', false)
    .eq('is_ai_enhanced', false)
    .in('source', ['HKFP', 'SingTao', 'HK01', 'on.cc', 'RTHK', 'AM730', 'SCMP'])
    .gte('created_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
    .not('content', 'is', null);
  
  console.log(`Current pipeline state:`);
  console.log(`   • Stuck selections: ${stuckSelections || 0}`);
  console.log(`   • Available candidates: ${availableCandidates || 0}`);
  
  // 4. Check if manual admin enhancements are working
  console.log('\\n4️⃣ MANUAL VS CRON ENHANCEMENT ANALYSIS');
  console.log('-'.repeat(40));
  
  const { data: enhancementMethods } = await supabase
    .from('articles')
    .select('enhancement_metadata')
    .eq('is_ai_enhanced', true)
    .not('enhancement_metadata', 'is', null)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  
  const methodCounts = {};
  if (enhancementMethods) {
    enhancementMethods.forEach(article => {
      const method = article.enhancement_metadata?.enhancement_method || 'unknown';
      methodCounts[method] = (methodCounts[method] || 0) + 1;
    });
  }
  
  console.log('Enhancement methods (last 24h):');
  Object.entries(methodCounts).forEach(([method, count]) => {
    console.log(`   • ${method}: ${count} articles`);
  });
  
  // 5. ROOT CAUSE DETERMINATION
  console.log('\\n5️⃣ ROOT CAUSE ANALYSIS');
  console.log('-'.repeat(40));
  
  const lastSelection = recentSelections && recentSelections[0] ? recentSelections[0] : null;
  const lastSelectionTime = lastSelection?.selection_metadata?.selected_at;
  
  if (!lastSelectionTime) {
    console.log('🚨 ROOT CAUSE: NO SELECTIONS EVER RECORDED');
    console.log('   This means the selection cron job has NEVER successfully run');
    console.log('   Possible causes:');
    console.log('   1. Cron job not configured in Vercel');
    console.log('   2. CRON_SECRET environment variable missing/incorrect');
    console.log('   3. selectArticlesWithPerplexity function is broken');
    console.log('   4. Vercel cron jobs disabled for this project');
  } else {
    const hoursSinceLastSelection = (Date.now() - new Date(lastSelectionTime).getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceLastSelection > 24) {
      console.log(`🚨 ROOT CAUSE: SELECTION CRON JOB STOPPED WORKING`);
      console.log(`   Last selection was ${Math.round(hoursSinceLastSelection)} hours ago`);
      console.log(`   Expected: selections every 15 minutes`);
      console.log('   Possible causes:');
      console.log('   1. Recent deployment broke the cron job');
      console.log('   2. Environment variable changes');
      console.log('   3. Vercel function timeout/memory issues');
      console.log('   4. Database connection issues in production');
    } else {
      console.log(`✅ Selection cron was working recently (${Math.round(hoursSinceLastSelection)} hours ago)`);
      console.log('   Need to check why selections stopped');
    }
  }
  
  return {
    lastSelection,
    methodCounts,
    stuckSelections,
    availableCandidates
  };
}

async function testSelectArticlesFunction() {
  console.log('\\n6️⃣ TESTING selectArticlesWithPerplexity DIRECTLY');
  console.log('-'.repeat(40));
  
  try {
    // Import the function directly (same path as the cron job uses)
    const { selectArticlesWithPerplexity } = require('./lib/perplexity-article-selector.js');
    
    console.log('✅ Successfully imported selectArticlesWithPerplexity');
    console.log('🔄 Testing function with limit=1...');
    
    const result = await selectArticlesWithPerplexity(1);
    
    console.log(`📊 Function result:`);
    console.log(`   • Returned: ${result?.length || 0} articles`);
    
    if (result && result.length > 0) {
      const selected = result[0];
      console.log(`   • Selected: "${selected.title?.substring(0, 50)}..." (${selected.source})`);
      console.log(`   • Selection reason: ${selected.selection_reason}`);
      console.log(`   • Priority score: ${selected.priority_score}`);
      console.log('\\n✅ selectArticlesWithPerplexity is WORKING correctly');
      console.log('   The issue is NOT in the selection logic');
    } else {
      console.log('\\n❌ selectArticlesWithPerplexity returned no results');
      console.log('   This could be the root cause if it happens in production');
    }
    
    return result;
  } catch (error) {
    console.log('\\n❌ ERROR testing selectArticlesWithPerplexity:');
    console.log(`   Error: ${error.message}`);
    console.log(`   Stack: ${error.stack}`);
    console.log('\\n🚨 This could be the root cause if the function is broken');
    return null;
  }
}

async function generateFix(analysisResults) {
  console.log('\\n\\n🔧 PROPOSED FIX BASED ON ROOT CAUSE');
  console.log('='.repeat(70));
  
  const { lastSelection, methodCounts, stuckSelections, availableCandidates } = analysisResults;
  
  if (!lastSelection) {
    console.log('🎯 PRIMARY FIX: Selection cron job has never run');
    console.log('\\nIMPLEMENT THESE FIXES IN ORDER:');
    console.log('\\n1. VERIFY VERCEL CRON CONFIGURATION');
    console.log('   • Check vercel.json has the cron job');
    console.log('   • Verify deployment included vercel.json changes');
    console.log('   • Check Vercel dashboard → Functions → Cron Jobs');
    
    console.log('\\n2. CHECK ENVIRONMENT VARIABLES');
    console.log('   • Verify CRON_SECRET is set in Vercel environment');
    console.log('   • Ensure all Supabase env vars are correct');
    console.log('   • Check env vars are available in production');
    
    console.log('\\n3. TEST CRON ENDPOINT MANUALLY');
    console.log('   • Use curl to POST to your production /api/cron/select-article');
    console.log('   • Include proper headers (User-Agent: vercel-cron/1.0)');
    console.log('   • Check response and logs');
    
  } else {
    const hoursSinceLastSelection = (Date.now() - new Date(lastSelection.selection_metadata.selected_at).getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceLastSelection > 24) {
      console.log('🎯 PRIMARY FIX: Selection cron job stopped working recently');
      console.log('\\nIMPLEMENT THESE FIXES IN ORDER:');
      console.log('\\n1. CHECK VERCEL FUNCTION LOGS');
      console.log('   • Go to Vercel dashboard → Functions');
      console.log('   • Check logs for /api/cron/select-article');
      console.log('   • Look for errors around the time it stopped working');
      
      console.log('\\n2. CHECK FOR RECENT CHANGES');
      console.log('   • Review recent deployments');
      console.log('   • Check if any environment variables changed');
      console.log('   • Verify no breaking changes in dependencies');
    }
  }
  
  if (methodCounts['cron_trilingual'] > 0) {
    console.log('\\n✅ Enhancement cron IS working (found cron_trilingual enhancements)');
  } else if (Object.keys(methodCounts).length > 0) {
    console.log('\\n⚠️ Only manual enhancements found - confirms cron selection issue');
  }
  
  console.log('\\n🔄 IMMEDIATE WORKAROUND (while debugging):');
  console.log('   • Manually trigger selections from admin panel');
  console.log('   • Use the "AI Select + Enhance" button to process articles');
  console.log('   • This will keep content flowing while fixing the cron');
  
  console.log('\\n📋 POST-FIX VERIFICATION:');
  console.log('   • Run this script again in 30 minutes');
  console.log('   • Check for new entries in recent selections');
  console.log('   • Verify selections have selection_method: "cron_automated"');
}

async function main() {
  try {
    const analysisResults = await directDatabaseAnalysis();
    await testSelectArticlesFunction();
    await generateFix(analysisResults);
    
    console.log('\\n\\n🎯 NEXT IMMEDIATE ACTIONS:');
    console.log('1. Check Vercel dashboard cron logs RIGHT NOW');
    console.log('2. Verify CRON_SECRET environment variable');
    console.log('3. Test manual cron trigger to confirm fix works');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    console.error('Stack:', error.stack);
  }
}

main().catch(console.error);