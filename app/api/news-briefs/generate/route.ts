import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const openaiApiKey = process.env.OPENAI_API_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables')
}

if (!openaiApiKey) {
  throw new Error('Missing OpenAI API key')
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)
const openai = new OpenAI({ apiKey: openaiApiKey })

interface NewsBrief {
  id: string
  title: string
  content: string
  language: string
  category: string
  estimated_duration_seconds: number
  articles_included: string[]
  created_at: string
}

// Target duration in seconds for each news brief
const TARGET_DURATION_SECONDS = 300 // 5 minutes
const WORDS_PER_MINUTE = 150 // Average speaking rate
const TARGET_WORD_COUNT = TARGET_DURATION_SECONDS / 60 * WORDS_PER_MINUTE // ~750 words

async function getRecentAIEnhancedArticles(language: string, hours: number = 24): Promise<any[]> {
  const since = new Date()
  since.setHours(since.getHours() - hours)

  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('is_ai_enhanced', true)
    .eq('language_variant', language)
    .eq('selected_for_tts_brief', false) // Only get articles not yet used for TTS
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(100) // Get more articles to have better selection

  if (error) {
    console.error('Error fetching articles:', error)
    throw error
  }

  return data || []
}

async function selectArticlesForBrief(articles: any[], briefType: 'morning' | 'afternoon' | 'evening'): Promise<any[]> {
  // Group articles by category
  const categorized = articles.reduce((acc, article) => {
    const category = article.category || 'General'
    if (!acc[category]) acc[category] = []
    acc[category].push(article)
    return acc
  }, {} as Record<string, any[]>)

  // Define category priorities for different times of day using new AI categories
  const categoryPriorities = {
    morning: ['Top Stories', 'Finance', 'Tech & Science', 'Sports', 'Arts & Culture', 'Entertainment'],
    afternoon: ['Finance', 'Tech & Science', 'Top Stories', 'Sports', 'Arts & Culture', 'Entertainment'],
    evening: ['Top Stories', 'Arts & Culture', 'Entertainment', 'Sports', 'Finance', 'Tech & Science']
  }

  const priorities = categoryPriorities[briefType]
  const selectedArticles: any[] = []
  let currentWordCount = 0

  // Select articles based on priority and word count
  for (const category of priorities) {
    const categoryArticles = categorized[category] || []
    
    for (const article of categoryArticles) {
      // Estimate word count from content length
      const estimatedWords = (article.content?.length || 0) / 5 // Rough estimate: 5 chars per word
      
      if (currentWordCount + estimatedWords <= TARGET_WORD_COUNT * 1.1) { // Allow 10% overflow
        selectedArticles.push(article)
        currentWordCount += estimatedWords
        
        // Stop if we're close to target
        if (currentWordCount >= TARGET_WORD_COUNT * 0.9) {
          break
        }
      }
    }
    
    if (currentWordCount >= TARGET_WORD_COUNT * 0.9) {
      break
    }
  }

  return selectedArticles
}

async function generateNewsBriefContent(articles: any[], briefType: string, language: string): Promise<{ content: string; cost: number; wordCount: number }> {
  const articleSummaries = articles.map(article => ({
    title: article.title,
    summary: article.summary || article.ai_summary,
    category: article.category,
    keyPoints: article.enhancement_metadata?.keyPoints || []
  }))

  const systemPrompt = `You are a professional news anchor creating a ${TARGET_DURATION_SECONDS / 60}-minute news brief for TTS (text-to-speech) broadcast. 
Your task is to create a natural, flowing news brief that sounds good when read aloud.

Guidelines:
- Write in a conversational, broadcast style suitable for ${language === 'en' ? 'English' : language === 'zh-TW' ? 'spoken Cantonese (口語粵語)' : 'Simplified Chinese'} listeners
${language === 'zh-TW' ? `- IMPORTANT: Use spoken Cantonese (口語粵語), NOT formal written Chinese (書面語)
- Use colloquial Cantonese expressions and sentence structures
- Character examples: "係" not "是", "喺" not "在", "冇" not "沒有", "佢" not "他/她", "啲" not "些", "嘅" not "的"
- Phrase examples: "點解" not "為什麼", "幾時" not "什麼時候", "邊度" not "哪裡", "乜嘢" not "什麼"
- Use Cantonese final particles: 啦, 喎, 㗎, 囉, 呀, 嘅, 咩, 架
- Keep the tone conversational like Hong Kong radio/TV news anchors (e.g., TVB, Commercial Radio)
- Use natural Cantonese speech patterns and vocabulary` : ''}
- Include smooth transitions between stories
- Target approximately ${TARGET_WORD_COUNT} words
- Start with a brief introduction mentioning the time of day (${briefType})
- End with a brief closing
- Make it engaging and informative
- Use appropriate language for TTS systems (avoid complex punctuation, use clear sentence structures)`

  const userPrompt = `Create a ${briefType} news brief from these articles:

${JSON.stringify(articleSummaries, null, 2)}

Remember to:
1. Start with a greeting appropriate for ${briefType} time${language === 'zh-TW' ? ' (e.g., "早晨，各位聽眾" for morning)' : ''}
2. Introduce the main stories briefly
3. Cover each story with key points
4. Use smooth transitions${language === 'zh-TW' ? ' (e.g., "講完呢單新聞，我哋睇下..." or "另外，今日仲有...")' : ''}
5. End with a brief closing${language === 'zh-TW' ? ' (e.g., "多謝收聽，我哋下次見")' : ''}
${language === 'zh-TW' ? '\nCRITICAL: Write the ENTIRE script in spoken Cantonese (口語粵語), not formal written Chinese!' : ''}

The output should be ready for TTS conversion.`

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 2000
    })

    const content = completion.choices[0].message.content || ''
    const wordCount = content.split(/\s+/).length
    
    // Estimate cost (gpt-4o-mini pricing: ~$0.15/1M input tokens, ~$0.60/1M output tokens)
    const inputTokens = systemPrompt.length + userPrompt.length / 4 // rough estimate
    const outputTokens = content.length / 4 // rough estimate
    const cost = (inputTokens * 0.15 / 1000000) + (outputTokens * 0.60 / 1000000)

    return { content, cost, wordCount }
  } catch (error) {
    console.error('Error generating news brief:', error)
    throw error
  }
}

function getBriefType(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 18) return 'afternoon'
  return 'evening'
}

export async function POST(request: NextRequest) {
  try {
    const { language = 'en', briefType = getBriefType() } = await request.json()

    console.log(`🎙️ Generating ${briefType} news brief in ${language}`)

    // 1. Fetch recent AI-enhanced articles that haven't been used in TTS briefs yet
    const articles = await getRecentAIEnhancedArticles(language)
    console.log(`📰 Found ${articles.length} AI-enhanced articles`)

    if (articles.length < 5) {
      return NextResponse.json({
        error: 'Not enough articles for news brief generation',
        availableArticles: articles.length
      }, { status: 400 })
    }

    // 2. Select articles for the brief
    const selectedArticles = await selectArticlesForBrief(articles, briefType)
    console.log(`✅ Selected ${selectedArticles.length} articles for brief`)

    // 3. Generate the news brief content with cost tracking
    const generationResult = await generateNewsBriefContent(selectedArticles, briefType, language)
    const estimatedDuration = Math.round(generationResult.wordCount / WORDS_PER_MINUTE * 60)

    // 4. Save the news brief to database
    const { data: savedBrief, error: saveError } = await supabase
      .from('news_briefs')
      .insert([{
        title: `${briefType.charAt(0).toUpperCase() + briefType.slice(1)} News Brief - ${new Date().toLocaleDateString()}`,
        content: generationResult.content,
        language: language,
        category: briefType,
        estimated_duration_seconds: estimatedDuration,
        actual_word_count: generationResult.wordCount,
        openai_model_used: 'gpt-4o-mini',
        generation_cost_usd: generationResult.cost
      }])
      .select()
      .single()

    if (saveError) {
      console.error('Error saving news brief:', saveError)
      throw saveError
    }

    // 5. Create junction table entries for articles included
    const junctionInserts = selectedArticles.map((article, index) => ({
      news_brief_id: savedBrief.id,
      article_id: article.id,
      inclusion_reason: `Selected for ${briefType} brief - ${article.category} category`,
      article_weight: 1.0 / selectedArticles.length // Equal weight for now
    }))

    const { error: junctionError } = await supabase
      .from('news_brief_articles')
      .insert(junctionInserts)

    if (junctionError) {
      console.error('Error saving junction records:', junctionError)
      // Don't fail the whole operation, but log the issue
    }

    // 6. Mark selected articles as used for TTS brief
    const articleUpdatePromises = selectedArticles.map(article => 
      supabase
        .from('articles')
        .update({
          selected_for_tts_brief: true,
          tts_selection_metadata: {
            selected_at: new Date().toISOString(),
            brief_id: savedBrief.id,
            brief_type: briefType,
            selection_reason: 'Selected for TTS news brief generation'
          }
        })
        .eq('id', article.id)
    )

    const updateResults = await Promise.allSettled(articleUpdatePromises)
    const failedUpdates = updateResults.filter(r => r.status === 'rejected')
    
    if (failedUpdates.length > 0) {
      console.warn(`Failed to update ${failedUpdates.length} articles with TTS selection status`)
    }

    return NextResponse.json({
      success: true,
      brief: savedBrief,
      stats: {
        articlesAnalyzed: articles.length,
        articlesSelected: selectedArticles.length,
        wordCount: generationResult.wordCount,
        estimatedDurationSeconds: estimatedDuration,
        estimatedDurationMinutes: (estimatedDuration / 60).toFixed(1),
        generationCost: generationResult.cost.toFixed(6),
        articlesMarkedForTTS: selectedArticles.length - failedUpdates.length
      }
    })

  } catch (error) {
    console.error('Error generating news brief:', error)
    return NextResponse.json({
      error: 'Failed to generate news brief',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET endpoint for testing/stats
export async function GET(request: NextRequest) {
  try {
    // Get stats on available articles
    const languages = ['en', 'zh-TW', 'zh-CN']
    const stats = await Promise.all(
      languages.map(async (lang) => {
        const articles = await getRecentAIEnhancedArticles(lang, 24)
        return {
          language: lang,
          articleCount: articles.length,
          categories: articles.reduce((acc, article) => {
            const cat = article.category || 'General'
            acc[cat] = (acc[cat] || 0) + 1
            return acc
          }, {} as Record<string, number>)
        }
      })
    )

    return NextResponse.json({
      configured: true,
      targetDurationMinutes: TARGET_DURATION_SECONDS / 60,
      targetWordCount: TARGET_WORD_COUNT,
      wordsPerMinute: WORDS_PER_MINUTE,
      availableArticles: stats,
      currentBriefType: getBriefType()
    })
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to get stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}