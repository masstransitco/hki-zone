#!/usr/bin/env node
/**
 * Check if enhanced perplexity fields exist in the database
 * Run this to verify if the migration is needed
 */

import { createClient } from '@supabase/supabase-js'

// Read environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL')
  console.error('   SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkEnhancedFields() {
  console.log('🔍 Checking if enhanced perplexity fields exist...')
  
  try {
    // Try to select all columns from perplexity_news
    const { data, error } = await supabase
      .from('perplexity_news')
      .select('*')
      .limit(1)
    
    if (error) {
      console.error('❌ Error accessing perplexity_news table:', error)
      return
    }
    
    if (!data || data.length === 0) {
      console.log('⚠️  No data found in perplexity_news table')
      return
    }
    
    const columns = Object.keys(data[0])
    const enhancedFields = ['enhanced_title', 'summary', 'key_points', 'why_it_matters', 'structured_sources']
    
    console.log('📊 Current table columns:', columns.sort())
    console.log('')
    
    const presentFields = enhancedFields.filter(field => columns.includes(field))
    const missingFields = enhancedFields.filter(field => !columns.includes(field))
    
    if (presentFields.length > 0) {
      console.log('✅ Enhanced fields present:', presentFields.join(', '))
    }
    
    if (missingFields.length > 0) {
      console.log('❌ Missing enhanced fields:', missingFields.join(', '))
      console.log('')
      console.log('🚨 ACTION REQUIRED:')
      console.log('   You need to run the database migration to add enhanced fields.')
      console.log('   Run one of these migration scripts:')
      console.log('   • scripts/add-enhanced-perplexity-fields.sql')
      console.log('   • scripts/quick-add-enhanced-fields.sql')
      console.log('')
      console.log('   Or copy and paste this into your Supabase SQL Editor:')
      console.log('   ---')
      console.log('   ALTER TABLE perplexity_news ADD COLUMN IF NOT EXISTS enhanced_title TEXT;')
      console.log('   ALTER TABLE perplexity_news ADD COLUMN IF NOT EXISTS summary TEXT;')
      console.log('   ALTER TABLE perplexity_news ADD COLUMN IF NOT EXISTS key_points TEXT[];')
      console.log('   ALTER TABLE perplexity_news ADD COLUMN IF NOT EXISTS why_it_matters TEXT;')
      console.log('   ALTER TABLE perplexity_news ADD COLUMN IF NOT EXISTS structured_sources JSONB;')
      console.log('   ---')
    } else {
      console.log('🎉 All enhanced fields are present! AI enhancement format is ready.')
    }
    
  } catch (error) {
    console.error('💥 Error checking enhanced fields:', error)
  }
}

checkEnhancedFields()