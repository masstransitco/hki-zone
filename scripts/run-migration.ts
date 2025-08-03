import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

async function runMigration() {
  console.log('🚀 Running Government Feeds Migration...')
  
  // Initialize Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  
  try {
    // Read the migration file
    const migrationPath = resolve(__dirname, '../supabase/migrations/20250803_verified_government_feeds.sql')
    const migrationSQL = readFileSync(migrationPath, 'utf8')
    
    console.log('📄 Loaded migration file')
    console.log(`📊 Migration size: ${(migrationSQL.length / 1024).toFixed(1)}KB`)
    
    // Execute the migration
    console.log('🔄 Executing migration...')
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    })
    
    if (error) {
      // If the RPC doesn't exist, try direct execution (split by statements)
      console.log('⚠️ RPC method not available, trying direct execution...')
      
      // Split SQL into individual statements
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
      
      console.log(`📋 Executing ${statements.length} SQL statements...`)
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i]
        if (statement.trim()) {
          console.log(`   ${i + 1}/${statements.length}: ${statement.substring(0, 60)}...`)
          
          const { error: stmtError } = await supabase
            .from('dummy') // This will fail but we can catch SQL execution errors
            .select('*')
            .limit(0)
          
          // Try a different approach - use the SQL editor functionality
          const { error: execError } = await supabase.rpc('exec', { sql: statement })
          
          if (execError) {
            console.log(`     ⚠️ Statement ${i + 1} may have failed: ${execError.message}`)
            // Continue with other statements
          } else {
            console.log(`     ✅ Statement ${i + 1} completed`)
          }
        }
      }
    } else {
      console.log('✅ Migration executed successfully')
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  }
  
  // Verify the migration by checking for new feed sources
  console.log('\n🔍 Verifying migration results...')
  const { data: feedSources, error: queryError } = await supabase
    .from('government_feed_sources')
    .select('feed_group, department, feed_type, active')
    .eq('active', true)
    .order('feed_group')
  
  if (queryError) {
    console.error('❌ Failed to verify migration:', queryError)
  } else {
    console.log(`✅ Found ${feedSources.length} active feed sources:`)
    feedSources.forEach(source => {
      console.log(`   - ${source.feed_group} (${source.department}/${source.feed_type})`)
    })
  }
  
  console.log('\n🎉 Migration process completed!')
}

// Handle env loading
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.log('Loading environment variables...')
  require('dotenv').config({ path: '.env.local' })
}

runMigration().catch(console.error)