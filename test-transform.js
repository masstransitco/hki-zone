const { createClient } = require('@supabase/supabase-js');
const { transformPerplexityToArticle } = require('./lib/perplexity-utils');
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

async function testTransformation() {
  const { data: articles } = await supabase
    .from('perplexity_news')
    .select('*')
    .limit(2);
  
  console.log('=== Testing Transformation ===');
  
  articles.forEach((perplexityArticle, i) => {
    console.log(`\n${i + 1}. Original Perplexity Article:`);
    console.log(`   Title: ${perplexityArticle.title}`);
    console.log(`   Citations: ${perplexityArticle.citations?.length || 0} items`);
    console.log(`   Structured Sources: ${perplexityArticle.structured_sources ? 'YES' : 'NO'}`);
    
    const transformedArticle = transformPerplexityToArticle(perplexityArticle);
    
    console.log(`\n   Transformed Article:`);
    console.log(`   Title: ${transformedArticle.title}`);
    console.log(`   isAiEnhanced: ${transformedArticle.isAiEnhanced}`);
    console.log(`   Sources: ${transformedArticle.enhancementMetadata?.sources?.length || 0} items`);
    
    if (transformedArticle.enhancementMetadata?.sources?.length > 0) {
      console.log(`   Source examples:`);
      transformedArticle.enhancementMetadata.sources.slice(0, 2).forEach((source, j) => {
        console.log(`     ${j + 1}. ${source.title} (${source.domain})`);
      });
    }
  });
}

testTransformation();