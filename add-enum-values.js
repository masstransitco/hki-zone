#!/usr/bin/env node

/**
 * Add enum values to incident_category
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

async function addEnumValues() {
  console.log('Adding enum values to incident_category...');
  
  const enums = ['gov', 'ae'];
  
  for (const enumValue of enums) {
    try {
      // Try to insert a test record to see if enum value exists
      const { data, error } = await supabase
        .from('gov_feeds')
        .insert({
          slug: `test_${enumValue}`,
          url: `https://test.com/${enumValue}`,
          active: false
        });
      
      if (error) {
        console.log(`Enum value '${enumValue}' may not exist. Error: ${error.message}`);
        
        // Try to add the enum value using raw SQL
        const { error: sqlError } = await supabase.rpc('exec_sql', {
          query: `ALTER TYPE incident_category ADD VALUE '${enumValue}';`
        });
        
        if (sqlError) {
          console.log(`Failed to add enum value '${enumValue}': ${sqlError.message}`);
        } else {
          console.log(`✅ Added enum value: ${enumValue}`);
        }
      } else {
        console.log(`✅ Enum value '${enumValue}' already exists`);
        
        // Clean up test record
        await supabase.from('gov_feeds').delete().eq('slug', `test_${enumValue}`);
      }
    } catch (err) {
      console.log(`Error testing enum value '${enumValue}': ${err.message}`);
    }
  }
  
  console.log('Enum value addition completed.');
}

addEnumValues().catch(console.error);