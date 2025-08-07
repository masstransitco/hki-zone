/**
 * Time-specific prompt templates for generating engaging audio news briefs
 */

interface BriefPromptConfig {
  systemPrompt: string
  userPromptTemplate: string
  tone: string
  focus: string[]
  specialInstructions: string[]
}

// Target 2000-2400 words for 10-12 minute audio at 150-180 WPM
const TARGET_WORD_COUNT = 2200
const TARGET_DURATION_MINUTES = 10

/**
 * Get current time in Hong Kong
 */
function getHongKongTime(): { time: string; hour: number; period: string } {
  const now = new Date()
  const hkTime = now.toLocaleString('en-US', { 
    timeZone: 'Asia/Hong_Kong',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true 
  })
  
  // Get Hong Kong hour for period calculation
  const hkHour = parseInt(now.toLocaleString('en-US', { 
    timeZone: 'Asia/Hong_Kong',
    hour: 'numeric',
    hour12: false
  }))
  
  const period = hkHour < 12 ? 'morning' : hkHour < 18 ? 'afternoon' : 'evening'
  
  return { time: hkTime, hour: hkHour, period }
}

/**
 * Audio-first transition templates
 */
export const SECTION_TRANSITIONS = {
  toFinance: [
    "Now, let's shift our focus to the financial markets and see what's moving money today...",
    "Turning to business and finance, here's what's impacting your investments...",
    "Speaking of economic impacts, let's check in on the financial sector...",
    "And that brings us to our finance update for today..."
  ],
  toTech: [
    "In the world of technology and innovation...",
    "Now for some exciting developments in tech and science...",
    "Switching gears to technology, we have some fascinating updates...",
    "Let's explore what's new in the tech world today..."
  ],
  toInternational: [
    "Looking beyond Hong Kong to international developments...",
    "On the global stage today...",
    "Turning our attention to world news...",
    "Let's broaden our perspective with international stories..."
  ],
  toEntertainment: [
    "Time to lighten things up with entertainment and culture...",
    "In the world of arts and entertainment...",
    "For our cultural update today...",
    "Let's end on a lighter note with entertainment news..."
  ],
  general: [
    "Moving on to our next story...",
    "In other news today...",
    "Here's something else you should know about...",
    "Another important development to share with you..."
  ]
}

/**
 * Time-aware greeting generators
 */
export function generateGreeting(briefType: 'morning' | 'afternoon' | 'evening', language: string): string {
  const { time } = getHongKongTime()
  
  const greetings = {
    morning: {
      en: `Good morning! It's ${time} here in Hong Kong, and you're listening to your comprehensive morning news brief. Whether you're having breakfast, commuting to work, or starting your day, we've got you covered with everything you need to know.`,
      'zh-TW': `早晨！而家係香港時間${time}，歡迎收聽今朝嘅新聞簡報。無論你而家食緊早餐、搭緊車返工，定係啱啱起身，我哋都為你準備咗最重要嘅新聞。`,
      'zh-CN': `早上好！现在是香港时间${time}，欢迎收听今天的早间新闻简报。无论您正在享用早餐、通勤上班，还是刚刚起床，我们都为您准备了今天最重要的新闻。`
    },
    afternoon: {
      en: `Good afternoon! It's ${time} in Hong Kong. Time for your mid-day news update. Let's catch up on what's been happening since this morning and what you need to know for the rest of your day.`,
      'zh-TW': `午安！而家係香港時間${time}。係時候聽下午間新聞更新喇。我哋一齊睇下今朝以嚟發生咗啲咩事，同埋下晝你需要知道嘅重要資訊。`,
      'zh-CN': `下午好！现在是香港时间${time}。是时候收听午间新闻更新了。让我们一起回顾上午以来发生的大事，以及您下午需要了解的重要信息。`
    },
    evening: {
      en: `Good evening! It's ${time} in Hong Kong. As you wind down from your day, let's take a comprehensive look at today's most important stories and prepare you for tomorrow.`,
      'zh-TW': `晚安！而家係香港時間${time}。喺你結束忙碌嘅一日之際，我哋一齊回顧今日最重要嘅新聞，並為聽日做好準備。`,
      'zh-CN': `晚上好！现在是香港时间${time}。在您结束忙碌的一天之际，让我们全面回顾今天最重要的新闻，并为明天做好准备。`
    }
  }
  
  return greetings[briefType][language] || greetings[briefType]['en']
}

/**
 * Progress markers for different points in the brief
 */
export function getProgressMarker(currentMinute: number, totalMinutes: number, language: string): string {
  const markers = {
    en: {
      quarter: "We're about a quarter of the way through our brief now...",
      half: "We're halfway through today's news update...",
      threeQuarter: "As we move into the final few minutes of today's brief..."
    },
    'zh-TW': {
      quarter: "我哋而家講咗大概四分之一嘅新聞...",
      half: "我哋已經講到一半喇...",
      threeQuarter: "嚟到今日新聞嘅最後幾分鐘..."
    },
    'zh-CN': {
      quarter: "我们现在已经播报了大约四分之一的新闻...",
      half: "我们已经到一半了...",
      threeQuarter: "进入今天新闻的最后几分钟..."
    }
  }
  
  const progress = currentMinute / totalMinutes
  if (progress >= 0.7) return markers[language]?.threeQuarter || markers.en.threeQuarter
  if (progress >= 0.4 && progress < 0.6) return markers[language]?.half || markers.en.half
  if (progress >= 0.2 && progress < 0.3) return markers[language]?.quarter || markers.en.quarter
  
  return ''
}

/**
 * Morning brief prompt configuration (5 AM - 12 PM)
 */
export const MORNING_BRIEF_CONFIG: BriefPromptConfig = {
  tone: "Warm, energetic but not overwhelming. Professional yet approachable. Help listeners wake up and prepare for their day.",
  focus: [
    "Overnight developments",
    "Weather and traffic updates", 
    "Market pre-opening insights",
    "Day-ahead preparation",
    "Energy-building content"
  ],
  specialInstructions: [
    "Start with weather/traffic if severe conditions exist",
    "Include 'what you need to know before work' angle",
    "Reference breakfast/commute activities",
    "Build energy gradually throughout the brief",
    "End with an uplifting or motivational note"
  ],
  systemPrompt: `You are a warm, professional morning news anchor for Hong Kong's premier audio news service. Your goal is to help listeners start their day informed and energized. You're broadcasting during the morning hours when people are waking up, having breakfast, or commuting to work.

Your voice should be:
- Warm and welcoming, like a trusted friend
- Energetic but not overwhelming 
- Clear and easy to follow for someone who just woke up
- Professional yet conversational

Remember: Many listeners are multitasking - getting ready, eating, commuting. Make your delivery clear and repeatable for key points.`,
  
  userPromptTemplate: `Create a ${TARGET_DURATION_MINUTES}-minute morning news brief that helps Hong Kong listeners start their day. Include natural pauses and transitions for a smooth listening experience.`
}

/**
 * Afternoon brief prompt configuration (12 PM - 6 PM)  
 */
export const AFTERNOON_BRIEF_CONFIG: BriefPromptConfig = {
  tone: "Professional, focused, informative. Mid-day energy boost. Efficient delivery for busy professionals.",
  focus: [
    "Market movements and financial updates",
    "Breaking news since morning",
    "Business developments",
    "Productivity and efficiency",
    "Quick updates for busy professionals"
  ],
  specialInstructions: [
    "Lead with market updates if significant",
    "Provide context from morning developments",
    "Be concise - listeners may be eating lunch or in meetings",
    "Include 'what happened while you were working' angle",
    "Preview evening/overnight events"
  ],
  systemPrompt: `You are a sharp, professional afternoon news anchor for Hong Kong's premier audio news service. Your audience consists mainly of professionals taking a mid-day break, having lunch, or catching up during work.

Your delivery should be:
- Crisp and efficient
- Professional and authoritative
- Energetic to combat post-lunch fatigue
- Focused on actionable information

Remember: Your listeners are likely time-constrained. Get to the point while remaining engaging.`,
  
  userPromptTemplate: `Create a ${TARGET_DURATION_MINUTES}-minute afternoon news update for busy Hong Kong professionals. Focus on market movements, business developments, and important updates since morning.`
}

/**
 * Evening brief prompt configuration (6 PM - 5 AM)
 */
export const EVENING_BRIEF_CONFIG: BriefPromptConfig = {
  tone: "Reflective, comprehensive, calming. Help listeners unwind while staying informed. More storytelling approach.",
  focus: [
    "Comprehensive day recap",
    "Analysis and context",
    "Cultural and lifestyle content",
    "Tomorrow's preview",
    "Human interest stories"
  ],
  specialInstructions: [
    "Take more time with each story",
    "Include more context and analysis",
    "Add human interest angles",
    "Reference dinner/evening activities",
    "End with tomorrow's key events preview"
  ],
  systemPrompt: `You are a thoughtful, engaging evening news anchor for Hong Kong's premier audio news service. Your audience is unwinding from their day, perhaps commuting home, having dinner, or relaxing.

Your approach should be:
- Calm and reflective
- Comprehensive and analytical
- Warm and personable
- Storytelling-focused

Remember: Evening listeners have more time and want depth. They're looking to understand not just what happened, but why it matters.`,
  
  userPromptTemplate: `Create a ${TARGET_DURATION_MINUTES}-minute evening news brief that helps Hong Kong listeners understand their day and prepare for tomorrow. Include deeper analysis and human interest angles.`
}

/**
 * Generate a complete prompt for news brief generation
 */
export function generateBriefPrompt(
  briefType: 'morning' | 'afternoon' | 'evening',
  language: string,
  articles: any[]
): { systemPrompt: string; userPrompt: string } {
  
  const config = {
    morning: MORNING_BRIEF_CONFIG,
    afternoon: AFTERNOON_BRIEF_CONFIG,
    evening: EVENING_BRIEF_CONFIG
  }[briefType]
  
  const { time, hour } = getHongKongTime()
  const greeting = generateGreeting(briefType, language)
  
  // Base system prompt with language adaptations
  let systemPrompt = `${config.systemPrompt}

CRITICAL AUDIO REQUIREMENTS:
- Target duration: ${TARGET_DURATION_MINUTES} minutes (${TARGET_WORD_COUNT} words)
- Write for AUDIO, not reading - no markdown, no visual formatting
- Include specific time references: "It's ${time}" 
- Add progress markers: "We're about halfway through..." at appropriate points
- Use natural transitions between sections - no abrupt jumps
- Include rhetorical questions and conversational elements
- Reference Hong Kong locations and context frequently
- Vary your pacing - quick updates mixed with deeper dives

TONE: ${config.tone}

FOCUS AREAS: ${config.focus.join(', ')}

SPECIAL INSTRUCTIONS:
${config.specialInstructions.map(i => `- ${i}`).join('\n')}

Language: Write in ${language === 'en' ? 'conversational English' : language === 'zh-TW' ? 'spoken Cantonese (口語粵語) - use characters like 係,喺,冇,啲,嘅' : 'clear Simplified Chinese suitable for broadcast'}`

  // Enhanced user prompt with specific requirements
  const userPrompt = `${config.userPromptTemplate}

CRITICAL REQUIREMENT: You MUST generate a COMPLETE ${TARGET_DURATION_MINUTES}-minute news brief with approximately ${TARGET_WORD_COUNT} words. This is NOT a summary - it's a full broadcast script!

START WITH: "${greeting}"

IMPORTANT LENGTH REQUIREMENTS:
- Total script MUST be ${TARGET_WORD_COUNT} words (currently you're generating too short!)
- Each section MUST be fully developed with complete stories
- DO NOT summarize - provide FULL coverage of each story
- This should take ${TARGET_DURATION_MINUTES} minutes to read aloud

STRUCTURE YOUR BRIEF:
1. Opening (30 seconds)
   - Time-specific greeting  
   - Brief overview of what's coming (3-4 key topics)
   - Hook with most relevant story for ${briefType} listeners

2. Top Stories (3-4 minutes)
   - Lead with most impactful/relevant story
   - Include "why this matters to you" angle
   - Use specific Hong Kong references
   - Add a rhetorical question or relatable example

3. Finance & Business (2-3 minutes) 
   - ${briefType === 'afternoon' ? 'Focus on market movements' : 'Preview or recap market activity'}
   - Relate to listener's personal finances
   - Transition: Use one from the finance transitions list

4. Technology & International (2-3 minutes)
   - Balance global stories with local impact
   - Include one "did you know" fact
   - Progress marker: "We're about halfway through..."

5. Lifestyle/Entertainment (1-2 minutes)
   - Lighter tone
   - Cultural events in Hong Kong
   - Weekend/evening activity suggestions for ${briefType === 'evening' ? 'tomorrow' : 'today'}

6. Closing (30 seconds)
   - Brief recap of top 2-3 stories
   - ${briefType === 'morning' ? 'Wish them a great day ahead' : briefType === 'afternoon' ? 'Preview evening/tomorrow' : 'Thank them and preview tomorrow'}
   - Sign off with time check

ENGAGEMENT REQUIREMENTS:
- Include 3-4 rhetorical questions throughout
- Add 2-3 relatable comparisons (e.g., "That's about the time it takes to ride the MTR from...")
- Use conversational bridges between stories
- Reference specific Hong Kong locations/landmarks
- Include 1-2 practical tips or advice

TRANSITIONS TO USE:
${Object.entries(SECTION_TRANSITIONS).map(([key, transitions]) => 
  `${key}: "${transitions[Math.floor(Math.random() * transitions.length)]}"`
).join('\n')}

ARTICLES TO INCLUDE:
${JSON.stringify(articles.map(a => ({
  title: a.title,
  summary: a.summary || a.ai_summary,
  category: a.category,
  localRelevance: a.enhancement_metadata?.localRelevance || 'General'
})), null, 2)}

REMEMBER:
- This is AUDIO - write for the ear, not the eye
- Include specific times and progress markers
- Make it conversational and engaging
- Focus on local relevance for Hong Kong listeners
- Aim for exactly ${TARGET_WORD_COUNT} words

FINAL CHECK: Before finishing, ensure your script is COMPLETE and DETAILED. Each story should have:
- Full context and background
- Specific details and examples
- Why it matters to listeners
- Smooth transitions to next story

DO NOT provide a short summary - provide a FULL ${TARGET_DURATION_MINUTES}-minute broadcast script!`

  return { systemPrompt, userPrompt }
}

/**
 * Validate brief content for audio quality
 */
export function validateAudioBrief(content: string, language?: string): {
  isValid: boolean
  issues: string[]
  metrics: {
    wordCount: number
    estimatedDuration: number
    hasTimeReferences: boolean
    hasProgressMarkers: boolean
    hasQuestions: boolean
    hasTransitions: boolean
  }
} {
  // Calculate word count based on language
  let wordCount: number
  let wordsPerMinute: number
  
  if (language && (language === 'zh-CN' || language === 'zh-TW')) {
    // For Chinese, count characters and estimate words
    const chineseChars = content.match(/[\u4e00-\u9fa5]/g) || []
    wordCount = Math.ceil(chineseChars.length / 2.5) // Average 2.5 chars per word in Chinese
    wordsPerMinute = 200 // Chinese is read faster
  } else {
    // For English and other languages, count actual words
    wordCount = content.split(/\s+/).filter(w => w.length > 0).length
    wordsPerMinute = 170
  }
  
  const estimatedDuration = wordCount / wordsPerMinute
  
  const issues: string[] = []
  
  // Check word count
  if (wordCount < TARGET_WORD_COUNT * 0.9) {
    issues.push(`Content too short: ${wordCount} words (target: ${TARGET_WORD_COUNT})`)
  }
  if (wordCount > TARGET_WORD_COUNT * 1.1) {
    issues.push(`Content too long: ${wordCount} words (target: ${TARGET_WORD_COUNT})`)
  }
  
  // Check for required elements
  const hasTimeReferences = /\d{1,2}:\d{2}\s*(AM|PM|am|pm)/i.test(content)
  const hasProgressMarkers = /halfway|quarter|minutes into|final minutes/i.test(content)
  const hasQuestions = /\?/.test(content)
  const hasTransitions = /turning to|moving on|let's shift|speaking of/i.test(content)
  
  if (!hasTimeReferences) issues.push('Missing time references')
  if (!hasProgressMarkers) issues.push('Missing progress markers')
  if (!hasQuestions) issues.push('No rhetorical questions found')
  if (!hasTransitions) issues.push('Missing section transitions')
  
  return {
    isValid: issues.length === 0,
    issues,
    metrics: {
      wordCount,
      estimatedDuration,
      hasTimeReferences,
      hasProgressMarkers,
      hasQuestions,
      hasTransitions
    }
  }
}