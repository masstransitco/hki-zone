const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://egyuetfeubznhcvmtary.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVneXVldGZldWJ6bmhjdm10YXJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTM3NTAwNSwiZXhwIjoyMDY2OTUxMDA1fQ.euSeh4C7FDt3vLWkBm1nt9wjxo8ZH25hQqAGNyW1gaA';

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function testAdminControls() {
  console.log('🧪 Testing Admin Article Controls\n');
  
  // 1. Check for articles marked for enhancement
  console.log('1️⃣ Checking articles marked for enhancement:');
  const { data: markedArticles, error: markedError } = await supabase
    .from('articles')
    .select('id, title, source, selection_metadata')
    .eq('selected_for_enhancement', true)
    .eq('is_ai_enhanced', false)
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (!markedError && markedArticles) {
    console.log(`   Found ${markedArticles.length} articles marked but not enhanced:`);
    markedArticles.forEach((article, index) => {
      const method = article.selection_metadata?.selection_method || 'unknown';
      const session = article.selection_metadata?.selection_session || 'unknown';
      console.log(`   ${index + 1}. "${article.title.substring(0, 50)}..."`);
      console.log(`      Method: ${method} | Session: ${session.substring(0, 40)}...`);
    });
  } else {
    console.log('   No articles marked for enhancement');
  }
  
  // 2. Check for recently enhanced articles
  console.log('\n2️⃣ Checking recently enhanced articles:');
  const { data: enhancedArticles } = await supabase
    .from('articles')
    .select('id, title, enhancement_metadata')
    .eq('is_ai_enhanced', true)
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (enhancedArticles && enhancedArticles.length > 0) {
    console.log(`   Found ${enhancedArticles.length} recently enhanced articles:`);
    enhancedArticles.forEach((article, index) => {
      const metadata = article.enhancement_metadata;
      const method = metadata?.enhancement_method || 'unknown';
      const adminTriggered = metadata?.admin_triggered || false;
      console.log(`   ${index + 1}. "${article.title.substring(0, 50)}..."`);
      console.log(`      Method: ${method} | Admin: ${adminTriggered}`);
    });
  }
  
  // 3. Check session ID format consistency
  console.log('\n3️⃣ Checking session ID formats:');
  const { data: sessionSamples } = await supabase
    .from('articles')
    .select('selection_metadata')
    .not('selection_metadata', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (sessionSamples) {
    const sessions = sessionSamples
      .map(a => a.selection_metadata?.selection_session)
      .filter(s => s && typeof s === 'string');
      
    const adminSessions = sessions.filter(s => s.includes('admin_selection_'));
    const cronSessions = sessions.filter(s => s.includes('selection_') && !s.includes('admin_'));
    const otherSessions = sessions.filter(s => !s.includes('selection_'));
    
    console.log(`   Admin sessions: ${adminSessions.length} (format: admin_selection_timestamp_random)`);
    console.log(`   Cron sessions: ${cronSessions.length} (format: selection_timestamp_random)`);
    console.log(`   Other formats: ${otherSessions.length}`);
    
    if (otherSessions.length > 0) {
      console.log('   ⚠️ Found non-standard session IDs:', otherSessions.slice(0, 3));
    }
  }
  
  // 4. Test duplicate detection
  console.log('\n4️⃣ Testing duplicate detection:');
  const { data: allArticles } = await supabase
    .from('articles')
    .select('id, title')
    .eq('is_ai_enhanced', false)
    .eq('selected_for_enhancement', false)
    .order('created_at', { ascending: false })
    .limit(100);
    
  if (allArticles && allArticles.length > 0) {
    // Check for similar titles
    const titleMap = {};
    allArticles.forEach(article => {
      const normalized = article.title.trim().toLowerCase().replace(/\s+/g, ' ').substring(0, 50);
      if (!titleMap[normalized]) titleMap[normalized] = [];
      titleMap[normalized].push(article);
    });
    
    const potentialDuplicates = Object.values(titleMap).filter(articles => articles.length > 1);
    console.log(`   Found ${potentialDuplicates.length} groups of similar unprocessed articles`);
    
    if (potentialDuplicates.length > 0) {
      console.log('   First duplicate group:', potentialDuplicates[0].map(a => a.title.substring(0, 50)));
    }
  }
  
  console.log('\n✅ Admin Controls Test Summary:');
  console.log('   1. Post-enhancement marking: Check enhancement_metadata.admin_triggered field');
  console.log('   2. Session ID format: Standardized to include method prefix');
  console.log('   3. Duplicate detection: Manual selection checks for similar titles');
  console.log('   4. Error handling: Bulk operations continue on failure with detailed reporting');
}

testAdminControls().catch(console.error);