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

async function checkGovernmentContent() {
  console.log('🔍 Checking government incidents...');
  
  try {
    // Check if incidents_public view exists and has data
    const { data: items, error: statusError } = await supabase
      .from('incidents_public')
      .select('enrichment_status, source_slug, title, source_updated_at')
      .not('source_slug', 'like', 'ha_%');
      
    if (statusError) {
      console.error('❌ Error getting incidents:', statusError);
      return;
    }
    
    console.log(`📊 Total government incidents: ${items.length}`);
    
    // Count by enrichment status
    const statusCounts = {};
    items.forEach(item => {
      statusCounts[item.enrichment_status] = (statusCounts[item.enrichment_status] || 0) + 1;
    });
    
    console.log('\n📈 Enrichment Status Distribution:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count} items`);
    });
    
    // Count by source
    const sourceCounts = {};
    items.forEach(item => {
      sourceCounts[item.source_slug] = (sourceCounts[item.source_slug] || 0) + 1;
    });
    
    console.log('\n📡 Items by Source:');
    Object.entries(sourceCounts).forEach(([source, count]) => {
      console.log(`  ${source}: ${count} items`);
    });
    
    // Show recent pending items
    const pendingItems = items
      .filter(item => item.enrichment_status === 'pending')
      .sort((a, b) => new Date(b.source_updated_at) - new Date(a.source_updated_at))
      .slice(0, 5);
    
    console.log('\n⏳ Recent 5 Pending Items:');
    if (pendingItems.length === 0) {
      console.log('  ❗ No pending items found!');
    } else {
      pendingItems.forEach((item, i) => {
        const date = new Date(item.source_updated_at).toLocaleString();
        console.log(`  ${i+1}. ${item.source_slug} | ${date}`);
        console.log(`     ${item.title.substring(0, 80)}...`);
      });
    }
    
    // Show recent all items
    const recentItems = items
      .sort((a, b) => new Date(b.source_updated_at) - new Date(a.source_updated_at))
      .slice(0, 10);
    
    console.log('\n📋 Recent 10 Government Items (all statuses):');
    recentItems.forEach((item, i) => {
      const date = new Date(item.source_updated_at).toLocaleString();
      console.log(`  ${i+1}. [${item.enrichment_status}] ${item.source_slug} | ${date}`);
      console.log(`     ${item.title.substring(0, 80)}...`);
    });
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkGovernmentContent().catch(console.error);