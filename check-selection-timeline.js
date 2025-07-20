const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://egyuetfeubznhcvmtary.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVneXVldGZldWJ6bmhjdm10YXJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTM3NTAwNSwiZXhwIjoyMDY2OTUxMDA1fQ.euSeh4C7FDt3vLWkBm1nt9wjxo8ZH25hQqAGNyW1gaA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSelectionTimeline() {
  console.log('🕐 Checking Article Selection Timeline\n');
  
  // 1. Get articles that were marked as selected with the problematic sessions
  const { data: selectedArticles, error } = await supabase
    .from('articles')
    .select('*')
    .eq('selected_for_enhancement', true)
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('📋 Recently Selected Articles:');
  selectedArticles.forEach(article => {
    console.log(`\n🔹 "${article.title}"`);
    console.log(`   ID: ${article.id}`);
    console.log(`   Source: ${article.source}`);
    console.log(`   Created: ${article.created_at}`);
    console.log(`   Content Length: ${article.content?.length || 0}`);
    console.log(`   Content Preview: ${article.content?.substring(0, 100) || 'EMPTY'}...`);
    
    if (article.selection_metadata) {
      console.log(`   Selection Reason: ${article.selection_metadata.selection_reason?.substring(0, 150)}...`);
      console.log(`   Selection Session: ${article.selection_metadata.selection_session}`);
      console.log(`   Perplexity ID: ${article.selection_metadata.perplexity_selection_id}`);
    }
  });
  
  // 2. Search for any "bad bank" articles in the entire database
  console.log('\n\n🏦 Searching entire database for "bad bank" articles:');
  
  const { data: bankArticles, error: bankError } = await supabase
    .from('articles')
    .select('id, title, source, created_at, content_length')
    .or('title.ilike.%bad bank%,title.ilike.%壞賬銀行%,title.ilike.%不良貸款%,title.ilike.%彭博%銀行%')
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (bankArticles && bankArticles.length > 0) {
    console.log(`Found ${bankArticles.length} banking articles:`);
    bankArticles.forEach((article, i) => {
      console.log(`   ${i + 1}. "${article.title}" (${article.source}, created: ${article.created_at})`);
    });
  } else {
    console.log('No banking articles found in database');
  }
  
  // 3. Check what articles were available at the time of selection
  console.log('\n\n📅 Articles available during selection (created before selection time):');
  
  // For the microbiota article selected at 2025-07-20T06:02:10.668Z
  const selectionTime = new Date('2025-07-20T06:02:10.668Z');
  const oneHourBefore = new Date(selectionTime.getTime() - 60 * 60 * 1000);
  
  const { data: availableAtTime, error: timeError } = await supabase
    .from('articles')
    .select('id, title, source, created_at, content_length')
    .gte('created_at', oneHourBefore.toISOString())
    .lte('created_at', selectionTime.toISOString())
    .eq('is_ai_enhanced', false)
    .order('created_at', { ascending: false })
    .limit(20);
    
  if (availableAtTime) {
    console.log(`Found ${availableAtTime.length} articles created in the hour before selection:`);
    availableAtTime.forEach((article, i) => {
      console.log(`   ${i + 1}. "${article.title.substring(0, 60)}..." (${article.source}, ${article.content_length} chars)`);
    });
  }
  
  // 4. Test Perplexity API directly
  console.log('\n\n🧪 Testing Perplexity API with a minimal example:');
  
  const testPrompt = `You are selecting news articles. Select article number 2 from this list:

ARTICLE_NUMBER: 1
Title: Test Article One
Content: This is test content one

ARTICLE_NUMBER: 2  
Title: Hong Kong Microbiota Innovation Centre Develops AI Technology
Content: The centre has developed breakthrough technology for treating gut infections

ARTICLE_NUMBER: 3
Title: Test Article Three
Content: This is test content three

Return ONLY JSON: [{"id": "2", "reason": "Your reason", "score": 85}]`;

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer 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`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: 'You are an expert Hong Kong news editor. Return ONLY valid JSON.'
          },
          {
            role: 'user',
            content: testPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.choices[0].message.content;
      console.log('Perplexity Response:', content);
      
      try {
        const parsed = JSON.parse(content);
        console.log('Parsed selection:', parsed);
      } catch (e) {
        console.log('Failed to parse as JSON');
      }
    } else {
      console.log('API Error:', response.status, response.statusText);
    }
  } catch (error) {
    console.log('Error calling Perplexity:', error.message);
  }
}

checkSelectionTimeline().catch(console.error);