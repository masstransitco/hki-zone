const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load env vars
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

async function checkPerplexitySources() {
  const { data: articles } = await supabase
    .from('perplexity_news')
    .select('id, title, structured_sources, citations')
    .limit(3);
  
  console.log('=== Perplexity Articles Source Status ===');
  articles.forEach((article, i) => {
    console.log(`${i + 1}. ${article.title.substring(0, 50)}...`);
    console.log(`   structured_sources: ${article.structured_sources ? 'YES' : 'NO'}`);
    console.log(`   citations: ${article.citations ? article.citations.length + ' items' : 'NO'}`);
    if (article.structured_sources) {
      console.log(`   sources count: ${article.structured_sources.sources?.length || 0}`);
    }
    console.log('');
  });
}

checkPerplexitySources();