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

async function checkPendingContent() {
  console.log('🔍 Checking pending content body/lede...');
  
  try {
    // Check pending items from incidents_public view
    const { data: items, error } = await supabase
      .from('incidents_public')
      .select('id, title, body, enrichment_status, source_slug')
      .eq('enrichment_status', 'pending')
      .not('source_slug', 'like', 'ha_%')
      .order('source_updated_at', { ascending: false })
      .limit(5);
      
    if (error) {
      console.error('❌ Error getting incidents:', error);
      return;
    }
    
    console.log(`📊 Checking ${items.length} pending items:`);
    
    items.forEach((item, i) => {
      console.log(`\n${i+1}. ${item.source_slug} - ${item.id}`);
      console.log(`   Title: ${item.title.substring(0, 80)}...`);
      console.log(`   Body length: ${item.body ? item.body.length : 'NULL'}`);
      if (item.body) {
        console.log(`   Body preview: ${item.body.substring(0, 100)}...`);
      }
    });
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkPendingContent().catch(console.error);