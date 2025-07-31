require('dotenv').config({ path: '.env.cli' });

async function testPerplexityCitations() {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  
  console.log('Testing Perplexity API citations...\n');
  console.log('API Key loaded:', apiKey ? 'Yes' : 'No');
  
  const requestBody = {
    model: 'sonar',
    messages: [
      {
        role: 'user',
        content: 'What are the latest developments in Hong Kong property market in July 2025? Please include sources.'
      }
    ],
    max_tokens: 1000,
    search_recency_filter: 'day',
    search_domain_filter: ['scmp.com', 'hk01.com', 'rthk.hk', 'news.gov.hk']
  };
  
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ API Response received\n');
      
      const content = data.choices[0]?.message?.content || '';
      console.log('Content length:', content.length);
      console.log('\nFirst 500 chars:');
      console.log(content.substring(0, 500));
      
      // Check for citations
      console.log('\n📚 Citation Analysis:');
      console.log('Contains [1] style citations:', content.includes('[1]') ? 'Yes' : 'No');
      console.log('Contains URLs:', content.includes('http') ? 'Yes' : 'No');
      
      // Check for citations in response
      if (data.citations) {
        console.log('\nCitations in response object:', data.citations);
      }
      
      // Full response structure
      console.log('\n🔍 Full response structure:');
      console.log(JSON.stringify(data, null, 2));
      
    } else {
      console.error('❌ API Error:', data);
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

testPerplexityCitations();