/**
 * Step 2: Broadcast Script Generation
 * Transforms standardized expanded content into time-specific broadcast scripts
 * Focused solely on formatting and audio-first presentation
 */

import OpenAI from 'openai'
import { generateGreeting } from './news-brief-prompts'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

interface ExpandedContent {
  title: string
  expandedContent: string
  category: string
  wordCount: number
  characterCount: number
}

interface DialogueSegment {
  id: string
  speaker: 'male' | 'female'
  content: string
  estimatedDuration: number // in seconds
  wordCount: number
}

interface BroadcastScriptResult {
  success: boolean
  content: string // Full script for reference
  dialogueSegments: DialogueSegment[]
  totalWordCount: number
  totalEstimatedDuration: number
  cost: number
  validation: {
    hasTimeReferences: boolean
    hasProgressMarkers: boolean
    hasQuestions: boolean
    hasTransitions: boolean
    meetsTargetLength: boolean
    correctSegmentCount: boolean
    hasBrandMention: boolean
  }
  error?: string
}

// Target for dialogue-based broadcast script
const TARGET_WORD_COUNT = 1000 // Total word count for script
const TARGET_DURATION_MINUTES = 5 // Overall duration
const TARGET_SEGMENTS = 3 // 3-4 dialogue segments (6-8 speaker turns total, 3-4 per broadcaster)
const TARGET_SEGMENT_DURATION = 45 // 40-50 seconds per segment

/**
 * Generate simplified broadcast script from expanded content
 */
export async function generateBroadcastScript(
  expandedArticles: ExpandedContent[],
  briefType: 'morning' | 'afternoon' | 'evening',
  language: string
): Promise<BroadcastScriptResult> {
  try {
    console.log(`📻 Step 2: Generating ${briefType} broadcast script for ${language}`)
    console.log(`📰 Using ${expandedArticles.length} expanded articles`)

    // Get current Hong Kong time
    const now = new Date()
    const hkTime = now.toLocaleString('en-US', { 
      timeZone: 'Asia/Hong_Kong',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true 
    })

    // Generate greeting
    const greeting = generateGreeting(briefType, language)

    // Create system prompt for broadcast formatting
    const systemPrompt = getBroadcastSystemPrompt(briefType, language, hkTime)
    
    // Create user prompt with expanded content
    const userPrompt = getBroadcastUserPrompt(expandedArticles, briefType, language, greeting)

    console.log(`🤖 Generating broadcast script with GPT-4o-mini`)
    console.log(`📝 Input: ${expandedArticles.length} articles, ~${expandedArticles.reduce((sum, a) => sum + a.characterCount, 0)} chars`)

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
        { 
          role: "assistant", 
          content: `I understand. I will create exactly ${TARGET_SEGMENTS} dialogue segments using the precise format with SEGMENT headers, MALE/FEMALE speaker labels, and --- separators. Let me generate the broadcast script now:`
        },
        {
          role: "user",
          content: "Yes, please generate the script using the exact SEGMENT format shown in the instructions."
        }
      ],
      temperature: 0.3, // Lower temperature for more consistent formatting
      max_tokens: 16000,
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    })

    const content = completion.choices[0].message.content || ''
    
    // Parse dialogue segments from the generated content
    const dialogueSegments = parseDialogueSegments(content, language)
    
    // Calculate total metrics
    const totalWordCount = dialogueSegments.reduce((sum, segment) => sum + segment.wordCount, 0)
    const totalEstimatedDuration = dialogueSegments.reduce((sum, segment) => sum + segment.estimatedDuration, 0)

    // Validate content
    const validation = validateDialogueScript(content, dialogueSegments)

    // Calculate cost
    const inputTokens = (systemPrompt.length + userPrompt.length) / 4
    const outputTokens = content.length / 4
    const cost = (inputTokens * 0.15 / 1000000) + (outputTokens * 0.60 / 1000000)

    console.log(`✅ Step 2 Complete: ${dialogueSegments.length} segments, ${totalWordCount} words, ${Math.round(totalEstimatedDuration/60)} minutes`)
    console.log(`💰 Script generation cost: $${cost.toFixed(6)}`)

    if (!validation.correctSegmentCount) {
      console.warn(`⚠️ Segment count: ${dialogueSegments.length} speaker turns (target: 6-8 turns = 3-4 segments × 2 speakers)`)
    }

    if (!validation.meetsTargetLength) {
      console.warn(`⚠️ Script length: ${totalWordCount} words (target: ${TARGET_WORD_COUNT})`)
    }

    if (!validation.hasBrandMention) {
      console.warn(`⚠️ Missing brand mention (HKI/香港資訊)`)
    }

    return {
      success: true,
      content,
      dialogueSegments,
      totalWordCount,
      totalEstimatedDuration,
      cost,
      validation,
    }

  } catch (error) {
    console.error('❌ Broadcast script generation failed:', error)
    return {
      success: false,
      content: '',
      dialogueSegments: [],
      totalWordCount: 0,
      totalEstimatedDuration: 0,
      cost: 0,
      validation: {
        hasTimeReferences: false,
        hasProgressMarkers: false,
        hasQuestions: false,
        hasTransitions: false,
        meetsTargetLength: false,
        correctSegmentCount: false,
        hasBrandMention: false
      },
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Generate system prompt for dialogue-based broadcast script formatting
 */
function getBroadcastSystemPrompt(briefType: string, language: string, currentTime: string): string {
  const roleDescriptions = {
    morning: "warm, energetic morning news anchors helping listeners start their day",
    afternoon: "professional, focused afternoon news anchors for busy professionals", 
    evening: "thoughtful, engaging evening news anchors helping listeners unwind"
  }

  const languageInstructions = {
    'en': 'Write in PROFESSIONAL, AUTHORITATIVE English suitable for serious news broadcasting. Be CONCISE and FACTUAL. ALWAYS start with "from HKI" brand mention. Avoid casual language.',
    'zh-TW': '用專業、權威嘅口語廣東話新聞播報風格寫作。要簡潔、準確、客觀。必須用口語廣東話：「係」唔係「是」、「喺」唔係「在」、「冇」唔係「沒有」、「啲」唔係「這些/那些」、「嘅」唔係「的」、「佢哋」唔係「他們」。避免書面語同過多語氣助詞。必須開頭提及「香港資訊」品牌。唔好太輕鬆或幽默。',
    'zh-CN': '用专业、权威的简体中文新闻播报风格写作。要简洁、准确、客观。必须开头提及「香港资讯」品牌。避免过于轻松或幽默的表达。'
  }

  return `You are creating a dialogue script for TWO ${roleDescriptions[briefType]} (one male, one female) for Hong Kong's premier audio news service.

Your ONLY job is to format rich article content into a CONCISE ${TARGET_DURATION_MINUTES}-minute DIALOGUE-BASED broadcast script.

CRITICAL DIALOGUE REQUIREMENTS:
- Create exactly ${TARGET_SEGMENTS} dialogue segments (3-4 segments total = 6-8 speaker turns, 3-4 turns per broadcaster)
- WORD COUNT REQUIREMENTS:
  ${language === 'en' ? '• English: Each speaker MUST have 160-170 words per turn (320-340 words per segment total)' : 
    '• Chinese: Each speaker MUST have 80-85 words per turn (160-170 words per segment total)'}
- Total script MUST be approximately ${TARGET_WORD_COUNT} words
- Be PROFESSIONAL, AUTHORITATIVE, and FACTUAL
- NO casual language, humor, or promotional phrases
- Write for AUDIO, not reading - no markdown, no visual formatting
- Include brand mention "HKI" (English) or "香港資訊" (Chinese) at start
- Include current time: "${currentTime}" in opening segment
- CONCISE, DIRECT communication between anchors
- Reference Hong Kong locations and context when relevant

DIALOGUE FORMAT (STRICTLY FOLLOW - NO EXCEPTIONS):

You MUST output content in this EXACT format:

SEGMENT 1: WORD TARGET ${language === 'en' ? '320-340' : '160-170'} WORDS
MALE: [${language === 'en' ? '160-170' : '80-85'} words of professional content here]
FEMALE: [${language === 'en' ? '160-170' : '80-85'} words of professional content here]
---

SEGMENT 2: WORD TARGET ${language === 'en' ? '320-340' : '160-170'} WORDS
FEMALE: [${language === 'en' ? '160-170' : '80-85'} words of professional content here]
MALE: [${language === 'en' ? '160-170' : '80-85'} words of professional content here]
---

SEGMENT 3: WORD TARGET ${language === 'en' ? '320-340' : '160-170'} WORDS
MALE: [${language === 'en' ? '160-170' : '80-85'} words of professional content here]
FEMALE: [${language === 'en' ? '160-170' : '80-85'} words of professional content here]
---

CONTINUE this EXACT pattern for ALL ${TARGET_SEGMENTS} segments.

FORMATTING REQUIREMENTS:
- Each segment MUST start with "SEGMENT X: WORD TARGET [word count] WORDS"
- Each speaker MUST be labeled "MALE:" or "FEMALE:"
- Each segment MUST end with "---"
- DO NOT write as continuous paragraphs
- DO NOT omit segment headers
- DO NOT omit speaker labels
- BE PROFESSIONAL AND FACTUAL - NO casual phrases or promotional language

LANGUAGE: ${languageInstructions[language] || languageInstructions['en']}

${language === 'zh-TW' ? 'CRITICAL FOR TRADITIONAL CHINESE: Write in SPOKEN Cantonese, not written Chinese. Examples: Use 「呢啲新聞」not「這些新聞」, 「嗰啲政策」not「那些政策」, 「佢哋話」not「他們說」.' : ''}

EXAMPLE OUTPUT (Follow this EXACT professional structure):

${language === 'en' ? `SEGMENT 1: WORD TARGET 160-170 WORDS
MALE: Good morning from HKI. It's 8:00 AM in Hong Kong. Today's top stories include the Competition Commission's investigation into a forty-million-dollar tender rigging case in Kowloon City, where multiple consulting firms and contractors allegedly conspired to manipulate bidding processes. We also have updates on South Korea and the United States delaying joint military exercises to reduce tensions with North Korea, and Hong Kong's latest economic indicators showing mixed signals in the property and financial sectors. These developments have significant implications for Hong Kong's business environment and regional stability.
FEMALE: The Competition Commission's raid represents one of the most significant anti-trust actions this year. Officials executed search warrants at multiple locations, seizing documents and digital records related to suspected bid-rigging activities. The investigation focuses on systematic manipulation of public tender processes, with evidence suggesting coordinated efforts to eliminate competition and inflate project costs. This case highlights ongoing concerns about market fairness in Hong Kong's construction and consulting sectors. The commission has indicated that criminal prosecutions may follow if evidence substantiates the allegations.
---` : `SEGMENT 1: WORD TARGET 80-90 WORDS
MALE: 早晨，歡迎收聽香港資訊。而家係香港時間早上八點。今日頭條新聞包括競爭事務委員會對九龍城四千萬圍標案嘅調查行動。多間顧問公司同承辦商涉嫌操縱投標過程。另外，南韓同美國延遲聯合軍演以緩和朝鮮半島局勢。香港最新經濟數據顯示樓市同金融市場出現混合訊號。
FEMALE: 競委會今次突擊搜查係今年最大規模反壟斷行動之一。執法人員喺多個地點執行搜查令，檢走大量文件同電子記錄。調查重點係公開招標過程中嘅系統性操縱行為，涉嫌透過協調消除競爭同抬高工程成本。呢宗案件反映香港建築同顧問行業市場公平性嘅持續關注。
---`}

CRITICAL: Your output will be parsed by software that requires this EXACT format. Any deviation will cause the system to fail.`
}

/**
 * Generate user prompt with expanded content
 */
function getBroadcastUserPrompt(
  expandedArticles: ExpandedContent[],
  briefType: string,
  language: string,
  greeting: string
): string {
  // Group articles by category
  const groupedArticles = expandedArticles.reduce((groups, article) => {
    const category = article.category || 'News'
    if (!groups[category]) groups[category] = []
    groups[category].push(article)
    return groups
  }, {} as Record<string, ExpandedContent[]>)

  // Category priority by time of day
  const categoryPriority = {
    morning: ['Top Stories', 'Finance', 'Tech & Science', 'International', 'Entertainment', 'News'],
    afternoon: ['Finance', 'Top Stories', 'Tech & Science', 'International', 'Entertainment', 'News'],
    evening: ['Top Stories', 'Entertainment', 'Arts & Culture', 'International', 'Finance', 'Tech & Science', 'News']
  }

  const orderedCategories = categoryPriority[briefType] || categoryPriority.morning

  return `Create a PROFESSIONAL, AUTHORITATIVE ${TARGET_DURATION_MINUTES}-minute DIALOGUE-BASED ${briefType} news broadcast between two anchors.

EXPANDED ARTICLES BY CATEGORY:
${orderedCategories.map(category => {
    const articles = groupedArticles[category] || []
    if (articles.length === 0) return ''
    
    return `\n=== ${category.toUpperCase()} ===\n${articles.map(article => 
      `Title: ${article.title}\nContent: ${article.expandedContent}\n`
    ).join('\n')}`
  }).filter(Boolean).join('\n')}

DIALOGUE SCRIPT STRUCTURE (${TARGET_SEGMENTS} segments, ${TARGET_SEGMENT_DURATION}-45 seconds each):

Segment 1 (Opening): 
   MALE: Start with professional version of "${greeting}" + concise overview
   FEMALE: Direct headlines preview - NO casual phrases

Segment 2 (Major Stories):
   FEMALE: Cover key stories with facts only - NO promotional language
   MALE: International/economic stories - Direct, factual reporting

Segment 3 (Closing):
   MALE: Additional coverage and wrap-up - Concise, professional
   FEMALE: Brief closing - NO casual farewells

PROFESSIONAL DIALOGUE REQUIREMENTS:
${language === 'en' ? 
`- Each segment MUST be 320-340 words TOTAL (both speakers combined)
- Each speaker should have 160-170 words per turn` :
`- Each segment MUST be 160-170 words TOTAL (both speakers combined)
- Each speaker should have 80-85 words per turn`}
- Total script approximately ${TARGET_WORD_COUNT} words
- Be FACTUAL, DIRECT, and AUTHORITATIVE
- NO casual language: avoid "千祈唔好錯過", "大家", excessive 語氣助詞
- 必須用口語廣東話: 用「呢啲」唔係「這些」, 用「嗰啲」唔係「那些」, 用「佢哋」唔係「他們」
- NO humor, excitement, or promotional tone
- Focus ONLY on NEWS FACTS and their significance
- Use professional broadcast language throughout

STRICT OUTPUT FORMAT - FOLLOW EXACTLY:
SEGMENT 1: WORD TARGET ${language === 'en' ? '320-340' : '160-170'} WORDS
MALE: [${language === 'en' ? '160-170' : '80-85'} words - professional opening with brand mention]
FEMALE: [${language === 'en' ? '160-170' : '80-85'} words - direct headlines preview]
---

SEGMENT 2: WORD TARGET ${language === 'en' ? '320-340' : '160-170'} WORDS
FEMALE: [${language === 'en' ? '160-170' : '80-85'} words - major stories, facts only]
MALE: [${language === 'en' ? '160-170' : '80-85'} words - international/economic coverage]
---

SEGMENT 3: WORD TARGET ${language === 'en' ? '320-340' : '160-170'} WORDS
MALE: [${language === 'en' ? '160-170' : '80-85'} words - additional coverage and wrap-up]
FEMALE: [${language === 'en' ? '160-170' : '80-85'} words - brief professional closing]
---

[Continue this EXACT pattern for all 3 segments total]

CRITICAL FORMATTING RULES:
- MUST start each segment with "SEGMENT X: WORD TARGET [X] WORDS"
- MUST use "MALE:" and "FEMALE:" speaker labels
- MUST end each segment with "---"
- BE PROFESSIONAL, FACTUAL, AUTHORITATIVE
- NO casual language or promotional phrases
- Cover stories with precise, direct reporting.`
}

/**
 * Parse dialogue segments from generated script content
 */
function parseDialogueSegments(content: string, language: string): DialogueSegment[] {
  const segments: DialogueSegment[] = []
  
  // Split content by segment markers - now handling both DURATION and WORD TARGET formats
  const segmentPattern = /SEGMENT\s+(\d+):\s*(?:DURATION TARGET|WORD TARGET)[^\n]*\n([\s\S]*?)(?=SEGMENT\s+\d+:|$)/gi
  let match
  let segmentIndex = 0
  
  while ((match = segmentPattern.exec(content)) !== null) {
    segmentIndex++
    const segmentContent = match[2]
    
    // Parse individual speakers within each segment
    // Handle both "MALE:" and "FEMALE:" at the beginning of lines
    const speakerPattern = /^(MALE|FEMALE):\s*(.+?)(?=^(?:MALE|FEMALE):|$)/gim
    let speakerMatch
    
    while ((speakerMatch = speakerPattern.exec(segmentContent)) !== null) {
      const speaker = speakerMatch[1].toLowerCase() as 'male' | 'female'
      let content = speakerMatch[2].trim()
      
      // Clean up any residual MALE: or FEMALE: labels within content
      content = content.replace(/\s*(MALE|FEMALE):\s*/g, ' ').trim()
      
      // Skip empty content
      if (!content) continue
      
      const wordCount = calculateWordCount(content, language)
      const estimatedDuration = calculateDuration(wordCount, language)
      
      segments.push({
        id: `segment-${segmentIndex}-${speaker}`,
        speaker,
        content,
        estimatedDuration,
        wordCount
      })
    }
  }
  
  console.log(`🔍 Found ${segmentIndex} dialogue segments in generated content`)
  console.log(`📊 Parsed segments: ${segments.length} total (${segments.filter(s => s.speaker === 'male').length} male, ${segments.filter(s => s.speaker === 'female').length} female)`)
  
  // Fallback: If no segments found, try to create basic segments from content
  if (segments.length === 0) {
    console.warn(`⚠️ No segments found with standard parsing, attempting fallback parsing...`)
    
    // Try to split content into chunks and create artificial segments
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 50)
    let speaker: 'male' | 'female' = 'male'
    
    for (let i = 0; i < Math.min(paragraphs.length, TARGET_SEGMENTS * 2); i++) {
      const paragraph = paragraphs[i].trim()
      if (paragraph) {
        const wordCount = calculateWordCount(paragraph, language)
        const estimatedDuration = calculateDuration(wordCount, language)
        
        segments.push({
          id: `fallback-segment-${Math.floor(i/2) + 1}-${speaker}`,
          speaker,
          content: paragraph,
          estimatedDuration,
          wordCount
        })
        
        // Alternate speakers
        speaker = speaker === 'male' ? 'female' : 'male'
      }
    }
    
    console.log(`🔄 Fallback parsing created ${segments.length} segments`)
  }
  
  return segments
}

/**
 * Calculate word count based on language
 */
function calculateWordCount(content: string, language: string): number {
  if (language === 'zh-CN' || language === 'zh-TW') {
    const chineseChars = content.match(/[\u4e00-\u9fa5]/g) || []
    return Math.ceil(chineseChars.length / 2.5)
  } else {
    return content.split(/\s+/).filter(w => w.length > 0).length
  }
}

/**
 * Calculate estimated duration in seconds
 */
function calculateDuration(wordCount: number, language: string): number {
  const wordsPerMinute = (language === 'zh-CN' || language === 'zh-TW') ? 200 : 170
  return Math.round(wordCount / wordsPerMinute * 60)
}

/**
 * Validate dialogue script quality
 */
function validateDialogueScript(content: string, segments: DialogueSegment[]): {
  hasTimeReferences: boolean
  hasProgressMarkers: boolean
  hasQuestions: boolean
  hasTransitions: boolean
  meetsTargetLength: boolean
  correctSegmentCount: boolean
  hasBrandMention: boolean
} {
  const totalWordCount = segments.reduce((sum, segment) => sum + segment.wordCount, 0)
  
  return {
    hasTimeReferences: /\d{1,2}:\d{2}\s*(AM|PM|am|pm)/i.test(content),
    hasProgressMarkers: /halfway|quarter|minutes into|final minutes/i.test(content),
    hasQuestions: /\?/.test(content),
    hasTransitions: /turning to|moving on|let's shift|speaking of|now for/i.test(content),
    meetsTargetLength: totalWordCount >= TARGET_WORD_COUNT * 0.8 && totalWordCount <= TARGET_WORD_COUNT * 1.3,
    correctSegmentCount: segments.length >= 6 && segments.length <= 8, // 3-4 dialogue segments × 2 speakers each = 6-8 speaker turns
    hasBrandMention: /HKI|香港資訊|香港资讯/i.test(content)
  }
}