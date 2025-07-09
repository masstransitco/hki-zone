#!/usr/bin/env node
/**
 * Migration script to add enhanced perplexity fields to the database
 * Run this script to add the missing enhanced_title, summary, key_points, why_it_matters, and structured_sources fields
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Read environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL')
  console.error('   SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigration() {
  console.log('🚀 Starting enhanced perplexity fields migration...')
  
  try {
    // Read the SQL migration file
    const sqlFile = join(__dirname, 'add-enhanced-perplexity-fields.sql')
    const sqlContent = readFileSync(sqlFile, 'utf8')
    
    console.log('📄 SQL Migration Content:')
    console.log(sqlContent)
    console.log('\n' + '='.repeat(50) + '\n')
    
    // Execute the SQL migration
    console.log('⚡ Executing migration...')
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlContent })
    
    if (error) {
      console.error('❌ Migration failed:', error)
      process.exit(1)
    }
    
    console.log('✅ Migration completed successfully!')
    console.log('📊 Result:', data)
    
    // Test the new fields by checking the table structure
    console.log('\n🔍 Verifying table structure...')
    const { data: tableInfo, error: tableError } = await supabase
      .from('perplexity_news')
      .select('*')
      .limit(1)
    
    if (tableError) {
      console.error('❌ Failed to verify table structure:', tableError)
    } else {
      console.log('✅ Table structure verified successfully!')
      if (tableInfo && tableInfo.length > 0) {
        const columns = Object.keys(tableInfo[0])
        const enhancedFields = ['enhanced_title', 'summary', 'key_points', 'why_it_matters', 'structured_sources']
        const missingFields = enhancedFields.filter(field => !columns.includes(field))
        
        if (missingFields.length === 0) {
          console.log('✅ All enhanced fields are now available:', enhancedFields.join(', '))
        } else {
          console.log('⚠️  Missing fields:', missingFields.join(', '))
        }
      }
    }
    
  } catch (error) {
    console.error('💥 Migration error:', error)
    process.exit(1)
  }
}

// Alternative method using direct SQL execution
async function runMigrationDirect() {
  console.log('🚀 Starting enhanced perplexity fields migration (direct SQL)...')
  
  try {
    const migrations = [
      {
        name: 'Add enhanced_title column',
        sql: `ALTER TABLE perplexity_news ADD COLUMN IF NOT EXISTS enhanced_title TEXT;`
      },
      {
        name: 'Add summary column', 
        sql: `ALTER TABLE perplexity_news ADD COLUMN IF NOT EXISTS summary TEXT;`
      },
      {
        name: 'Add key_points column',
        sql: `ALTER TABLE perplexity_news ADD COLUMN IF NOT EXISTS key_points TEXT[];`
      },
      {
        name: 'Add why_it_matters column',
        sql: `ALTER TABLE perplexity_news ADD COLUMN IF NOT EXISTS why_it_matters TEXT;`
      },
      {
        name: 'Add structured_sources column',
        sql: `ALTER TABLE perplexity_news ADD COLUMN IF NOT EXISTS structured_sources JSONB;`
      }
    ]
    
    for (const migration of migrations) {
      console.log(`⚡ Running: ${migration.name}`)
      const { error } = await supabase.rpc('exec_sql', { sql: migration.sql })
      
      if (error) {
        console.error(`❌ Failed: ${migration.name}`, error)
        // Continue with other migrations
      } else {
        console.log(`✅ Success: ${migration.name}`)
      }
    }
    
    console.log('✅ Migration completed!')
    
  } catch (error) {
    console.error('💥 Migration error:', error)
    process.exit(1)
  }
}

// Run the migration
if (process.argv.includes('--direct')) {
  runMigrationDirect()
} else {
  runMigration()
}