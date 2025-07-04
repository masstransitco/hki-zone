const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load environment variables from .env.local
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
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  try {
    console.log('Checking database articles...');
    
    const { data: articles, error } = await supabase
      .from('articles')
      .select('source, created_at, title, is_ai_enhanced, enhancement_metadata, content')
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Query error:', error);
      return;
    }
    
    console.log('Total articles in database:', articles.length);
    
    // Group by source
    const bySource = {};
    articles.forEach(article => {
      bySource[article.source] = (bySource[article.source] || 0) + 1;
    });
    
    console.log('\nArticles by source:', bySource);
    
    // Show recent articles
    // Check unique source values
    const uniqueSources = [...new Set(articles.map(a => a.source))];
    console.log('\nUnique source values in database:');
    uniqueSources.forEach(source => console.log(`  - "${source}"`));
    
    // Check AI enhanced articles specifically
    const aiEnhanced = articles.filter(a => a.source.includes('AI Enhanced') || a.is_ai_enhanced);
    console.log(`\nAI Enhanced articles: ${aiEnhanced.length}`);
    aiEnhanced.slice(0, 3).forEach((article, i) => {
      const sourcesCount = article.enhancement_metadata?.sources?.length || 0;
      const hasStructuredContent = article.enhancement_metadata?.structuredContent ? 'Yes' : 'No';
      const enhancedTitle = article.enhancement_metadata?.structuredContent?.enhancedTitle || 'None';
      console.log(`  ${i + 1}. DB Title: "${article.title}"`);
      console.log(`      Enhanced Title: "${enhancedTitle}"`);
      console.log(`      Source: "${article.source}", is_ai_enhanced: ${article.is_ai_enhanced}`);
      console.log(`      Sources: ${sourcesCount}, Structured: ${hasStructuredContent}`);
      console.log(`      Content Preview: "${article.content?.substring(0, 100)}..."`);
      console.log('---');
    });
    
    console.log('\nRecent 15 articles:');
    articles.slice(0, 15).forEach((article, i) => {
      const aiFlag = article.is_ai_enhanced ? ' [AI]' : '';
      console.log(`${i + 1}. [${article.source}]${aiFlag} ${new Date(article.created_at).toLocaleString()} - ${article.title?.substring(0, 50)}...`);
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkDatabase();