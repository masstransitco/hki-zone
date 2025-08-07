import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { generateBriefPrompt, validateAudioBrief } from '@/lib/news-brief-prompts'
import { expandArticleContent, validateExpandedContent } from '@/lib/news-content-expansion'
import { generateBroadcastScript } from '@/lib/news-broadcast-script'

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
const TARGET_DURATION_SECONDS = 600 // 10 minutes (8-12 minute range)
const WORDS_PER_MINUTE = 170 // Average speaking rate for clear audio
const TARGET_WORD_COUNT = 2200 // For 10-12 minute brief

async function getSelectedTTSArticles(language: string, hours: number = 24): Promise<any[]> {
  const since = new Date()
  since.setHours(since.getHours() - hours)

  console.log(`🔍 Fetching articles already selected for TTS in ${language}`)

  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('is_ai_enhanced', true)
    .eq('language_variant', language)
    .eq('selected_for_tts_brief', true) // Use articles already selected for TTS
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching selected TTS articles:', error)
    throw error
  }

  console.log(`✅ Found ${data?.length || 0} pre-selected articles for ${language}`)
  return data || []
}

async function prepareArticlesForBrief(articles: any[], briefType: 'morning' | 'afternoon' | 'evening'): Promise<any[]> {
  console.log(`📝 Preparing ${articles.length} pre-selected articles for ${briefType} brief`)
  
  // Articles are already selected by AI with category coverage
  // Just sort them by category priority for better brief structure
  const categoryPriorities = {
    morning: ['Top Stories', 'Finance', 'Tech & Science', 'International', 'Entertainment', 'Arts & Culture', 'News'],
    afternoon: ['Finance', 'Tech & Science', 'Top Stories', 'International', 'Entertainment', 'Arts & Culture', 'News'],
    evening: ['Top Stories', 'Arts & Culture', 'Entertainment', 'International', 'Finance', 'Tech & Science', 'News']
  }

  const priorities = categoryPriorities[briefType]
  
  // Sort articles by category priority, then by creation date
  const sortedArticles = articles.sort((a, b) => {
    const aPriority = priorities.indexOf(a.category) !== -1 ? priorities.indexOf(a.category) : 999
    const bPriority = priorities.indexOf(b.category) !== -1 ? priorities.indexOf(b.category) : 999
    
    if (aPriority !== bPriority) {
      return aPriority - bPriority
    }
    
    // Same category, sort by date (newer first)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  console.log(`✅ Articles organized by ${briefType} priority:`, 
    sortedArticles.reduce((acc, article) => {
      const cat = article.category || 'Unknown'
      acc[cat] = (acc[cat] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  )

  return sortedArticles
}

async function generateNewsBriefContentTwoStep(articles: any[], briefType: 'morning' | 'afternoon' | 'evening', language: string): Promise<{ content: string; cost: number; wordCount: number; validation: any }> {
  console.log(`🚀 Starting two-step news brief generation for ${language}`)
  
  const articleSummaries = articles.map(article => ({
    title: article.title,
    summary: article.summary || article.ai_summary,
    category: article.category,
    localRelevance: article.enhancement_metadata?.localRelevance || 'General'
  }))

  try {
    // STEP 1: Expand article content
    console.log(`📝 Step 1: Expanding content for ${articleSummaries.length} articles`)
    const expansionResult = await expandArticleContent(articleSummaries, language)
    
    if (!expansionResult.success) {
      throw new Error(`Content expansion failed: ${expansionResult.error}`)
    }

    // Validate expanded content
    const expansionValidation = validateExpandedContent(expansionResult.expandedArticles)
    if (!expansionValidation.isValid) {
      console.warn('⚠️ Content expansion issues:', expansionValidation.issues)
    }

    console.log(`✅ Step 1 Complete: ${expansionResult.expandedArticles.length} articles expanded`)
    console.log(`📊 Expansion metrics:`, expansionValidation.metrics)

    // STEP 2: Generate broadcast script
    console.log(`📻 Step 2: Generating broadcast script`)
    const scriptResult = await generateBroadcastScript(
      expansionResult.expandedArticles,
      briefType,
      language
    )
    
    if (!scriptResult.success) {
      throw new Error(`Broadcast script generation failed: ${scriptResult.error}`)
    }

    console.log(`✅ Step 2 Complete: ${scriptResult.wordCount} words`)
    console.log(`📊 Script validation:`, scriptResult.validation)

    // Combine costs
    const totalCost = expansionResult.cost + scriptResult.cost

    // Use the broadcast script validation for compatibility
    const validation = {
      isValid: scriptResult.validation.meetsTargetLength && scriptResult.validation.hasTimeReferences && scriptResult.validation.correctSegmentCount && scriptResult.validation.hasBrandMention,
      issues: Object.entries(scriptResult.validation)
        .filter(([key, value]) => !value && key !== 'meetsTargetLength')
        .map(([key]) => `Missing ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}`),
      metrics: {
        wordCount: scriptResult.totalWordCount,
        estimatedDuration: scriptResult.totalEstimatedDuration / 60, // in minutes
        segmentCount: scriptResult.dialogueSegments.length,
        hasTimeReferences: scriptResult.validation.hasTimeReferences,
        hasProgressMarkers: scriptResult.validation.hasProgressMarkers,
        hasQuestions: scriptResult.validation.hasQuestions,
        hasTransitions: scriptResult.validation.hasTransitions,
        correctSegmentCount: scriptResult.validation.correctSegmentCount,
        hasBrandMention: scriptResult.validation.hasBrandMention
      }
    }

    console.log(`🎯 Two-step generation complete:`)
    console.log(`   Step 1 cost: $${expansionResult.cost.toFixed(6)}`)
    console.log(`   Step 2 cost: $${scriptResult.cost.toFixed(6)}`)
    console.log(`   Total cost: $${totalCost.toFixed(6)}`)
    console.log(`   Final length: ${scriptResult.totalWordCount} words (${Math.round(scriptResult.totalEstimatedDuration/60)} minutes)`)
    console.log(`   Dialogue segments: ${scriptResult.dialogueSegments.length}`)

    return {
      content: scriptResult.content,
      expandedArticles: expansionResult.expandedArticles,
      dialogueSegments: scriptResult.dialogueSegments,
      cost: totalCost,
      wordCount: scriptResult.totalWordCount,
      validation
    }

  } catch (error) {
    console.error('❌ Two-step news brief generation failed:', error)
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

    // 1. Fetch articles already selected for TTS (using trilingual consistency approach)
    const articles = await getSelectedTTSArticles(language)
    console.log(`📰 Found ${articles.length} pre-selected articles for ${language}`)

    if (articles.length < 5) {
      return NextResponse.json({
        error: 'Not enough pre-selected articles for news brief generation',
        availableArticles: articles.length,
        minimumRequired: 5,
        suggestion: 'Please use the Articles tab to select articles for TTS briefs first'
      }, { status: 400 })
    }

    // 2. Prepare articles for the brief (sort by priority, no additional selection needed)
    const selectedArticles = await prepareArticlesForBrief(articles, briefType)
    console.log(`✅ Using ${selectedArticles.length} pre-selected articles for brief`)

    // 3. Generate the news brief content using two-step process
    const generationResult = await generateNewsBriefContentTwoStep(selectedArticles, briefType, language)
    const estimatedDuration = Math.round(generationResult.wordCount / WORDS_PER_MINUTE * 60)
    
    // Log validation results
    if (generationResult.validation) {
      console.log(`📊 Audio quality metrics:`, generationResult.validation.metrics)
      if (!generationResult.validation.isValid) {
        console.warn(`⚠️ Quality issues:`, generationResult.validation.issues)
      }
    }

    // 4. Save the news brief to database
    const { data: savedBrief, error: saveError } = await supabase
      .from('news_briefs')
      .insert([{
        title: `${briefType.charAt(0).toUpperCase() + briefType.slice(1)} News Brief - ${new Date().toLocaleDateString()}`,
        content: generationResult.content,
        expanded_content: generationResult.expandedArticles || null,
        dialogue_segments: generationResult.dialogueSegments || null,
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

    // 6. Update article metadata to link them to this specific brief
    const articleUpdatePromises = selectedArticles.map(article => 
      supabase
        .from('articles')
        .update({
          tts_selection_metadata: {
            ...article.tts_selection_metadata,
            brief_id: savedBrief.id,
            brief_type: briefType,
            used_in_brief_at: new Date().toISOString()
          }
        })
        .eq('id', article.id)
    )

    const updateResults = await Promise.allSettled(articleUpdatePromises)
    const failedUpdates = updateResults.filter(r => r.status === 'rejected')
    
    if (failedUpdates.length > 0) {
      console.warn(`Failed to update ${failedUpdates.length} articles with brief metadata`)
    }

    return NextResponse.json({
      success: true,
      brief: savedBrief,
      stats: {
        preSelectedArticles: articles.length,
        articlesUsedInBrief: selectedArticles.length,
        wordCount: generationResult.wordCount,
        estimatedDurationSeconds: estimatedDuration,
        estimatedDurationMinutes: (estimatedDuration / 60).toFixed(1),
        generationCost: generationResult.cost.toFixed(6),
        articlesLinkedToBrief: selectedArticles.length - failedUpdates.length
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
        const articles = await getSelectedTTSArticles(lang, 24)
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