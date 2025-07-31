import { supabaseAdmin } from "./supabase-server"

// Improved headline generation that prevents repetition
export async function generateUniqueHeadlines(retryCount = 3) {
  console.log('🚀 Starting unique headline generation...');
  
  // Get recent headlines to avoid duplication
  const { data: recentArticles } = await supabaseAdmin
    .from('articles_unified')
    .select('title, url')
    .eq('article_type', 'ai_generated')
    .order('created_at', { ascending: false })
    .limit(100);
    
  const recentTitles = new Set(recentArticles?.map(a => a.title) || []);
  const recentUrls = new Set(recentArticles?.map(a => a.url) || []);
  
  console.log(`📊 Found ${recentTitles.size} recent unique titles to avoid`);
  
  // Categories to generate headlines for
  const categories = [
    "politics",
    "business", 
    "tech",
    "health",
    "lifestyle",
    "entertainment"
  ];
  
  const currentDate = new Date().toISOString().split('T')[0];
  const prompt = `Generate EXACTLY 6 unique Hong Kong news headlines for today (${currentDate}).

REQUIREMENTS:
1. One headline per category: ${categories.join(', ')}
2. Each headline must be COMPLETELY DIFFERENT from these recent headlines:
${Array.from(recentTitles).slice(0, 20).map(t => `- ${t}`).join('\n')}

3. Headlines must be:
   - Current and newsworthy for Hong Kong
   - Specific with real details (names, numbers, locations)
   - Different topics from the recent headlines above
   - In Traditional Chinese
   - Maximum 15 characters

4. Generate realistic news URLs using actual Hong Kong news domains:
   - rthk.hk, news.gov.hk, hk01.com, mingpao.com, scmp.com, thestandard.com.hk

Return ONLY a JSON array with this exact format:
[
  {
    "category": "politics",
    "title": "立法會通過新環保法案",
    "url": "https://news.rthk.hk/rthk/ch/component/k2/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.htm"
  }
]`;

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: 'You are a Hong Kong news editor. Generate unique, current news headlines that are different from any provided examples.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.8, // Higher temperature for more variety
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // More robust JSON extraction
    let jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in response');
    }
    
    const headlines = JSON.parse(jsonMatch[0]);
    
    // Filter out any duplicates
    const uniqueHeadlines = headlines.filter(h => 
      !recentTitles.has(h.title) && 
      !recentUrls.has(h.url)
    );
    
    if (uniqueHeadlines.length === 0 && retryCount > 0) {
      console.log(`⚠️ All headlines were duplicates, retrying... (${retryCount} attempts left)`);
      return generateUniqueHeadlines(retryCount - 1);
    }
    
    // Transform to database format
    const dbHeadlines = uniqueHeadlines.map(h => ({
      title: h.title,
      url: h.url,
      source: 'Perplexity AI',
      category: h.category,
      article_type: 'ai_generated',
      status: 'published',
      processing_status: 'pending',
      published_at: new Date().toISOString(),
      content: '',
      features: {
        has_image: false,
        has_ai_content: true,
        has_translation: false
      }
    }));
    
    console.log(`✅ Generated ${dbHeadlines.length} unique headlines`);
    return dbHeadlines;
    
  } catch (error) {
    console.error('❌ Failed to generate headlines:', error);
    
    // Instead of fallback, return empty array
    return [];
  }
}

// Save headlines with deduplication
export async function saveUniqueHeadlines(headlines) {
  if (headlines.length === 0) {
    console.log('⚠️ No headlines to save');
    return { saved: 0 };
  }
  
  // Check for existing URLs to prevent duplicates
  const urls = headlines.map(h => h.url);
  const { data: existing } = await supabaseAdmin
    .from('articles_unified')
    .select('url')
    .in('url', urls);
    
  const existingUrls = new Set(existing?.map(e => e.url) || []);
  const newHeadlines = headlines.filter(h => !existingUrls.has(h.url));
  
  if (newHeadlines.length === 0) {
    console.log('⚠️ All headlines already exist');
    return { saved: 0 };
  }
  
  // Insert new headlines
  const { data, error } = await supabaseAdmin
    .from('articles_unified')
    .insert(newHeadlines)
    .select();
    
  if (error) {
    console.error('❌ Error saving headlines:', error);
    return { saved: 0, error };
  }
  
  console.log(`✅ Saved ${data.length} new headlines`);
  return { saved: data.length };
}