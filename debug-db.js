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

async function checkDatabaseColumns() {
  console.log('\n=== Checking Database Columns ===');
  
  const columns = [
    'id', 'title', 'content', 'summary', 'ai_summary', 'url', 'source',
    'author', 'published_at', 'image_url', 'category', 'created_at',
    'updated_at', 'is_ai_enhanced', 'original_article_id',
    'enhancement_metadata', 'language', 'deleted_at'
  ];
  
  const missingColumns = [];
  
  for (const column of columns) {
    const { error } = await supabase
      .from('articles')
      .select(column)
      .limit(1);
    
    if (error && error.message.includes(`column "${column}"`)) {
      missingColumns.push(column);
      console.log(`  ✗ Missing: ${column}`);
    } else {
      console.log(`  ✓ Exists: ${column}`);
    }
  }
  
  if (missingColumns.length > 0) {
    console.log(`\n⚠️  Missing columns: ${missingColumns.join(', ')}`);
    console.log('\nTo fix missing columns:');
    
    if (missingColumns.includes('language')) {
      console.log('  - Language field: curl -X POST http://localhost:3000/api/admin/database/add-language-field');
    }
    if (missingColumns.includes('deleted_at')) {
      console.log('  - Deleted at field: curl -X POST http://localhost:3000/api/admin/database/add-deleted-at-field');
    }
    if (missingColumns.includes('is_ai_enhanced')) {
      console.log('  - AI enhancement fields: curl -X POST http://localhost:3000/api/admin/database/migrate-ai-enhancement');
    }
  } else {
    console.log('\n✅ All expected columns exist!');
  }
  
  return missingColumns;
}

async function checkPerplexityColumns() {
  console.log('\n=== Checking Perplexity News Columns ===');
  
  const baseColumns = [
    'id', 'title', 'category', 'url', 'url_hash', 'article_status', 'image_status',
    'article_html', 'lede', 'image_url', 'image_prompt', 'image_license',
    'source', 'author', 'published_at', 'inserted_at', 'created_at', 'updated_at',
    'perplexity_model', 'generation_cost', 'search_queries', 'citations'
  ];
  
  const enhancedColumns = [
    'enhanced_title', 'summary', 'key_points', 'why_it_matters', 'structured_sources'
  ];
  
  const missingBaseColumns = [];
  const missingEnhancedColumns = [];
  
  // Check base columns
  for (const column of baseColumns) {
    const { error } = await supabase
      .from('perplexity_news')
      .select(column)
      .limit(1);
    
    if (error && error.message.includes(`column "${column}"`)) {
      missingBaseColumns.push(column);
      console.log(`  ✗ Missing base: ${column}`);
    } else {
      console.log(`  ✓ Base exists: ${column}`);
    }
  }
  
  // Check enhanced columns (these are the ones we need for AI enhancement)
  for (const column of enhancedColumns) {
    const { error } = await supabase
      .from('perplexity_news')
      .select(column)
      .limit(1);
    
    if (error && error.message.includes(`column "${column}"`)) {
      missingEnhancedColumns.push(column);
      console.log(`  ✗ Missing enhanced: ${column}`);
    } else {
      console.log(`  ✓ Enhanced exists: ${column}`);
    }
  }
  
  if (missingBaseColumns.length > 0) {
    console.log(`\n⚠️  Missing base perplexity columns: ${missingBaseColumns.join(', ')}`);
    console.log('   Run: scripts/add-perplexity-news-table.sql');
  }
  
  if (missingEnhancedColumns.length > 0) {
    console.log(`\n🚨 Missing enhanced perplexity columns: ${missingEnhancedColumns.join(', ')}`);
    console.log('   This is why you\'re getting the PGRST204 error!');
    console.log('\n   To fix, run ONE of these SQL migrations:');
    console.log('   • scripts/add-enhanced-perplexity-fields.sql');
    console.log('   • scripts/quick-add-enhanced-fields.sql');
    console.log('\n   Or copy-paste this into Supabase SQL Editor:');
    console.log('   ALTER TABLE perplexity_news ADD COLUMN IF NOT EXISTS enhanced_title TEXT;');
    console.log('   ALTER TABLE perplexity_news ADD COLUMN IF NOT EXISTS summary TEXT;');
    console.log('   ALTER TABLE perplexity_news ADD COLUMN IF NOT EXISTS key_points TEXT[];');
    console.log('   ALTER TABLE perplexity_news ADD COLUMN IF NOT EXISTS why_it_matters TEXT;');
    console.log('   ALTER TABLE perplexity_news ADD COLUMN IF NOT EXISTS structured_sources JSONB;');
  } else {
    console.log('\n✅ All enhanced perplexity columns exist!');
  }
  
  return { missingBaseColumns, missingEnhancedColumns };
}

async function checkDatabase() {
  try {
    // First check columns
    const missingColumns = await checkDatabaseColumns();
    
    // Check perplexity columns
    const { missingBaseColumns, missingEnhancedColumns } = await checkPerplexityColumns();
    
    console.log('\n=== Checking Database Articles ===');
    
    // Build select query with only existing columns
    const selectColumns = ['source', 'created_at', 'title'];
    if (!missingColumns.includes('is_ai_enhanced')) selectColumns.push('is_ai_enhanced');
    if (!missingColumns.includes('enhancement_metadata')) selectColumns.push('enhancement_metadata');
    selectColumns.push('content');
    
    const { data: articles, error } = await supabase
      .from('articles')
      .select(selectColumns.join(', '))
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