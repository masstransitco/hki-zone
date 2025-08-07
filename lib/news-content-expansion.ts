/**
 * Step 1: Content Expansion Service
 * Transforms short article summaries into rich, detailed content segments
 * ensuring consistent content length across all languages
 */

import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

interface ArticleSummary {
  title: string
  summary: string
  category: string
  localRelevance?: string
}

interface ExpandedContent {
  title: string
  expandedContent: string
  category: string
  wordCount: number
  characterCount: number
}

interface ExpansionResult {
  success: boolean
  expandedArticles: ExpandedContent[]
  totalWordCount: number
  totalCharacterCount: number
  cost: number
  error?: string
}

// Target length per expanded article segment
const TARGET_CHARS_PER_ARTICLE = 500 // Standardized across all languages
const MIN_CHARS_PER_ARTICLE = 400
const MAX_CHARS_PER_ARTICLE = 600

/**
 * Generate language-specific expansion prompts
 */
function getExpansionPrompt(language: string): { systemPrompt: string; userInstructions: string } {
  const baseSystemPrompt = `You are a professional news content expansion specialist. Your job is to take short article summaries and expand them into rich, detailed content suitable for broadcast news.

Your expanded content should:
- Provide context and background information
- Add relevant details and human interest angles
- Include local Hong Kong relevance where appropriate
- Maintain journalistic accuracy and objectivity
- Be suitable for audio broadcast (conversational tone)
- Target exactly ${TARGET_CHARS_PER_ARTICLE} characters per article`

  const languageSpecific = {
    'en': {
      systemPrompt: `${baseSystemPrompt}

Write in clear, conversational English suitable for Hong Kong listeners. Use broadcast-style language that sounds natural when read aloud.`,
      userInstructions: `Expand each article summary into approximately ${TARGET_CHARS_PER_ARTICLE} characters of rich content. Include:
- Background context and why this matters to Hong Kong listeners
- Specific details, numbers, and examples
- Human interest angles where relevant
- Clear, conversational language for broadcast`
    },
    'zh-TW': {
      systemPrompt: `${baseSystemPrompt}

用廣東話口語(口語粵語)寫作，適合香港聽眾。使用自然嘅廣播風格，聽起嚟親切自然。
重要字符：用「係」而唔係「是」，用「喺」而唔係「在」，用「冇」而唔係「沒有」，用「啲」而唔係「些」，用「嘅」而唔係「的」。`,
      userInstructions: `將每篇文章摘要擴展至大約${TARGET_CHARS_PER_ARTICLE}個字符嘅豐富內容。包括：
- 背景資料同對香港聽眾嘅重要性
- 具體細節、數字同例子
- 人情味角度（如果合適）
- 清晰嘅廣播用語`
    },
    'zh-CN': {
      systemPrompt: `${baseSystemPrompt}

用简洁明了的简体中文写作，适合广播播报。语言要自然流畅，听起来亲切专业。`,
      userInstructions: `将每篇文章摘要扩展至大约${TARGET_CHARS_PER_ARTICLE}个字符的丰富内容。包括：
- 背景信息以及对香港听众的重要意义
- 具体细节、数字和实例
- 人性化角度（如适用）
- 清晰的广播用语`
    }
  }

  return languageSpecific[language] || languageSpecific['en']
}

/**
 * Expand article summaries into rich content
 */
export async function expandArticleContent(
  articles: ArticleSummary[],
  language: string
): Promise<ExpansionResult> {
  try {
    console.log(`🔄 Step 1: Expanding ${articles.length} articles for ${language}`)
    
    const { systemPrompt, userInstructions } = getExpansionPrompt(language)
    
    const userPrompt = `${userInstructions}

ARTICLES TO EXPAND:
${JSON.stringify(articles, null, 2)}

REQUIREMENTS:
- Each expanded article should be ${TARGET_CHARS_PER_ARTICLE} characters (${MIN_CHARS_PER_ARTICLE}-${MAX_CHARS_PER_ARTICLE} range)
- Maintain the original category and title
- Add context, background, and local relevance
- Write in natural broadcast language
- Ensure each article has sufficient detail for a comprehensive news brief

FORMAT YOUR RESPONSE AS JSON:
{
  "expandedArticles": [
    {
      "title": "Original title",
      "category": "Original category", 
      "expandedContent": "Rich, detailed content approximately ${TARGET_CHARS_PER_ARTICLE} characters"
    }
  ]
}

IMPORTANT: Return only valid JSON with the expanded articles.`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 8000, // Enough for expanded content
      response_format: { type: "json_object" }
    })

    const responseContent = completion.choices[0].message.content || ''
    const parsedResponse = JSON.parse(responseContent)
    
    if (!parsedResponse.expandedArticles || !Array.isArray(parsedResponse.expandedArticles)) {
      throw new Error('Invalid response format from content expansion')
    }

    // Process and validate expanded articles
    const expandedArticles: ExpandedContent[] = parsedResponse.expandedArticles.map((article: any) => {
      const characterCount = article.expandedContent?.length || 0
      let wordCount: number
      
      // Calculate word count based on language
      if (language === 'zh-CN' || language === 'zh-TW') {
        const chineseChars = article.expandedContent?.match(/[\u4e00-\u9fa5]/g) || []
        wordCount = Math.ceil(chineseChars.length / 2.5)
      } else {
        wordCount = article.expandedContent?.split(/\s+/).filter(w => w.length > 0).length || 0
      }

      return {
        title: article.title || 'Untitled',
        expandedContent: article.expandedContent || '',
        category: article.category || 'News',
        wordCount,
        characterCount
      }
    })

    // Calculate totals
    const totalWordCount = expandedArticles.reduce((sum, article) => sum + article.wordCount, 0)
    const totalCharacterCount = expandedArticles.reduce((sum, article) => sum + article.characterCount, 0)

    // Estimate cost
    const inputTokens = (systemPrompt.length + userPrompt.length) / 4
    const outputTokens = responseContent.length / 4
    const cost = (inputTokens * 0.15 / 1000000) + (outputTokens * 0.60 / 1000000)

    // Validation
    const underLengthArticles = expandedArticles.filter(a => a.characterCount < MIN_CHARS_PER_ARTICLE)
    const overLengthArticles = expandedArticles.filter(a => a.characterCount > MAX_CHARS_PER_ARTICLE)
    
    if (underLengthArticles.length > 0) {
      console.warn(`⚠️ ${underLengthArticles.length} articles under minimum length (${MIN_CHARS_PER_ARTICLE} chars)`)
    }
    
    if (overLengthArticles.length > 0) {
      console.warn(`⚠️ ${overLengthArticles.length} articles over maximum length (${MAX_CHARS_PER_ARTICLE} chars)`)
    }

    console.log(`✅ Step 1 Complete: ${expandedArticles.length} articles expanded`)
    console.log(`📊 Total content: ${totalWordCount} words, ${totalCharacterCount} characters`)
    console.log(`💰 Expansion cost: $${cost.toFixed(6)}`)

    return {
      success: true,
      expandedArticles,
      totalWordCount,
      totalCharacterCount,
      cost
    }

  } catch (error) {
    console.error('❌ Content expansion failed:', error)
    return {
      success: false,
      expandedArticles: [],
      totalWordCount: 0,
      totalCharacterCount: 0,
      cost: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Validate expanded content quality
 */
export function validateExpandedContent(expandedArticles: ExpandedContent[]): {
  isValid: boolean
  issues: string[]
  metrics: {
    averageLength: number
    minLength: number
    maxLength: number
    totalArticles: number
    underMinimum: number
    overMaximum: number
  }
} {
  const issues: string[] = []
  
  if (expandedArticles.length === 0) {
    issues.push('No expanded articles found')
  }

  const lengths = expandedArticles.map(a => a.characterCount)
  const averageLength = lengths.reduce((sum, len) => sum + len, 0) / lengths.length
  const minLength = Math.min(...lengths)
  const maxLength = Math.max(...lengths)
  
  const underMinimum = expandedArticles.filter(a => a.characterCount < MIN_CHARS_PER_ARTICLE).length
  const overMaximum = expandedArticles.filter(a => a.characterCount > MAX_CHARS_PER_ARTICLE).length

  if (underMinimum > 0) {
    issues.push(`${underMinimum} articles under minimum length (${MIN_CHARS_PER_ARTICLE} chars)`)
  }
  
  if (overMaximum > 0) {
    issues.push(`${overMaximum} articles over maximum length (${MAX_CHARS_PER_ARTICLE} chars)`)
  }

  if (averageLength < TARGET_CHARS_PER_ARTICLE * 0.8) {
    issues.push(`Average length too short: ${averageLength.toFixed(0)} chars (target: ${TARGET_CHARS_PER_ARTICLE})`)
  }

  return {
    isValid: issues.length === 0,
    issues,
    metrics: {
      averageLength,
      minLength,
      maxLength,
      totalArticles: expandedArticles.length,
      underMinimum,
      overMaximum
    }
  }
}