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
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEnrichedContent() {
  console.log('🔍 Checking enriched content body/lede...');
  
  try {
    // Check enriched items from incidents_public view
    const { data: items, error } = await supabase
      .from('incidents_public')
      .select('id, title, body, enriched_content, enriched_summary, enrichment_status, source_slug')
      .eq('enrichment_status', 'enriched')
      .not('source_slug', 'like', 'ha_%')
      .order('source_updated_at', { ascending: false })
      .limit(3);
      
    if (error) {
      console.error('❌ Error getting incidents:', error);
      return;
    }
    
    console.log(`📊 Checking ${items.length} enriched items:`);
    
    items.forEach((item, i) => {
      console.log(`\n${i+1}. ${item.source_slug} - ${item.id}`);
      console.log(`   Title: ${item.title.substring(0, 80)}...`);
      console.log(`   Body length: ${item.body ? item.body.length : 'NULL'}`);
      console.log(`   Enriched content length: ${item.enriched_content ? item.enriched_content.length : 'NULL'}`);
      console.log(`   Enriched summary length: ${item.enriched_summary ? item.enriched_summary.length : 'NULL'}`);
      if (item.body) {
        console.log(`   Body preview: ${item.body.substring(0, 100)}...`);
      }
    });
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkEnrichedContent().catch(console.error);