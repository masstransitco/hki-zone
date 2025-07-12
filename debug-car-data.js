const { createClient } = require('@supabase/supabase-js')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing')
  console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'Set' : 'Missing')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function debugCarData() {
  console.log('🔍 Examining car data in Supabase...\n')

  try {
    // Check articles_unified table
    console.log('📊 Checking articles_unified table...')
    const { data: unifiedCars, error: unifiedError } = await supabase
      .from('articles_unified')
      .select('id, title, content, contextual_data')
      .eq('category', 'cars')
      .limit(5)

    if (unifiedError) {
      console.error('❌ Error fetching unified cars:', unifiedError)
    } else {
      console.log(`✅ Found ${unifiedCars.length} cars in articles_unified`)
      
      unifiedCars.forEach((car, index) => {
        console.log(`\n--- Car ${index + 1} (Unified) ---`)
        console.log('ID:', car.id)
        console.log('Title:', car.title)
        console.log('Content sample:', car.content ? car.content.substring(0, 200) + '...' : 'No content')
        console.log('Contextual data specs:', car.contextual_data?.specs || 'No specs')
        
        // Check for placeholder artifacts
        if (car.content && car.content.includes('###')) {
          console.log('🚨 PLACEHOLDER ARTIFACTS FOUND in content!')
          console.log('Full content:', car.content)
        }
        
        if (car.contextual_data?.specs && JSON.stringify(car.contextual_data.specs).includes('###')) {
          console.log('🚨 PLACEHOLDER ARTIFACTS FOUND in specs!')
          console.log('Specs:', car.contextual_data.specs)
        }
      })
    }

    // Check articles table (old)
    console.log('\n📊 Checking articles table (old)...')
    const { data: oldCars, error: oldError } = await supabase
      .from('articles')
      .select('id, title, content')
      .eq('category', 'cars')
      .limit(5)

    if (oldError) {
      console.error('❌ Error fetching old cars:', oldError)
    } else {
      console.log(`✅ Found ${oldCars.length} cars in articles table`)
      
      oldCars.forEach((car, index) => {
        console.log(`\n--- Car ${index + 1} (Old) ---`)
        console.log('ID:', car.id)
        console.log('Title:', car.title)
        console.log('Content sample:', car.content ? car.content.substring(0, 200) + '...' : 'No content')
        
        // Check for placeholder artifacts
        if (car.content && car.content.includes('###')) {
          console.log('🚨 PLACEHOLDER ARTIFACTS FOUND in content!')
          console.log('Full content:', car.content)
        }
      })
    }

    // Get total counts
    const { count: unifiedCount } = await supabase
      .from('articles_unified')
      .select('*', { count: 'exact', head: true })
      .eq('category', 'cars')

    const { count: oldCount } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('category', 'cars')

    console.log('\n📊 Summary:')
    console.log(`Unified table: ${unifiedCount || 0} cars`)
    console.log(`Old table: ${oldCount || 0} cars`)
    console.log(`Total: ${(unifiedCount || 0) + (oldCount || 0)} cars`)

  } catch (error) {
    console.error('💥 Unexpected error:', error)
  }
}

debugCarData()