#!/usr/bin/env node

/**
 * Check enum values in database
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

async function checkEnumValues() {
  console.log('Checking enum values...');
  
  try {
    // Check enum values using SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      query: "SELECT unnest(enum_range(NULL::incident_category)) as category;"
    });
    
    if (error) {
      console.log('Error checking enum values:', error.message);
      
      // Try alternative query
      const { data: alt, error: altError } = await supabase.rpc('exec_sql', {
        query: "SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'incident_category');"
      });
      
      if (altError) {
        console.log('Alternative query also failed:', altError.message);
      } else {
        console.log('Available enum values:', alt);
      }
    } else {
      console.log('Available enum values:', data);
    }
    
    // Try to insert a test incident with 'ae' category
    const { data: testData, error: testError } = await supabase
      .from('incidents')
      .insert({
        title: 'Test A&E incident',
        body: 'Test body',
        category: 'ae',
        source_slug: 'test_ae',
        source_updated_at: new Date().toISOString(),
        severity: 1,
        relevance_score: 1
      })
      .select();
    
    if (testError) {
      console.log('Test insertion failed:', testError.message);
    } else {
      console.log('Test insertion succeeded:', testData);
      
      // Clean up test data
      await supabase.from('incidents').delete().eq('source_slug', 'test_ae');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkEnumValues().catch(console.error);