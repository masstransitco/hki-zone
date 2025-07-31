#!/usr/bin/env node

/**
 * Fix enum values by connecting directly to database
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

async function fixEnumValues() {
  console.log('Attempting to fix enum values...');
  
  try {
    // Create a SQL function that can modify enum types
    const createFunctionSql = `
      CREATE OR REPLACE FUNCTION add_enum_value(enum_name text, new_value text)
      RETURNS void AS $$
      BEGIN
        EXECUTE format('ALTER TYPE %I ADD VALUE %L', enum_name, new_value);
      EXCEPTION
        WHEN duplicate_object THEN
          RAISE NOTICE 'Enum value % already exists', new_value;
      END;
      $$ LANGUAGE plpgsql;
    `;
    
    const { error: funcError } = await supabase.rpc('exec_sql', {
      query: createFunctionSql
    });
    
    if (funcError) {
      console.log('Function creation failed:', funcError.message);
      
      // Try alternative approach - direct enum alteration
      const { error: ae_error } = await supabase.rpc('exec_sql', {
        query: "ALTER TYPE incident_category ADD VALUE 'ae';"
      });
      
      if (ae_error && !ae_error.message.includes('already exists')) {
        console.log('Failed to add ae enum:', ae_error.message);
      } else {
        console.log('✅ ae enum value added (or already exists)');
      }
      
      const { error: gov_error } = await supabase.rpc('exec_sql', {
        query: "ALTER TYPE incident_category ADD VALUE 'gov';"
      });
      
      if (gov_error && !gov_error.message.includes('already exists')) {
        console.log('Failed to add gov enum:', gov_error.message);
      } else {
        console.log('✅ gov enum value added (or already exists)');
      }
      
    } else {
      console.log('Function created successfully');
      
      // Use the function to add enum values
      const { error: aeError } = await supabase.rpc('add_enum_value', {
        enum_name: 'incident_category',
        new_value: 'ae'
      });
      
      const { error: govError } = await supabase.rpc('add_enum_value', {
        enum_name: 'incident_category', 
        new_value: 'gov'
      });
      
      if (aeError) console.log('AE enum error:', aeError.message);
      if (govError) console.log('Gov enum error:', govError.message);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

fixEnumValues().catch(console.error);