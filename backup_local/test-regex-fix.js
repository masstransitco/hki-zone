// Test the regex fix for placeholder replacement

function testParsing(content) {
  console.log('\n=== Testing Content ===')
  console.log('Original:', content)
  
  let tempContent = content
  
  // OLD regex (problematic) - matches any number sequence
  const oldRegex = /(\d{1,3}(?:,\d{3})*)/g
  const oldMatches = content.match(oldRegex) || []
  console.log('OLD regex matches:', oldMatches)
  
  // NEW regex (fixed) - only matches numbers WITH commas
  const newRegex = /(\d{1,3}(?:,\d{3})+)/g
  const newMatches = content.match(newRegex) || []
  console.log('NEW regex matches:', newMatches)
  
  // Test the new parsing
  const numbersWithCommas = newMatches
  numbersWithCommas.forEach((num, index) => {
    const placeholder = `###NUMBER_${index}###`
    console.log(`Replacing "${num}" with "${placeholder}"`)
    tempContent = tempContent.replace(num, placeholder)
  })
  
  console.log('After replacement:', tempContent)
  
  // Test restoration
  const pairs = tempContent.split(',').map(pair => pair.trim())
  const specs = {}
  
  for (const pair of pairs) {
    const colonIndex = pair.indexOf(':')
    if (colonIndex === -1) continue
    
    let key = pair.substring(0, colonIndex).trim()
    let value = pair.substring(colonIndex + 1).trim()
    
    // Restore numbers
    numbersWithCommas.forEach((num, index) => {
      const placeholder = `###NUMBER_${index}###`
      key = key.replace(placeholder, num)
      value = value.replace(placeholder, num)
    })
    
    if (key && value) {
      const lowerKey = key.toLowerCase()
      if (lowerKey === 'model') specs.model = value
      else if (lowerKey === 'make') specs.make = value
      else if (lowerKey === 'price') specs.price = value
    }
  }
  
  console.log('Final specs:', specs)
}

// Test cases
testParsing('Make: 豐田 TOYOTA, Model: VELLFIRE 2.5 ZG ALPHARD, Price: HKD$198,000 減價 [原價$208,000]')
testParsing('Make: BMW, Model: X5 xDrive40i, Year: 2022, Price: HK$850,000, Engine: 3.0L Turbo')
testParsing('Make: Mercedes, Model: E-Class 2.0, Price: HK$1,200,000')