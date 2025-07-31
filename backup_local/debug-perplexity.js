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
const perplexityKey = process.env.PERPLEXITY_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper functions
async function checkPerplexityTable() {
  console.log('\n=== Checking Perplexity News Table ===');
  
  try {
    const { data, error } = await supabase
      .from('perplexity_news')
      .select('*')
      .limit(1);
    
    if (error) {
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        console.log('❌ perplexity_news table does not exist');
        console.log('\nTo create the table, run:');
        console.log('  1. Copy the SQL from scripts/add-perplexity-news-table.sql');
        console.log('  2. Execute it in your Supabase dashboard');
        return false;
      } else {
        console.log('❌ Error accessing table:', error.message);
        return false;
      }
    }
    
    console.log('✅ perplexity_news table exists');
    return true;
  } catch (err) {
    console.log('❌ Failed to check table:', err.message);
    return false;
  }
}

async function showPerplexityStats() {
  console.log('\n=== Perplexity News Statistics ===');
  
  try {
    const { data: articles, error } = await supabase
      .from('perplexity_news')
      .select('*')
      .order('inserted_at', { ascending: false });
    
    if (error) {
      console.log('❌ Error fetching articles:', error.message);
      return;
    }
    
    console.log(`Total Perplexity articles: ${articles.length}`);
    
    if (articles.length === 0) {
      console.log('\n⚠️ No articles found. The cron jobs may not be running yet.');
      return;
    }
    
    // Group by category
    const byCategory = {};
    articles.forEach(article => {
      byCategory[article.category] = (byCategory[article.category] || 0) + 1;
    });
    
    console.log('\nArticles by category:');
    Object.entries(byCategory).forEach(([category, count]) => {
      console.log(`  ${category}: ${count}`);
    });
    
    // Group by status
    const byStatus = {};
    articles.forEach(article => {
      byStatus[article.article_status] = (byStatus[article.article_status] || 0) + 1;
    });
    
    console.log('\nArticles by status:');
    Object.entries(byStatus).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    
    // Image status
    const byImageStatus = {};
    articles.forEach(article => {
      byImageStatus[article.image_status] = (byImageStatus[article.image_status] || 0) + 1;
    });
    
    console.log('\nImages by status:');
    Object.entries(byImageStatus).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    
    // Cost analysis
    const totalCost = articles.reduce((sum, article) => sum + (article.generation_cost || 0), 0);
    console.log(`\nTotal generation cost: $${totalCost.toFixed(6)}`);
    
    // Recent articles
    console.log('\nRecent 10 articles:');
    articles.slice(0, 10).forEach((article, i) => {
      const time = new Date(article.inserted_at).toLocaleString();
      const cost = article.generation_cost ? `$${article.generation_cost.toFixed(4)}` : 'free';
      console.log(`${i + 1}. [${article.category}] ${article.article_status}/${article.image_status} (${cost}) - ${article.title}`);
      console.log(`    ${time} - ${article.url}`);
    });
    
  } catch (err) {
    console.log('❌ Error:', err.message);
  }
}

async function testPerplexityAPI() {
  console.log('\n=== Testing Perplexity API ===');
  
  if (!perplexityKey) {
    console.log('❌ PERPLEXITY_API_KEY not found in environment');
    return false;
  }
  
  console.log('✅ Perplexity API key found');
  
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'user',
            content: 'What is the current time in Hong Kong? Just respond with a simple sentence.'
          }
        ]
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ API Error: ${response.status} - ${errorText}`);
      return false;
    }
    
    const data = await response.json();
    console.log('✅ Perplexity API is working');
    console.log(`Response: ${data.choices[0].message.content}`);
    
    if (data.usage) {
      const cost = (data.usage.total_tokens / 1000) * 0.0001;
      console.log(`Tokens used: ${data.usage.total_tokens}, Cost: $${cost.toFixed(6)}`);
    }
    
    return true;
  } catch (err) {
    console.log('❌ API test failed:', err.message);
    return false;
  }
}

async function generateTestHeadline() {
  console.log('\n=== Generating Test Headline ===');
  
  if (!perplexityKey) {
    console.log('❌ PERPLEXITY_API_KEY not found');
    return;
  }
  
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: 'Return a JSON object with a Hong Kong news headline'
          },
          {
            role: 'user',
            content: 'Generate 1 sample Hong Kong news headline in this format: {"category":"politics","title":"Sample headline","url":"https://example.com/test","published_iso":"2024-01-15T10:30:00Z"}'
          }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'headline_schema',
            schema: {
              type: 'object',
              properties: {
                category: { type: 'string' },
                title: { type: 'string' },
                url: { type: 'string' },
                published_iso: { type: 'string' }
              },
              required: ['category', 'title', 'url', 'published_iso']
            }
          }
        }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Failed to generate headline: ${response.status} - ${errorText}`);
      return;
    }
    
    const data = await response.json();
    const headline = JSON.parse(data.choices[0].message.content);
    
    console.log('✅ Generated test headline:');
    console.log(`  Category: ${headline.category}`);
    console.log(`  Title: ${headline.title}`);
    console.log(`  URL: ${headline.url}`);
    console.log(`  Published: ${headline.published_iso}`);
    
    // Ask if user wants to save it
    if (process.argv.includes('--save-test')) {
      await saveTestHeadline(headline);
    } else {
      console.log('\nTo save this headline to database, run with --save-test flag');
    }
    
  } catch (err) {
    console.log('❌ Error generating headline:', err.message);
  }
}

async function saveTestHeadline(headline) {
  console.log('\n=== Saving Test Headline ===');
  
  try {
    const { data, error } = await supabase
      .from('perplexity_news')
      .insert([{
        category: headline.category,
        title: headline.title,
        url: headline.url,
        published_at: headline.published_iso,
        article_status: 'pending',
        image_status: 'pending',
        source: 'Perplexity AI (Test)',
        author: 'Test Generated',
        perplexity_model: 'sonar-pro',
        generation_cost: 0.0001
      }])
      .select();
    
    if (error) {
      console.log('❌ Failed to save headline:', error.message);
      return;
    }
    
    console.log('✅ Test headline saved to database');
    console.log(`   ID: ${data[0].id}`);
    
  } catch (err) {
    console.log('❌ Error saving headline:', err.message);
  }
}

async function cleanupTestData() {
  console.log('\n=== Cleaning Up Test Data ===');
  
  try {
    const { data, error } = await supabase
      .from('perplexity_news')
      .delete()
      .or('source.eq.Perplexity AI (Test),title.ilike.*test*,url.ilike.*example.com*')
      .select();
    
    if (error) {
      console.log('❌ Error cleaning up:', error.message);
      return;
    }
    
    console.log(`✅ Cleaned up ${data.length} test articles`);
    
  } catch (err) {
    console.log('❌ Error during cleanup:', err.message);
  }
}

async function triggerCronJobs() {
  console.log('\n=== Triggering Cron Jobs Manually ===');
  
  const baseUrl = process.env.VERCEL_URL || 'http://localhost:3000';
  
  try {
    console.log('🔄 Triggering headline fetcher...');
    const fetchResponse = await fetch(`${baseUrl}/api/cron/fetch-perplexity-news`, {
      method: 'GET',
      headers: {
        'User-Agent': 'vercel-cron/1.0' // Simulate Vercel cron
      }
    });
    
    if (fetchResponse.ok) {
      const result = await fetchResponse.json();
      console.log('✅ Headlines fetcher result:', result);
    } else {
      console.log('❌ Headlines fetcher failed:', fetchResponse.status);
    }
    
    // Wait a bit before triggering enricher
    console.log('⏳ Waiting 3 seconds before triggering enricher...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('🔄 Triggering content enricher...');
    const enrichResponse = await fetch(`${baseUrl}/api/cron/enrich-perplexity-news`, {
      method: 'GET',
      headers: {
        'User-Agent': 'vercel-cron/1.0'
      }
    });
    
    if (enrichResponse.ok) {
      const result = await enrichResponse.json();
      console.log('✅ Content enricher result:', result);
    } else {
      console.log('❌ Content enricher failed:', enrichResponse.status);
    }
    
  } catch (err) {
    console.log('❌ Error triggering cron jobs:', err.message);
    console.log('   Make sure the development server is running on localhost:3000');
  }
}

// Main execution
async function main() {
  const command = process.argv[2];
  
  console.log('🔍 Perplexity News Debug Utility');
  console.log('================================');
  
  switch (command) {
    case 'check':
      await checkPerplexityTable();
      await showPerplexityStats();
      break;
      
    case 'test-api':
      await testPerplexityAPI();
      break;
      
    case 'generate':
      await generateTestHeadline();
      break;
      
    case 'cleanup':
      await cleanupTestData();
      break;
      
    case 'cron':
      await triggerCronJobs();
      break;
      
    case 'full':
      await checkPerplexityTable();
      await testPerplexityAPI();
      await showPerplexityStats();
      break;
      
    default:
      console.log('\nUsage: node debug-perplexity.js <command>');
      console.log('\nCommands:');
      console.log('  check     - Check table and show statistics');
      console.log('  test-api  - Test Perplexity API connection');
      console.log('  generate  - Generate a test headline (add --save-test to save)');
      console.log('  cleanup   - Remove test data from database');
      console.log('  cron      - Manually trigger cron jobs');
      console.log('  full      - Run comprehensive check');
      console.log('\nExamples:');
      console.log('  node debug-perplexity.js check');
      console.log('  node debug-perplexity.js generate --save-test');
      console.log('  node debug-perplexity.js full');
      break;
  }
}

main().catch(console.error);