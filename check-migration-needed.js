// Check if migration is needed by testing API response
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

async function checkMigrationStatus() {
  try {
    console.log('\n=== Checking Migration Status ===');
    
    // Try to fetch one record to see current schema
    const { data: articles, error } = await supabase
      .from('perplexity_news')
      .select('*')
      .limit(1);
      
    if (error) {
      console.error('❌ Error fetching data:', error);
      return;
    }
    
    if (!articles || articles.length === 0) {
      console.log('📊 No articles found to check schema');
      return;
    }
    
    const article = articles[0];
    const hasPublishedAt = 'published_at' in article;
    const hasInsertedAt = 'inserted_at' in article;
    
    console.log('📋 Current schema check:');
    console.log(`   • published_at field: ${hasPublishedAt ? '✅ Present' : '❌ Missing'}`);
    console.log(`   • inserted_at field: ${hasInsertedAt ? '✅ Present' : '❌ Missing'}`);
    console.log(`   • created_at field: ${'created_at' in article ? '✅ Present' : '❌ Missing'}`);
    console.log(`   • updated_at field: ${'updated_at' in article ? '✅ Present' : '❌ Missing'}`);
    
    if (hasPublishedAt) {
      console.log('\n⚠️  Migration needed: published_at column still exists');
      console.log('   The application code has been updated but database schema needs to be migrated');
      console.log('   For now, the app will work but may show incorrect timestamps');
    } else {
      console.log('\n✅ Migration complete: published_at column successfully removed');
      console.log('   Application will now use created_at for timestamp display');
    }
    
    // Show sample timestamps
    if (hasPublishedAt) {
      console.log('\n📅 Sample timestamps (before migration):');
      console.log(`   published_at: ${article.published_at}`);
      console.log(`   created_at:   ${article.created_at}`);
    } else {
      console.log('\n📅 Sample timestamps (after migration):');
      console.log(`   created_at:   ${article.created_at}`);
      console.log(`   updated_at:   ${article.updated_at}`);
    }
    
  } catch (err) {
    console.error('Error checking migration status:', err.message);
  }
}

checkMigrationStatus();