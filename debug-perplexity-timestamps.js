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

function analyzeTimestamp(timestamp, label) {
  if (!timestamp) return `${label}: NULL`;
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffHours = (now - date) / (1000 * 60 * 60);
  
  let analysis = '';
  if (diffHours < 0) {
    analysis = ' (FUTURE - INCORRECT!)';
  } else if (diffHours < 1) {
    analysis = ` (${Math.round(diffHours * 60)} mins ago)`;
  } else if (diffHours < 24) {
    analysis = ` (${Math.round(diffHours)} hours ago)`;
  } else {
    analysis = ` (${Math.round(diffHours / 24)} days ago)`;
  }
  
  return `${label}: ${formatTimestamp(timestamp)}${analysis}`;
}

async function checkPerplexityTimestamps() {
  try {
    console.log('\n=== Perplexity News Timestamp Analysis ===');
    console.log('Current time:', formatTimestamp(new Date()));
    console.log('\n📋 Timestamp Field Definitions:');
    console.log('  • published_at  - When the original article was published');
    console.log('  • inserted_at   - When the article was first inserted into our database');
    console.log('  • created_at    - When the database record was created (auto-generated)');
    console.log('  • updated_at    - When the record was last modified (auto-updated via trigger)');
    
    const { data: articles, error } = await supabase
      .from('perplexity_news')
      .select('id, title, category, published_at, inserted_at, created_at, updated_at, article_status, image_status')
      .order('updated_at', { ascending: false })
      .limit(10);
      
    if (error) {
      console.error('Query error:', error);
      return;
    }
    
    if (!articles || articles.length === 0) {
      console.log('\n❌ No perplexity articles found in database');
      return;
    }
    
    console.log(`\n📊 Found ${articles.length} perplexity articles\n`);
    
    let issuesFound = 0;
    
    articles.forEach((article, i) => {
      console.log(`${i + 1}. "${article.title}" (${article.category})`);
      console.log(`   Status: article=${article.article_status}, image=${article.image_status}`);
      
      // Analyze each timestamp
      console.log(`   ${analyzeTimestamp(article.published_at, 'Published ')}`);
      console.log(`   ${analyzeTimestamp(article.inserted_at, 'Inserted ')}`);
      console.log(`   ${analyzeTimestamp(article.created_at, 'Created  ')}`);
      console.log(`   ${analyzeTimestamp(article.updated_at, 'Updated  ')}`);
      
      // Check for timestamp issues
      const published = new Date(article.published_at);
      const inserted = new Date(article.inserted_at);
      const created = new Date(article.created_at);
      const updated = new Date(article.updated_at);
      const now = new Date();
      
      let hasIssues = false;
      
      // Check if published_at is in the future
      if (published > now) {
        console.log(`   ⚠️  ISSUE: published_at is in the future!`);
        hasIssues = true;
        issuesFound++;
      }
      
      // Check if inserted_at is before published_at (impossible)
      if (inserted < published) {
        console.log(`   ⚠️  ISSUE: inserted_at is before published_at!`);
        hasIssues = true;
        issuesFound++;
      }
      
      // Check if created_at is significantly different from inserted_at
      const diffMinutes = Math.abs(created - inserted) / (1000 * 60);
      if (diffMinutes > 5) {
        console.log(`   ⚠️  ISSUE: created_at and inserted_at differ by ${Math.round(diffMinutes)} minutes`);
        hasIssues = true;
        issuesFound++;
      }
      
      // Check ordering - updated_at should be >= created_at
      if (updated < created) {
        console.log(`   ⚠️  ISSUE: updated_at is before created_at!`);
        hasIssues = true;
        issuesFound++;
      }
      
      if (!hasIssues) {
        console.log(`   ✅ Timestamps look correct`);
      }
      
      console.log('');
    });
    
    console.log(`\n📈 Summary:`);
    console.log(`   Total articles analyzed: ${articles.length}`);
    console.log(`   Issues found: ${issuesFound}`);
    
    if (issuesFound > 0) {
      console.log(`\n🔍 Common causes of timestamp issues:`);
      console.log(`   • published_at in future: Source feeds may have incorrect timestamps`);
      console.log(`   • inserted_at before published_at: Data collection timing issues`);
      console.log(`   • Large created_at vs inserted_at diff: Database lag or manual insertions`);
      console.log(`\n💡 The feed uses 'updated_at' for ordering, so enrichment timing matters most.`);
    } else {
      console.log(`\n✅ All timestamps appear to be correct!`);
    }
    
    // Show the current ordering logic
    console.log(`\n🔄 Current Feed Ordering Logic:`);
    console.log(`   PRIMARY: updated_at DESC (most recently updated first)`);
    console.log(`   SECONDARY: id DESC (for pagination stability)`);
    console.log(`\n   This means articles appear at the top when they are:`);
    console.log(`   • Newly inserted (created_at = updated_at)`);
    console.log(`   • Recently enriched (updated_at changes when status updates)`);
    console.log(`   • Recently had images added (updated_at changes when image_status updates)`);
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function checkSpecificTimestampIssue() {
  console.log('\n=== Checking for Specific Timestamp Pattern ===');
  console.log('Looking for articles with published_at around 09/07/2025, 11:15:00...\n');
  
  try {
    // Look for articles with suspicious future dates
    const { data: futureArticles, error } = await supabase
      .from('perplexity_news')
      .select('*')
      .gte('published_at', '2025-01-01')
      .order('published_at', { ascending: false });
      
    if (error) {
      console.error('Query error:', error);
      return;
    }
    
    if (futureArticles && futureArticles.length > 0) {
      console.log(`🚨 Found ${futureArticles.length} articles with future published_at dates:`);
      
      futureArticles.forEach((article, i) => {
        console.log(`\n${i + 1}. "${article.title}"`);
        console.log(`   Published: ${formatTimestamp(article.published_at)} (FUTURE)`);
        console.log(`   Created:   ${formatTimestamp(article.created_at)}`);
        console.log(`   Updated:   ${formatTimestamp(article.updated_at)}`);
        console.log(`   Source:    ${article.source}`);
        console.log(`   URL:       ${article.url}`);
      });
      
      console.log(`\n💡 Recommendations:`);
      console.log(`   1. Check the source feeds for timestamp issues`);
      console.log(`   2. Verify timezone handling in data collection`);
      console.log(`   3. Consider using inserted_at or created_at for display instead of published_at`);
      console.log(`   4. Add validation to reject articles with future published_at dates`);
    } else {
      console.log(`✅ No articles found with future published_at dates`);
    }
    
  } catch (err) {
    console.error('Error checking specific pattern:', err.message);
  }
}

async function main() {
  await checkPerplexityTimestamps();
  await checkSpecificTimestampIssue();
}

main();