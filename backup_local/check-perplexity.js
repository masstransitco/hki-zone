const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load env vars
try {
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
} catch (error) {
  console.error('Could not load .env.local:', error.message);
  process.exit(1);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkPerplexityArticles() {
  console.log('=== Checking Perplexity Articles ===');
  
  const { data: articles, error } = await supabase
    .from('perplexity_news')
    .select('*')
    .limit(5);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`Found ${articles.length} perplexity articles`);
  
  if (articles.length > 0) {
    const article = articles[0];
    console.log('Sample article columns:', Object.keys(article));
    console.log('\nEnhanced fields:');
    console.log('  enhanced_title:', article.enhanced_title || 'null');
    console.log('  summary:', article.summary || 'null');
    console.log('  key_points:', article.key_points || 'null');
    console.log('  why_it_matters:', article.why_it_matters || 'null');
    console.log('  structured_sources:', article.structured_sources || 'null');
    
    // Test update
    console.log('\n=== Testing Update ===');
    const testUpdate = {
      enhanced_title: 'Test Title',
      summary: 'Test Summary',
      key_points: ['Test point 1', 'Test point 2'],
      why_it_matters: 'Test significance',
      structured_sources: { test: 'data' }
    };
    
    const { data: updateData, error: updateError } = await supabase
      .from('perplexity_news')
      .update(testUpdate)
      .eq('id', article.id)
      .select();
    
    if (updateError) {
      console.error('❌ Update failed:', updateError);
    } else {
      console.log('✅ Update succeeded');
      
      // Revert changes
      await supabase
        .from('perplexity_news')
        .update({
          enhanced_title: article.enhanced_title,
          summary: article.summary,
          key_points: article.key_points,
          why_it_matters: article.why_it_matters,
          structured_sources: article.structured_sources
        })
        .eq('id', article.id);
    }
  }
}

checkPerplexityArticles();