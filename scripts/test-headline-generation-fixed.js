require('dotenv').config({ path: '.env.local' });

async function testHeadlineGeneration() {
  console.log('🧪 Testing Fixed Headline Generation\n');

  const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
  
  if (!PERPLEXITY_API_KEY) {
    console.error('❌ PERPLEXITY_API_KEY not found in .env.local');
    return;
  }

  try {
    // Test the API directly with improved prompt
    console.log('📡 Testing Perplexity API with improved prompt...\n');
    
    const body = {
      model: 'sonar-pro',
      temperature: 0.2,
      top_p: 0.9,
      frequency_penalty: 0.8,
      messages: [
        {
          role: 'system',
          content: 'You are a JSON API that returns Hong Kong news headlines. You must respond with ONLY a valid JSON array - no text before or after. Do not include any explanation, greeting, or commentary. Return raw JSON only.'
        },
        {
          role: 'user',
          content: `Generate 6 unique Hong Kong news headlines from today.

CRITICAL: Your response must start with [ and end with ]
No text before the opening bracket or after the closing bracket.

Categories (one headline each):
- politics
- business
- tech
- health
- lifestyle
- entertainment

Required JSON structure:
[{"category":"politics","title":"標題最多15字","url":"https://news.rthk.hk/rthk/ch/component/k2/123456-20250710.htm"},{"category":"business","title":"另一個標題","url":"https://hk01.com/article/123456"}]

Remember: Return ONLY the JSON array, nothing else.`
        }
      ]
    };

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      console.error('❌ API request failed:', response.status, response.statusText);
      return;
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    console.log('📥 Raw API Response:');
    console.log('---START---');
    console.log(content);
    console.log('---END---');
    console.log(`\nResponse length: ${content.length} characters`);
    
    // Test JSON parsing
    console.log('\n🔍 Testing JSON extraction...');
    
    try {
      // Direct parse attempt
      const headlines = JSON.parse(content.trim());
      console.log('✅ Direct JSON parse successful!');
      console.log(`Found ${headlines.length} headlines:`);
      headlines.forEach((h, i) => {
        console.log(`  ${i + 1}. [${h.category}] ${h.title}`);
      });
    } catch (e) {
      console.log('⚠️  Direct parse failed, trying extraction methods...');
      
      // Try extraction methods
      let extracted = null;
      
      // Method 1: Find array
      const arrayMatch = content.match(/\[[\s\S]*?\]/);
      if (arrayMatch) {
        try {
          extracted = JSON.parse(arrayMatch[0]);
          console.log('✅ Extracted JSON array successfully');
        } catch (e2) {
          console.log('❌ Failed to parse extracted array');
        }
      }
      
      if (extracted) {
        console.log(`Found ${extracted.length} headlines after extraction:`);
        extracted.forEach((h, i) => {
          console.log(`  ${i + 1}. [${h.category}] ${h.title}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testHeadlineGeneration();