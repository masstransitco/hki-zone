import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { autoProcessArticleImage } from '@/lib/image-processor'

export const maxDuration = 300 // 5 minutes for image generation

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 120_000,
})

const BUCKET = 'article-images'
const PREFIX = 'articles'

// Category-specific safe prompts for DALL-E 3
const CATEGORY_PROMPTS: Record<string, string> = {
  'Politics': 'Hong Kong government buildings and administrative district, modern architecture, professional atmosphere, no text, no signage, no logos',
  'Business': 'Hong Kong financial district skyline, Central business towers, commercial buildings, no text, no signage, no logos',
  'Technology': 'Modern Hong Kong tech hub, contemporary office buildings, clean minimalist architecture, no text, no signage, no logos',
  'Health': 'Modern medical facility exterior in Hong Kong, clean architecture, professional healthcare environment, no text, no signage',
  'Education': 'Hong Kong university campus buildings, modern educational architecture, academic environment, no text, no signage',
  'Sports': 'Hong Kong sports facility, stadium architecture, athletic venue exterior, no text, no signage, no logos',
  'Entertainment': 'Hong Kong cultural district, performance venue architecture, creative spaces, no text, no signage',
  'Crime': 'Hong Kong justice building exterior, courthouse architecture, legal district, no text, no signage',
  'Environment': 'Hong Kong green spaces and sustainable architecture, urban nature, eco-friendly buildings, no text, no signage',
  'International': 'Hong Kong international commerce buildings, trade center architecture, global business district, no text, no signage',
  'General': 'Hong Kong urban district, modern architecture mixed with traditional buildings, busy street atmosphere, no text, no signage, no logos'
}

async function generateContextualPrompt(article: any): Promise<string> {
  const title = article?.title || ''
  const content = article?.content || ''
  const summary = article?.summary || ''
  const category = article?.category || 'General'

  const systemPrompt = `You are a photo editor creating DALL-E 3 prompts for news articles. Generate prompts that create professional, editorial-quality images.

CRITICAL SAFETY RULES:
- NO TEXT: Never request any text, signage, words, letters, numbers
- NO BRANDS: Never mention company names, brand names, logos
- NO SPECIFIC PEOPLE: Use only generic terms like "people", "professionals"
- Focus on ENVIRONMENTS and ARCHITECTURE rather than people
- ALWAYS include "no text, no signage, no logos" in the prompt

Keep prompts under 100 words. Return only the prompt text.`

  const userPrompt = `Create a DALL-E prompt for this Hong Kong news article:
Title: ${title}
Category: ${category}
Summary: ${summary}
Content: ${content.slice(0, 1000)}

Generate a prompt for a professional news photograph with Hong Kong context.`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Use mini for cost efficiency in cron
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 300,
      temperature: 0.7
    })

    const prompt = response.choices[0]?.message?.content?.trim()
    if (prompt) return prompt
  } catch (error) {
    console.error('Error generating prompt with GPT:', error)
  }

  // Fallback to category-based prompt
  return `${CATEGORY_PROMPTS[category] || CATEGORY_PROMPTS['General']}, professional documentary photography style, natural lighting, editorial quality`
}

async function generateAndUploadImage(articleId: string, prompt: string): Promise<string | null> {
  try {
    console.log(`   🎨 Generating image for article ${articleId}...`)

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      size: '1792x1024',
      quality: 'hd',
      style: 'natural',
      n: 1
    })

    const generatedImageUrl = response.data?.[0]?.url
    if (!generatedImageUrl) {
      throw new Error('No image URL returned from DALL-E')
    }

    // Download image
    const imageResponse = await fetch(generatedImageUrl)
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.status}`)
    }
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())

    // Upload to Supabase
    const fileName = `auto-generated-${articleId}-${Date.now()}.png`
    const storagePath = `${PREFIX}/${articleId}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, imageBuffer, {
        contentType: 'image/png',
        upsert: false
      })

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`)
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
    return data.publicUrl

  } catch (error) {
    console.error(`   ❌ Failed to generate image for ${articleId}:`, error)
    return null
  }
}

async function processArticle(article: any): Promise<{ success: boolean; articleId: string; title: string; error?: string }> {
  try {
    console.log(`\n📰 Processing: "${article.title?.substring(0, 50)}..."`)

    // Generate contextual prompt
    const prompt = await generateContextualPrompt(article)
    console.log(`   📝 Prompt: ${prompt.substring(0, 100)}...`)

    // Generate and upload image
    const imageUrl = await generateAndUploadImage(article.id, prompt)

    if (!imageUrl) {
      return { success: false, articleId: article.id, title: article.title, error: 'Image generation failed' }
    }

    // Update article with new image
    const { error: updateError } = await supabase
      .from('articles')
      .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
      .eq('id', article.id)

    if (updateError) {
      return { success: false, articleId: article.id, title: article.title, error: updateError.message }
    }

    // Sync image to trilingual versions
    const baseUrl = article.url?.replace(/#enhanced.*$/, '') || ''
    if (baseUrl) {
      const { error: syncError } = await supabase
        .from('articles')
        .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
        .like('url', `${baseUrl}%`)
        .neq('id', article.id)

      if (syncError) {
        console.log(`   ⚠️ Failed to sync to related articles: ${syncError.message}`)
      } else {
        console.log(`   🔄 Synced image to related trilingual articles`)
      }
    }

    // Auto-process for social media
    autoProcessArticleImage(article.id, imageUrl, 'articles', true).catch(err => {
      console.error(`   ⚠️ Failed to process for social media: ${err.message}`)
    })

    console.log(`   ✅ Successfully generated and saved image`)
    return { success: true, articleId: article.id, title: article.title }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, articleId: article.id, title: article.title, error: errorMessage }
  }
}

export async function GET(request: NextRequest) {
  const userAgent = request.headers.get('user-agent')
  const authHeader = request.headers.get('authorization')
  const isVercelCron = userAgent === 'vercel-cron/1.0'
  const isValidSecret = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`

  // Allow stats check without auth
  if (!isVercelCron && !isValidSecret) {
    // Return stats for monitoring
    const { data: pendingArticles, error } = await supabase
      .from('articles')
      .select('id, title, source')
      .eq('is_ai_enhanced', true)
      .or('image_url.is.null,image_url.eq.')
      .limit(10)

    return NextResponse.json({
      configured: true,
      message: 'Image generation cron endpoint',
      pendingCount: pendingArticles?.length || 0,
      pending: pendingArticles?.map(a => ({ title: a.title?.substring(0, 50), source: a.source })) || []
    })
  }

  try {
    const startTime = Date.now()
    console.log('🖼️ Starting auto image generation for enhanced articles...')
    console.log(`⏰ Time: ${new Date().toISOString()}`)

    // Find enhanced articles without images (limit to 2 per run to manage costs/time)
    const { data: articles, error: fetchError } = await supabase
      .from('articles')
      .select('id, title, summary, content, category, url, source')
      .eq('is_ai_enhanced', true)
      .or('image_url.is.null,image_url.eq.')
      .order('created_at', { ascending: false })
      .limit(2)

    if (fetchError) {
      throw new Error(`Failed to fetch articles: ${fetchError.message}`)
    }

    if (!articles || articles.length === 0) {
      console.log('✅ No enhanced articles without images found')
      return NextResponse.json({
        success: true,
        message: 'No articles need images',
        processed: 0
      })
    }

    console.log(`📋 Found ${articles.length} enhanced articles without images`)

    // Process articles
    const results = []
    for (const article of articles) {
      const result = await processArticle(article)
      results.push(result)

      // Rate limiting between generations
      if (articles.indexOf(article) < articles.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    const successful = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)
    const processingTime = Date.now() - startTime

    console.log(`\n✅ Completed: ${successful.length} success, ${failed.length} failed in ${Math.round(processingTime / 1000)}s`)

    return NextResponse.json({
      success: true,
      processed: results.length,
      successful: successful.length,
      failed: failed.length,
      processingTimeMs: processingTime,
      results: results.map(r => ({
        articleId: r.articleId,
        title: r.title?.substring(0, 50),
        success: r.success,
        error: r.error
      })),
      estimatedCost: `$${(successful.length * 0.08).toFixed(2)}` // ~$0.08 per DALL-E 3 HD image
    })

  } catch (error) {
    console.error('❌ Image generation cron error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  console.log('Manual trigger of image generation')
  return GET(request)
}
