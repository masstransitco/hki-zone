#!/usr/bin/env node

// Test Google Custom Search API directly
async function testGoogleSearch() {
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;
  
  console.log('🧪 Testing Google Custom Search API...');
  console.log('API Key:', GOOGLE_API_KEY ? `${GOOGLE_API_KEY.substring(0, 10)}...` : 'MISSING');
  console.log('CSE ID:', GOOGLE_CSE_ID || 'MISSING');
  
  if (!GOOGLE_API_KEY || !GOOGLE_CSE_ID) {
    console.error('❌ Missing Google API credentials');
    return;
  }
  
  try {
    const query = 'Hong Kong politics news';
    const searchUrl = new URL('https://customsearch.googleapis.com/customsearch/v1');
    searchUrl.searchParams.set('cx', GOOGLE_CSE_ID);
    searchUrl.searchParams.set('key', GOOGLE_API_KEY);
    searchUrl.searchParams.set('searchType', 'image');
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('rights', 'cc_publicdomain,cc_attribute,cc_sharealike');
    searchUrl.searchParams.set('num', '1');
    searchUrl.searchParams.set('safe', 'active');
    searchUrl.searchParams.set('imgSize', 'medium');
    searchUrl.searchParams.set('imgType', 'news');
    
    console.log('🔍 Search URL:', searchUrl.toString());
    
    const response = await fetch(searchUrl.toString());
    console.log('📡 Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      return;
    }
    
    const data = await response.json();
    console.log('📊 Response data:', JSON.stringify(data, null, 2));
    
    if (data.items && data.items.length > 0) {
      console.log('✅ Found images:', data.items.length);
      console.log('🖼️ First image:', data.items[0].link);
    } else {
      console.log('⚠️ No images found');
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

testGoogleSearch().catch(console.error);