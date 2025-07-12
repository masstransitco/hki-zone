const { createClient } = require('@supabase/supabase-js')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function debugFullContent() {
  console.log('🔍 Getting full content for detailed parsing analysis...\n')

  try {
    // Get one car's full content to analyze
    const { data: cars, error } = await supabase
      .from('articles_unified')
      .select('id, title, content, contextual_data')
      .eq('category', 'cars')
      .limit(3)

    if (error) {
      console.error('❌ Error:', error)
      return
    }

    cars.forEach((car, index) => {
      console.log(`\n=== Car ${index + 1} Analysis ===`)
      console.log('Title:', car.title)
      console.log('Full Content:')
      console.log(car.content)
      console.log('\nContextual Data:')
      console.log(JSON.stringify(car.contextual_data, null, 2))
      
      // Test the parsing logic that's causing issues
      console.log('\n--- Testing Current Parsing Logic ---')
      
      const content = car.content || ''
      console.log('Original content:', content)
      
      // Check if content has placeholder issues
      if (content.includes('###')) {
        console.log('🚨 Content has ### placeholders!')
      }
      
      // Test the problematic parsing
      let tempContent = content
      
      // Find all instances of numbers with commas
      const numberWithCommasRegex = /(\d{1,3}(?:,\d{3})*)/g
      const numbersWithCommas = tempContent.match(numberWithCommasRegex) || []
      
      console.log('Numbers with commas found:', numbersWithCommas)
      
      // Replace each number with commas with a placeholder
      numbersWithCommas.forEach((num, index) => {
        const placeholder = `###NUMBER_${index}###`
        console.log(`Replacing "${num}" with "${placeholder}"`)
        tempContent = tempContent.replace(num, placeholder)
      })
      
      console.log('Content after placeholder replacement:', tempContent)
      
      // Split by comma
      const pairs = tempContent.split(',').map(pair => pair.trim())
      console.log('Pairs after splitting:', pairs)
      
      const specs = {}
      for (const pair of pairs) {
        const colonIndex = pair.indexOf(':')
        if (colonIndex === -1) continue
        
        const key = pair.substring(0, colonIndex).trim()
        let value = pair.substring(colonIndex + 1).trim()
        
        console.log(`Processing pair - Key: "${key}", Value before restore: "${value}"`)
        
        // Restore numbers with commas
        numbersWithCommas.forEach((num, index) => {
          const placeholder = `###NUMBER_${index}###`
          if (value.includes(placeholder)) {
            console.log(`Restoring "${placeholder}" back to "${num}" in value`)
            value = value.replace(placeholder, num)
          }
        })
        
        console.log(`Final - Key: "${key}", Value: "${value}"`)
        
        if (key && value) {
          const lowerKey = key.toLowerCase()
          if (lowerKey === 'model') specs.model = value
          else if (lowerKey === 'make') specs.make = value
          else if (lowerKey === 'price') specs.price = value
        }
      }
      
      console.log('\nFinal parsed specs:', specs)
      console.log('\n' + '='.repeat(50))
    })

  } catch (error) {
    console.error('💥 Error:', error)
  }
}

debugFullContent()