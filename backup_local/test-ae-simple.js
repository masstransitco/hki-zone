#!/usr/bin/env node

/**
 * Simple test for A&E feed processing
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

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL || envVars.SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function processAeFeed() {
  console.log('Processing A&E feed...');
  
  try {
    // Get the A&E feed
    const { data: feed, error: feedError } = await supabase
      .from('gov_feeds')
      .select('*')
      .eq('slug', 'ha_ae_waiting')
      .single();
    
    if (feedError) {
      console.log('Error getting feed:', feedError.message);
      return;
    }
    
    console.log('Feed found:', feed.slug);
    console.log('Feed URL:', feed.url);
    
    // Fetch the JSON data
    const response = await fetch(feed.url);
    if (!response.ok) {
      console.log('Failed to fetch data:', response.status);
      return;
    }
    
    const data = await response.json();
    console.log('Data structure:', Object.keys(data));
    console.log('Data sample:', JSON.stringify(data, null, 2).slice(0, 500));
    
    if (data.waitTime && Array.isArray(data.waitTime)) {
      console.log(`Found ${data.waitTime.length} hospitals`);
      
      // Process each hospital
      const incidents = data.waitTime.map((hospital, index) => {
        const waitTime = hospital.topWait || 'Unknown';
        const hospitalName = hospital.hospName || 'Unknown Hospital';
        const lastUpdated = data.updateTime || 'Unknown';
        
        const title = `A&E Waiting Time: ${hospitalName}`;
        const description = `Current waiting time: ${waitTime}. Last updated: ${lastUpdated}`;
        
        // No coordinates in this format
        const coordinates = [null, null];
        
        return {
          id: `ha_ae_waiting_${hospitalName.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}`,
          title: title,
          body: description,
          category: 'road',
          source_slug: 'ha_ae_waiting',
          severity: waitTime.includes('>') ? 7 : 3,
          source_updated_at: new Date().toISOString(),
          relevance_score: 5
        };
      });
      
      console.log(`Processed ${incidents.length} incidents`);
      console.log('Sample incident:', incidents[0]);
      
      // Try to insert one test incident
      const testIncident = incidents[0];
      const { data: insertData, error: insertError } = await supabase
        .from('incidents')
        .insert(testIncident)
        .select();
      
      if (insertError) {
        console.log('Insert error:', insertError.message);
      } else {
        console.log('✅ Test incident inserted successfully');
        console.log('Inserted data:', insertData);
        
        // Clean up
        await supabase.from('incidents').delete().eq('id', insertData[0].id);
        console.log('✅ Test incident cleaned up');
      }
      
    } else {
      console.log('Unexpected data structure');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

processAeFeed().catch(console.error);