require('dotenv').config({ path: '.env.local' });

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

async function testPerplexityAPI() {
  console.log('🔍 Testing Perplexity API Configuration\n');

  // Check API key
  if (!PERPLEXITY_API_KEY) {
    console.log('❌ PERPLEXITY_API_KEY is not set in .env.local');
    return;
  }

  console.log('✅ PERPLEXITY_API_KEY is configured');
  console.log(`   Key starts with: ${PERPLEXITY_API_KEY.substring(0, 10)}...`);

  // Test API call
  try {
    console.log('\n📡 Testing API connection...');
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant.'
          },
          {
            role: 'user',
            content: 'Say "API is working" if you can read this.'
          }
        ],
        temperature: 0.3,
        max_tokens: 50
      })
    });

    console.log(`   Response status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ API is working!');
      console.log(`   Model: ${data.model}`);
      console.log(`   Response: ${data.choices[0].message.content}`);
    } else {
      const errorText = await response.text();
      console.log('❌ API request failed');
      console.log(`   Error: ${errorText}`);
    }

  } catch (error) {
    console.log('❌ Failed to connect to Perplexity API');
    console.log(`   Error: ${error.message}`);
  }
}

testPerplexityAPI();