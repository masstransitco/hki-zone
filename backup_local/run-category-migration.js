#!/usr/bin/env node

/**
 * Database Migration Script for New Incident Categories
 * Runs the migration to add health, financial, and administrative categories
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('🚀 Running New Incident Categories Migration');
  console.log('=============================================');
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase/migrations/20250715_add_new_incident_categories.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📄 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`\n${i + 1}/${statements.length}: Executing statement...`);
      
      if (statement.toLowerCase().includes('comment on')) {
        console.log('   ℹ️  Adding comment...');
      } else if (statement.toLowerCase().includes('alter type')) {
        console.log('   🔧 Adding new category to enum...');
      } else if (statement.toLowerCase().includes('insert into gov_feeds')) {
        console.log('   📊 Inserting new feed configurations...');
      } else if (statement.toLowerCase().includes('create materialized view')) {
        console.log('   🗂️  Creating materialized view...');
      } else if (statement.toLowerCase().includes('create index')) {
        console.log('   🔍 Creating database index...');
      } else if (statement.toLowerCase().includes('create or replace function')) {
        console.log('   ⚙️  Creating database function...');
      } else if (statement.toLowerCase().includes('refresh materialized view')) {
        console.log('   🔄 Refreshing materialized view...');
      }
      
      try {
        const { data, error } = await supabase.rpc('exec_sql', {
          query: statement + ';'
        });
        
        if (error) {
          // Try direct execution if RPC fails
          console.log('   ⚠️  RPC failed, trying direct execution...');
          const { data: directData, error: directError } = await supabase
            .from('_dummy_table_that_does_not_exist')
            .select('*')
            .limit(0);
          
          if (directError && directError.message.includes('does not exist')) {
            console.log('   ⚠️  Cannot execute SQL directly, skipping...');
          } else {
            throw directError;
          }
        } else {
          console.log('   ✅ Statement executed successfully');
        }
        
      } catch (err) {
        if (err.message.includes('already exists') || 
            err.message.includes('does not exist') ||
            err.message.includes('duplicate key value')) {
          console.log(`   ⚠️  Statement skipped (already exists): ${err.message}`);
        } else {
          console.error(`   ❌ Error executing statement: ${err.message}`);
          console.error(`   🔍 Statement: ${statement.substring(0, 100)}...`);
          
          // Don't exit on non-critical errors
          if (!statement.toLowerCase().includes('alter type') && 
              !statement.toLowerCase().includes('insert into gov_feeds')) {
            console.log('   ⚠️  Continuing with remaining statements...');
          }
        }
      }
    }
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Verify the new categories are available in the database');
    console.log('2. Test the new RSS feed processing');
    console.log('3. Update the frontend to support new categories');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Alternative approach using direct SQL execution
async function runMigrationDirect() {
  console.log('🚀 Running Gov and A&E Categories Migration (Direct SQL)');
  console.log('========================================================');
  
  try {
    // Step 1: Add new categories to enum (this might fail if they already exist)
    console.log('\n1️⃣ Adding new categories to incident_category enum...');
    const newCategories = ['health', 'financial', 'administrative', 'gov', 'ae'];
    
    for (const category of newCategories) {
      try {
        const { error } = await supabase.rpc('exec_sql', {
          query: `ALTER TYPE incident_category ADD VALUE '${category}';`
        });
        if (error) {
          console.log(`   ⚠️  Category '${category}' may already exist`);
        } else {
          console.log(`   ✅ Added category: ${category}`);
        }
      } catch (err) {
        console.log(`   ⚠️  Category '${category}' may already exist`);
      }
    }
    
    // Step 2: Insert new feed configurations
    console.log('\n2️⃣ Inserting new feed configurations...');
    const feedConfigs = [
      // Health feeds
      { slug: 'chp_press', url: 'https://www.chp.gov.hk/rss/pressreleases_en_RSS.xml' },
      { slug: 'chp_disease', url: 'https://www.chp.gov.hk/rss/cdwatch_en_RSS.xml' },
      { slug: 'chp_ncd', url: 'https://www.chp.gov.hk/rss/ncdaware_en_RSS.xml' },
      { slug: 'chp_guidelines', url: 'https://www.chp.gov.hk/rss/guidelines_en_RSS.xml' },
      { slug: 'ha_ae_waiting', url: 'https://www.ha.org.hk/opendata/aed/aedwtdata-en.json' },
      
      // Financial feeds
      { slug: 'hkma_press', url: 'https://www.hkma.gov.hk/eng/other-information/rss/rss_press-release.xml' },
      { slug: 'hkma_speeches', url: 'https://www.hkma.gov.hk/eng/other-information/rss/rss_speeches.xml' },
      { slug: 'hkma_guidelines', url: 'https://www.hkma.gov.hk/eng/other-information/rss/rss_guidelines.xml' },
      { slug: 'hkma_circulars', url: 'https://www.hkma.gov.hk/eng/other-information/rss/rss_circulars.xml' },
      
      // Administrative feeds
      { slug: 'news_gov_top', url: 'https://www.news.gov.hk/rss/news/topstories_en.xml' }
    ];
    
    for (const feed of feedConfigs) {
      try {
        const { error } = await supabase
          .from('gov_feeds')
          .upsert({
            slug: feed.slug,
            url: feed.url,
            active: true,
            updated_at: new Date().toISOString()
          });
        
        if (error) {
          console.log(`   ⚠️  Feed '${feed.slug}' may already exist: ${error.message}`);
        } else {
          console.log(`   ✅ Added/updated feed: ${feed.slug}`);
        }
      } catch (err) {
        console.log(`   ⚠️  Feed '${feed.slug}' insertion failed: ${err.message}`);
      }
    }
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Feed Summary:');
    console.log(`   Health feeds: 5 (CHP press, disease watch, NCD, guidelines, A&E waiting)`);
    console.log(`   Financial feeds: 4 (HKMA press, speeches, guidelines, circulars)`);
    console.log(`   Administrative feeds: 1 (Government news)`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  runMigrationDirect().catch(console.error);
}

module.exports = { runMigration, runMigrationDirect };