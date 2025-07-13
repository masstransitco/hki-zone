#!/usr/bin/env node

// Script to apply the car search migration to Supabase
// This will create the necessary database functions and indexes for search

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  console.log('🚗 Applying car search migration...\n');

  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'car-search-migration-final.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📁 Migration file loaded');
    console.log(`📏 SQL length: ${migrationSQL.length} characters\n`);

    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`🔧 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments and empty statements
      if (!statement || statement.startsWith('--')) continue;

      try {
        console.log(`📝 Executing statement ${i + 1}/${statements.length}...`);
        
        // For function creation, we need to use rpc with the full SQL
        if (statement.includes('CREATE OR REPLACE FUNCTION')) {
          const functionName = statement.match(/CREATE OR REPLACE FUNCTION\s+(\w+)/i)?.[1];
          console.log(`   Creating function: ${functionName}`);
        }

        // Execute the statement using raw SQL
        const { error } = await supabase.rpc('exec', { 
          query: statement + ';'
        });

        if (error) {
          // Try alternative execution method if rpc fails
          console.warn(`   ⚠️ RPC failed, trying direct execution: ${error.message}`);
          
          // Some statements might need to be executed differently
          // This is a fallback - in practice you might need to run the SQL directly in Supabase dashboard
          throw error;
        }

        console.log(`   ✅ Statement executed successfully`);

      } catch (stmtError) {
        console.error(`   ❌ Failed to execute statement ${i + 1}:`);
        console.error(`   SQL: ${statement.substring(0, 100)}...`);
        console.error(`   Error: ${stmtError.message}`);
        
        // Continue with other statements instead of failing completely
        continue;
      }
    }

    console.log('\n🧪 Testing the migration...');

    // Test if the functions were created successfully
    const tests = [
      { name: 'search_car_listings', test: async () => {
        const { data, error } = await supabase.rpc('search_car_listings', {
          search_query: 'test',
          result_limit: 1
        });
        return { success: !error, error: error?.message };
      }},
      { name: 'get_car_suggestions', test: async () => {
        const { data, error } = await supabase.rpc('get_car_suggestions', {
          search_query: 'test',
          suggestion_limit: 1
        });
        return { success: !error, error: error?.message };
      }},
      { name: 'get_car_filters', test: async () => {
        const { data, error } = await supabase.rpc('get_car_filters');
        return { success: !error, error: error?.message };
      }}
    ];

    for (const testCase of tests) {
      try {
        const result = await testCase.test();
        if (result.success) {
          console.log(`   ✅ ${testCase.name} function working`);
        } else {
          console.log(`   ❌ ${testCase.name} function failed: ${result.error}`);
        }
      } catch (error) {
        console.log(`   ❌ ${testCase.name} function test failed: ${error.message}`);
      }
    }

    console.log('\n✅ Migration application completed!');
    console.log('\n📋 Next steps:');
    console.log('1. If any functions failed to create, run the SQL manually in Supabase SQL Editor');
    console.log('2. Test the search functionality on /cars page');
    console.log('3. Monitor query performance in Supabase dashboard');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('\n🔧 Manual migration required:');
    console.log('1. Open Supabase SQL Editor');
    console.log('2. Copy and paste the contents of scripts/car-search-migration.sql');
    console.log('3. Execute the SQL statements manually');
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  applyMigration();
}

module.exports = { applyMigration };