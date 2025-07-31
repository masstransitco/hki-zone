#!/usr/bin/env node

/**
 * Test A&E feed processing
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

async function testAeFeed() {
  console.log('Testing A&E feed processing...');
  
  try {
    // First, add the A&E feed to gov_feeds table if not exists
    const { data: existingFeed, error: checkError } = await supabase
      .from('gov_feeds')
      .select('*')
      .eq('slug', 'ha_ae_waiting')
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') {
      console.log('Error checking existing feed:', checkError.message);
      return;
    }
    
    if (!existingFeed) {
      console.log('Adding A&E feed to gov_feeds table...');
      const { error: insertError } = await supabase
        .from('gov_feeds')
        .insert({
          slug: 'ha_ae_waiting',
          url: 'https://www.ha.org.hk/aedwt/data/aedWtData.json',
          active: true,
          type: 'json'
        });
      
      if (insertError) {
        console.log('Error inserting feed:', insertError.message);
        return;
      }
      console.log('✅ A&E feed added to gov_feeds');
    } else {
      console.log('✅ A&E feed already exists in gov_feeds');
    }
    
    // Test the JSON endpoint directly
    console.log('Testing A&E API endpoint...');
    const response = await fetch('https://www.ha.org.hk/aedwt/data/aedWtData.json');
    if (!response.ok) {
      console.log('Failed to fetch A&E data:', response.status, response.statusText);
      return;
    }
    
    const data = await response.json();
    console.log('✅ A&E API response received');
    console.log('Sample data:', JSON.stringify(data.waitTime?.[0] || data[0], null, 2));
    
    // Test processing with our government feeds processor
    const { GovernmentFeeds } = require('./lib/government-feeds');
    const processor = GovernmentFeeds.getInstance();
    
    console.log('Testing feed processing...');
    const results = await processor.processAllFeeds();
    console.log('Processing results:', results);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testAeFeed().catch(console.error);