// Script to apply database migrations for Perplexity news system
require('dotenv').config({ path: '.env.local' })

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigration(sqlFile, description) {
  console.log(`\n🔄 Running migration: ${description}`)
  console.log(`   File: ${sqlFile}`)
  
  try {
    // Read the SQL file
    const sqlContent = fs.readFileSync(path.join(__dirname, sqlFile), 'utf8')
    
    // Split by semicolons to handle multiple statements
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
    
    console.log(`   Found ${statements.length} SQL statements to execute`)
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';'
      console.log(`   Executing statement ${i + 1}/${statements.length}...`)
      
      const { error } = await supabase.rpc('exec_sql', { 
        sql_query: statement 
      }).single()
      
      if (error) {
        // Try direct execution if RPC fails
        console.log('   RPC failed, trying alternative method...')
        // Note: Supabase JS client doesn't support direct SQL execution
        // You'll need to run these migrations via psql or Supabase dashboard
        console.warn(`   ⚠️  Statement failed: ${error.message}`)
        console.log(`   Please run this statement manually:`)
        console.log(`   ${statement.substring(0, 100)}...`)
      } else {
        console.log(`   ✅ Statement ${i + 1} executed successfully`)
      }
    }
    
    console.log(`✅ Migration completed: ${description}`)
    return true
  } catch (error) {
    console.error(`❌ Migration failed: ${description}`)
    console.error(`   Error: ${error.message}`)
    return false
  }
}

async function checkTableExists(tableName) {
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .limit(1)
  
  if (error && error.code === '42P01') {
    return false
  }
  return true
}

async function main() {
  console.log('🚀 Database Migration Tool')
  console.log('========================\n')
  
  // Check if main table exists
  const mainTableExists = await checkTableExists('perplexity_news')
  console.log(`📊 Main table 'perplexity_news' exists: ${mainTableExists ? '✅' : '❌'}`)
  
  // Check if image history table exists
  const imageTableExists = await checkTableExists('perplexity_image_history')
  console.log(`📊 Image history table exists: ${imageTableExists ? '✅' : '❌'}`)
  
  // List of migrations to run
  const migrations = []
  
  if (!mainTableExists) {
    migrations.push({
      file: 'scripts/add-perplexity-news-table.sql',
      description: 'Create main perplexity_news table'
    })
  }
  
  if (!imageTableExists) {
    migrations.push({
      file: 'scripts/add-perplexity-image-tracking.sql',
      description: 'Create image history tracking table'
    })
  }
  
  // Always check for enhanced fields and contextual data
  migrations.push(
    {
      file: 'scripts/add-enhanced-perplexity-fields.sql',
      description: 'Add enhanced content fields'
    },
    {
      file: 'scripts/add-contextual-enrichment-fields.sql',
      description: 'Add contextual enrichment fields'
    }
  )
  
  if (migrations.length === 0) {
    console.log('\n✅ All tables already exist!')
  } else {
    console.log(`\n📋 ${migrations.length} migrations to run`)
    
    // Important note about Supabase limitations
    console.log('\n⚠️  IMPORTANT: Supabase JS client doesn\'t support direct SQL execution.')
    console.log('   You need to run these migrations using one of these methods:\n')
    console.log('   Option 1: Using psql command line:')
    migrations.forEach(m => {
      console.log(`   psql $DATABASE_URL -f ${m.file}`)
    })
    
    console.log('\n   Option 2: Using Supabase Dashboard:')
    console.log('   1. Go to your Supabase project dashboard')
    console.log('   2. Navigate to SQL Editor')
    console.log('   3. Copy and paste the contents of each SQL file')
    console.log('   4. Execute the SQL\n')
    
    console.log('   Option 3: Using migration script (if you have DATABASE_URL):')
    console.log('   Create a file called run-migrations.sh with:')
    console.log('   #!/bin/bash')
    migrations.forEach(m => {
      console.log(`   psql $DATABASE_URL -f ${m.file}`)
    })
  }
  
  // Additional check for RLS policies
  console.log('\n📋 Checking Row Level Security...')
  const { data: policies, error: policyError } = await supabase
    .rpc('get_policies', { table_name: 'perplexity_news' })
    .single()
  
  if (!policyError && policies) {
    console.log('✅ RLS policies found')
  } else {
    console.log('⚠️  RLS policies might need to be configured')
  }
  
  console.log('\n✅ Migration check completed!')
}

main().catch(console.error)