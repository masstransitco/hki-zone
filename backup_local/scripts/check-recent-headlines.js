const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkRecentHeadlines() {
  console.log('🔍 Checking Recent Headlines Pattern\n');

  try {
    // Get recent headlines grouped by title
    const { data: titleGroups, error } = await supabase
      .from('articles_unified')
      .select('title, source')
      .eq('article_type', 'ai_generated')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error:', error);
      return;
    }

    // Count occurrences of each title
    const titleCounts = {};
    titleGroups.forEach(article => {
      titleCounts[article.title] = (titleCounts[article.title] || 0) + 1;
    });

    console.log('📊 Title frequency (last 100 articles):');
    Object.entries(titleCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([title, count]) => {
        console.log(`   ${count}x - ${title}`);
      });

    // Check sources
    const sourceCounts = {};
    titleGroups.forEach(article => {
      sourceCounts[article.source] = (sourceCounts[article.source] || 0) + 1;
    });

    console.log('\n📊 Sources:');
    Object.entries(sourceCounts).forEach(([source, count]) => {
      console.log(`   ${count}x - ${source}`);
    });

    // Check if these are the fallback headlines
    const fallbackTitles = [
      "港府推新政策支援中小企",
      "港股今升逾300點",
      "香港推出數碼港元試驗計劃",
      "公立醫院急症室輪候時間",
      "新年花市下週開鑼",
      "香港電影金像獎提名公布"
    ];

    const usingFallback = Object.keys(titleCounts).every(title => 
      fallbackTitles.includes(title)
    );

    if (usingFallback) {
      console.log('\n⚠️  WARNING: All headlines match the fallback pattern!');
      console.log('The system is using hardcoded fallback headlines instead of generating real news.');
    }

    // Check URL patterns
    console.log('\n🔍 Checking URL patterns:');
    const { data: urlSample, error: urlError } = await supabase
      .from('articles_unified')
      .select('url, title')
      .eq('article_type', 'ai_generated')
      .order('created_at', { ascending: false })
      .limit(5);

    if (!urlError && urlSample) {
      urlSample.forEach(article => {
        console.log(`   ${article.title}`);
        console.log(`   -> ${article.url}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkRecentHeadlines();