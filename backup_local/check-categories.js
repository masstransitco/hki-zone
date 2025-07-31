#!/usr/bin/env node

/**
 * Check incident categories in database
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load environment variables manually
const envFile = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key] = value.replace(/"/g, '');
  }
});

const supabaseUrl = envVars.SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCategories() {
  console.log('Checking incident categories...');
  
  try {
    // Check if there are any incidents with 'ae' category
    const { data: aeIncidents, error: aeError } = await supabase
      .from('incidents')
      .select('id, title, category, source_slug')
      .eq('category', 'ae')
      .limit(5);
    
    if (aeError) {
      console.log('Error checking AE incidents:', aeError.message);
    } else {
      console.log(`Found ${aeIncidents.length} A&E incidents`);
      aeIncidents.forEach(incident => {
        console.log(`  - ${incident.title} (${incident.source_slug})`);
      });
    }
    
    // Check if there are any incidents with 'gov' category
    const { data: govIncidents, error: govError } = await supabase
      .from('incidents')
      .select('id, title, category, source_slug')
      .eq('category', 'gov')
      .limit(5);
    
    if (govError) {
      console.log('Error checking Gov incidents:', govError.message);
    } else {
      console.log(`Found ${govIncidents.length} Government incidents`);
      govIncidents.forEach(incident => {
        console.log(`  - ${incident.title} (${incident.source_slug})`);
      });
    }
    
    // Check all categories
    const { data: allIncidents, error: allError } = await supabase
      .from('incidents')
      .select('category')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (allError) {
      console.log('Error checking all incidents:', allError.message);
    } else {
      const categoryCount = {};
      allIncidents.forEach(incident => {
        categoryCount[incident.category] = (categoryCount[incident.category] || 0) + 1;
      });
      
      console.log('\nCategory distribution (last 100 incidents):');
      Object.entries(categoryCount).forEach(([category, count]) => {
        console.log(`  ${category}: ${count}`);
      });
    }
    
    // Check A&E waiting feed specifically
    const { data: aeWaitingIncidents, error: aeWaitingError } = await supabase
      .from('incidents')
      .select('id, title, category, source_slug, created_at')
      .eq('source_slug', 'ha_ae_waiting')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (aeWaitingError) {
      console.log('Error checking A&E waiting incidents:', aeWaitingError.message);
    } else {
      console.log(`\nFound ${aeWaitingIncidents.length} A&E waiting incidents:`);
      aeWaitingIncidents.forEach(incident => {
        console.log(`  - ${incident.title} (${incident.category}) - ${incident.created_at}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkCategories().catch(console.error);