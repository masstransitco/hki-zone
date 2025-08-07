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
  }
  error?: string
}

// Target for dialogue-based broadcast script
const TARGET_WORD_COUNT = 2200
const TARGET_DURATION_MINUTES = 10
const TARGET_SEGMENTS = 12 // 10-12 dialogue segments
const TARGET_SEGMENT_DURATION = 30 // 30-35 seconds per segment

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
        { role: "user", content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: 16000,
      presence_penalty: 0.3,
      frequency_penalty: 0.3
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
      console.warn(`⚠️ Segment count: ${dialogueSegments.length} (target: ${TARGET_SEGMENTS})`)
    }

    if (!validation.meetsTargetLength) {
      console.warn(`⚠️ Script length: ${totalWordCount} words (target: ${TARGET_WORD_COUNT})`)
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
        correctSegmentCount: false
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
    'en': 'Write in conversational English suitable for Hong Kong broadcast',
    'zh-TW': '用廣東話口語(口語粵語)寫作。用「係」「喺」「冇」「啲」「嘅」等字符，加上語氣助詞「啦」「喎」「㗎」「囉」',
    'zh-CN': '用简洁明了的简体中文写作，适合广播播报'
  }

  return `You are creating a dialogue script for TWO ${roleDescriptions[briefType]} (one male, one female) for Hong Kong's premier audio news service.

Your ONLY job is to format rich article content into a polished ${TARGET_DURATION_MINUTES}-minute DIALOGUE-BASED broadcast script.

CRITICAL DIALOGUE REQUIREMENTS:
- Create exactly ${TARGET_SEGMENTS} dialogue segments
- Each segment MUST contain 150-200 words TOTAL (both speakers combined)
- Each segment = ${TARGET_SEGMENT_DURATION}-35 seconds when spoken
- Total script MUST be ${TARGET_WORD_COUNT} words (NOT ${TARGET_WORD_COUNT / 10} words!)
- Write for AUDIO, not reading - no markdown, no visual formatting
- Include current time: "${currentTime}" in opening segment
- Natural conversational flow between anchors
- Reference Hong Kong locations and context

DIALOGUE FORMAT (STRICTLY FOLLOW):
SEGMENT 1: DURATION TARGET 30-35 SEC
MALE: [75-100 words of content]
FEMALE: [75-100 words of content]
---

SEGMENT 2: DURATION TARGET 30-35 SEC
FEMALE: [75-100 words of content]
MALE: [75-100 words of content]
---

Continue this pattern for ALL ${TARGET_SEGMENTS} segments.

IMPORTANT: Each speaker turn should be substantial (75-100 words), not just short responses!

LANGUAGE: ${languageInstructions[language] || languageInstructions['en']}

Remember: The content is already rich and detailed. Your job is creating NATURAL DIALOGUE and PRESENTATION between two professional news anchors.`
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

  return `Create a comprehensive ${TARGET_DURATION_MINUTES}-minute DIALOGUE-BASED ${briefType} news broadcast between two anchors.

EXPANDED ARTICLES BY CATEGORY:
${orderedCategories.map(category => {
    const articles = groupedArticles[category] || []
    if (articles.length === 0) return ''
    
    return `\n=== ${category.toUpperCase()} ===\n${articles.map(article => 
      `Title: ${article.title}\nContent: ${article.expandedContent}\n`
    ).join('\n')}`
  }).filter(Boolean).join('\n')}

DIALOGUE SCRIPT STRUCTURE (${TARGET_SEGMENTS} segments, ${TARGET_SEGMENT_DURATION}-35 seconds each):

Segment 1 (Opening): 
   MALE: Start with "${greeting}" + overview
   FEMALE: Add context and preview key stories

Segments 2-4 (Top Stories):
   Alternate speakers covering main news
   Include natural conversation between anchors

Segments 5-7 (Finance & Business):
   MALE/FEMALE: Market updates with back-and-forth discussion

Segments 8-10 (Tech & International):
   Natural dialogue covering global stories with local impact

Segments 11-12 (Lifestyle & Closing):
   FEMALE/MALE: Lighter content + recap and sign-off

DIALOGUE REQUIREMENTS:
- Each segment MUST be 150-200 words TOTAL (both speakers combined)
- This means each speaker should have 75-100 words per turn
- Total script MUST reach ${TARGET_WORD_COUNT} words
- Natural conversational flow with substantial exchanges
- DO NOT make short responses like "Yes, that's right" (too short!)
- Include transitions: "Building on that point..." / "Another aspect to consider..."
- Reference specific Hong Kong locations and context

STRICT OUTPUT FORMAT:
SEGMENT 1: DURATION TARGET 30-35 SEC
MALE: [Write 75-100 words here - a full, substantial response about the topic]
FEMALE: [Write 75-100 words here - another substantial point that builds on or adds to the male anchor's point]
---

SEGMENT 2: DURATION TARGET 30-35 SEC
FEMALE: [Write 75-100 words here - introduce next topic with full context]
MALE: [Write 75-100 words here - expand on the topic with additional details]
---

[Continue for all ${TARGET_SEGMENTS} segments]

CRITICAL LENGTH REQUIREMENT: You MUST generate ${TARGET_SEGMENTS} segments × 150-200 words each = ${TARGET_WORD_COUNT} words total. Do NOT stop early!`
}

/**
 * Parse dialogue segments from generated script content
 */
function parseDialogueSegments(content: string, language: string): DialogueSegment[] {
  const segments: DialogueSegment[] = []
  
  // Split content by segment markers
  const segmentPattern = /SEGMENT\s+(\d+):[^\n]*\n([\s\S]*?)(?=SEGMENT\s+\d+:|$)/gi
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
} {
  const totalWordCount = segments.reduce((sum, segment) => sum + segment.wordCount, 0)
  
  return {
    hasTimeReferences: /\d{1,2}:\d{2}\s*(AM|PM|am|pm)/i.test(content),
    hasProgressMarkers: /halfway|quarter|minutes into|final minutes/i.test(content),
    hasQuestions: /\?/.test(content),
    hasTransitions: /turning to|moving on|let's shift|speaking of|now for/i.test(content),
    meetsTargetLength: totalWordCount >= TARGET_WORD_COUNT * 0.8 && totalWordCount <= TARGET_WORD_COUNT * 1.2,
    correctSegmentCount: segments.length >= 20 && segments.length <= 24 // 10-12 segments × 2 speakers each
  }
}