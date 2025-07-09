const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load environment variables
const envFile = fs.readFileSync('.env.local', 'utf8');
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

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkAdminPanelQuery() {
  console.log('=== Admin Panel Query Analysis ===');
  
  // All articles
  const { data: allArticles } = await supabase
    .from('perplexity_news')
    .select('*')
    .order('inserted_at', { ascending: false });
  
  console.log('Total articles in DB:', allArticles.length);
  
  // Admin panel query
  const { data: adminArticles } = await supabase
    .from('perplexity_news')
    .select('*')
    .in('article_status', ['ready', 'pending', 'enriched'])
    .neq('source', 'Perplexity AI (Fallback)')
    .order('inserted_at', { ascending: false });
  
  console.log('Admin panel articles:', adminArticles.length);
  console.log('Difference:', allArticles.length - adminArticles.length);
  
  // Find hidden articles
  const hiddenArticles = allArticles.filter(a => 
    !adminArticles.some(admin => admin.id === a.id)
  );
  
  console.log('\n=== Hidden Articles Analysis ===');
  console.log('Total hidden articles:', hiddenArticles.length);
  
  // Group hidden by reason
  const fallbackArticles = hiddenArticles.filter(a => a.source === 'Perplexity AI (Fallback)');
  const statusFiltered = hiddenArticles.filter(a => !['ready', 'pending', 'enriched'].includes(a.article_status));
  
  console.log('- Fallback source articles:', fallbackArticles.length);
  console.log('- Invalid status articles:', statusFiltered.length);
  
  if (statusFiltered.length > 0) {
    const statusCounts = {};
    statusFiltered.forEach(a => {
      statusCounts[a.article_status] = (statusCounts[a.article_status] || 0) + 1;
    });
    console.log('  Status breakdown:', statusCounts);
  }
  
  // Show source breakdown
  console.log('\n=== Source Breakdown ===');
  const sourceCounts = {};
  allArticles.forEach(a => {
    sourceCounts[a.source] = (sourceCounts[a.source] || 0) + 1;
  });
  
  Object.entries(sourceCounts).forEach(([source, count]) => {
    console.log(`  ${source}: ${count}`);
  });
  
  // Show sample hidden articles
  if (hiddenArticles.length > 0) {
    console.log('\n=== Sample Hidden Articles ===');
    hiddenArticles.slice(0, 10).forEach((article, i) => {
      console.log(`${i + 1}. [${article.article_status}] [${article.source}] ${article.title.substring(0, 60)}...`);
    });
  }
}

checkAdminPanelQuery();