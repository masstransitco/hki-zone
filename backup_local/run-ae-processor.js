#!/usr/bin/env node

/**
 * Run the government feeds processor for A&E feeds
 */

const { createClient } = require('@supabase/supabase-js');
const Parser = require('rss-parser');
const crypto = require('crypto');
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

async function processAeFeeds() {
  console.log('Processing A&E feeds...');
  
  try {
    // Get the A&E feed
    const { data: feeds, error: feedError } = await supabase
      .from('gov_feeds')
      .select('*')
      .eq('slug', 'ha_ae_waiting')
      .eq('active', true);
    
    if (feedError) {
      console.log('Error getting feeds:', feedError.message);
      return;
    }
    
    console.log(`Found ${feeds.length} A&E feeds`);
    
    for (const feed of feeds) {
      console.log(`Processing feed: ${feed.slug}`);
      
      // Fetch the JSON data
      const response = await fetch(feed.url);
      if (!response.ok) {
        console.log(`Failed to fetch ${feed.slug}: ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      
      if (data.waitTime && Array.isArray(data.waitTime)) {
        console.log(`Processing ${data.waitTime.length} hospitals`);
        
        // Process each hospital
        const incidents = data.waitTime.map((hospital) => {
          const waitTime = hospital.topWait || 'Unknown';
          const hospitalName = hospital.hospName || 'Unknown Hospital';
          const lastUpdated = data.updateTime || 'Unknown';
          
          const title = `A&E Waiting Time: ${hospitalName}`;
          const description = `Current waiting time: ${waitTime}. Last updated: ${lastUpdated}`;
          
          // Generate ID
          const contentHash = crypto.createHash('sha256')
            .update(`${feed.slug}:${title}:${description}`)
            .digest('hex')
            .slice(0, 12);
          
          const incidentId = `${feed.slug}_${contentHash}`;
          
          return {
            id: incidentId,
            source_slug: feed.slug,
            title: title,
            body: description,
            category: 'road',
            severity: waitTime.includes('Over') ? 7 : 3,
            source_updated_at: new Date().toISOString(),
            relevance_score: 5
          };
        });
        
        // Insert incidents
        for (const incident of incidents) {
          try {
            const { data: existingIncident, error: checkError } = await supabase
              .from('incidents')
              .select('id')
              .eq('id', incident.id)
              .single();
            
            if (checkError && checkError.code === 'PGRST116') {
              // Incident doesn't exist, insert it
              const { error: insertError } = await supabase
                .from('incidents')
                .insert(incident);
              
              if (insertError) {
                console.log(`Error inserting ${incident.title}: ${insertError.message}`);
              } else {
                console.log(`✅ Inserted: ${incident.title}`);
              }
            } else {
              console.log(`⚠️  Skipped duplicate: ${incident.title}`);
            }
          } catch (error) {
            console.log(`Error processing ${incident.title}:`, error.message);
          }
        }
      } else {
        console.log(`Unexpected data structure for ${feed.slug}`);
      }
    }
    
    console.log('A&E feed processing completed');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

processAeFeeds().catch(console.error);