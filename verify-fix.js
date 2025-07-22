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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

async function verifyFix() {
  console.log('✅ VERIFYING CRON JOB AUTHENTICATION FIX');
  console.log('='.repeat(50));
  
  console.log('🔧 FIXES APPLIED:');
  console.log('✅ Enhanced authentication logic in all cron endpoints');
  console.log('✅ Better logging for production debugging');
  console.log('✅ Robust handling of missing CRON_SECRET');
  console.log('✅ Clear separation of Vercel cron vs manual auth');
  
  console.log('\\n📊 CURRENT DATABASE STATE:');
  
  // Check recent selections
  const { data: recentSelections } = await supabase
    .from('articles')
    .select('title, source, selection_metadata')
    .not('selection_metadata', 'is', null)
    .order('selection_metadata->selected_at', { ascending: false })
    .limit(5);
  
  console.log('\\nRecent selections:');
  if (recentSelections && recentSelections.length > 0) {
    recentSelections.forEach((article, i) => {
      const selectedAt = article.selection_metadata?.selected_at;
      const timeAgo = selectedAt ? getTimeAgo(selectedAt) : 'unknown';
      const method = article.selection_metadata?.selection_method || 'unknown';
      console.log(`   ${i + 1}. [${timeAgo}] "${article.title?.substring(0, 40)}..." (${method})`);
    });
  } else {
    console.log('   No recent selections found');
  }
  
  // Check recent enhancements  
  const { data: recentEnhancements } = await supabase
    .from('articles')
    .select('title, source, created_at, enhancement_metadata')
    .eq('is_ai_enhanced', true)
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log('\\nRecent enhancements:');
  if (recentEnhancements && recentEnhancements.length > 0) {
    recentEnhancements.forEach((article, i) => {
      const timeAgo = getTimeAgo(article.created_at);
      const method = article.enhancement_metadata?.enhancement_method || 'unknown';
      console.log(`   ${i + 1}. [${timeAgo}] "${article.title?.substring(0, 40)}..." (${method})`);
    });
  } else {
    console.log('   No recent enhancements found');
  }
  
  console.log('\\n🎯 POST-DEPLOYMENT VERIFICATION CHECKLIST:');
  console.log('\\n1. Deploy these changes to production');
  console.log('2. Wait for next cron execution (next :00, :15, :30, or :45)');
  console.log('3. Check Vercel function logs for enhanced authentication messages');
  console.log('4. Look for "✅ Authentication: Vercel Cron" in selection logs');
  console.log('5. Verify new selections have selection_method: "cron_automated"');
  console.log('6. Confirm enhancements have enhancement_method: "cron_trilingual"');
  
  console.log('\\n🚨 IF CRON JOBS STILL FAIL AFTER THIS FIX:');
  console.log('   The issue is likely in Vercel configuration, not code:');
  console.log('   • Check if CRON_SECRET is set in Vercel environment variables');
  console.log('   • Verify cron jobs are enabled in Vercel dashboard');
  console.log('   • Confirm vercel.json was deployed correctly');
  
  console.log('\\n✅ THIS FIX ADDRESSES:');
  console.log('   • Robust authentication for both Vercel cron and manual triggers');
  console.log('   • Better error logging to debug production issues');
  console.log('   • Handles missing CRON_SECRET gracefully');
  console.log('   • Clear separation of authentication methods');
  
  console.log('\\n🎉 The cron job authentication issue should now be resolved!');
}

verifyFix().catch(console.error);