// Fix existing articles with incorrect published_at timestamps
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

function formatTimestamp(timestamp) {
  if (!timestamp) return 'NULL';
  const date = new Date(timestamp);
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

async function fixExistingTimestamps() {
  try {
    console.log('\n=== Fixing Existing Article Timestamps ===');
    
    // Find articles where published_at is in the future compared to created_at
    console.log('🔍 Finding articles with incorrect future timestamps...');
    
    // Get all articles and filter manually since Supabase doesn't support column comparisons
    const { data: allArticles, error: findError } = await supabase
      .from('perplexity_news')
      .select('id, title, published_at, created_at, updated_at')
      .order('created_at', { ascending: false });
    
    if (findError) {
      console.error('❌ Error fetching articles:', findError);
      return;
    }
    
    // Filter articles where published_at is in the future compared to created_at
    const problematicArticles = allArticles.filter(article => {
      const publishedTime = new Date(article.published_at);
      const createdTime = new Date(article.created_at);
      return publishedTime > createdTime;
    });
    
    if (!problematicArticles || problematicArticles.length === 0) {
      console.log('✅ No articles found with incorrect timestamps');
      return;
    }
    
    console.log(`📊 Found ${problematicArticles.length} articles with incorrect timestamps:`);
    problematicArticles.forEach((article, i) => {
      console.log(`  ${i + 1}. "${article.title}"`);
      console.log(`     Published: ${formatTimestamp(article.published_at)}`);
      console.log(`     Created:   ${formatTimestamp(article.created_at)}`);
      const publishedTime = new Date(article.published_at);
      const createdTime = new Date(article.created_at);
      const diffHours = (publishedTime - createdTime) / (1000 * 60 * 60);
      console.log(`     Difference: ${diffHours.toFixed(1)} hours (published is in the future)`);
    });
    
    console.log('\n🔧 Fixing timestamps by setting published_at = created_at...');
    
    let fixedCount = 0;
    
    for (const article of problematicArticles) {
      try {
        const { error: updateError } = await supabase
          .from('perplexity_news')
          .update({ 
            published_at: article.created_at  // Set published_at to created_at
          })
          .eq('id', article.id);
        
        if (updateError) {
          console.error(`❌ Failed to fix article "${article.title}":`, updateError);
        } else {
          console.log(`✅ Fixed "${article.title}"`);
          console.log(`   New published_at: ${formatTimestamp(article.created_at)}`);
          fixedCount++;
        }
      } catch (err) {
        console.error(`❌ Unexpected error fixing article "${article.title}":`, err);
      }
    }
    
    console.log(`\n📋 Summary:`);
    console.log(`   • Articles found with incorrect timestamps: ${problematicArticles.length}`);
    console.log(`   • Articles successfully fixed: ${fixedCount}`);
    console.log(`   • Failed fixes: ${problematicArticles.length - fixedCount}`);
    
    if (fixedCount > 0) {
      console.log('\n✨ Timestamp corrections complete!');
      console.log('   The perplexity feed should now show correct "time ago" values');
      console.log('   New articles will automatically use correct timestamps');
    }
    
  } catch (err) {
    console.error('Error during timestamp fix:', err.message);
  }
}

fixExistingTimestamps();