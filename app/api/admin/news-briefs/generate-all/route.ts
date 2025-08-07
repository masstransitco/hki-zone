import { NextRequest, NextResponse } from 'next/server'

/**
 * Server-side API endpoint for admin panel to trigger news brief generation
 * Supports both individual language and batch generation
 * This endpoint calls the generation API directly, avoiding authentication issues
 */
export async function POST(request: NextRequest) {
  try {
    const { 
      briefType = 'morning', 
      languages = ['en', 'zh-TW', 'zh-CN'],
      language // for single language generation
    } = await request.json()

    // Handle single language generation
    if (language) {
      console.log(`🎯 Admin triggered single brief generation: ${briefType} in ${language}`)
      
      const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : 'http://localhost:3000'

      const response = await fetch(`${baseUrl}/api/news-briefs/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          briefType,
          language
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Generation endpoint error:', response.status, errorText)
        throw new Error(`Generation endpoint returned ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      
      return NextResponse.json({
        success: true,
        message: `Generated ${briefType} brief for ${language}`,
        ...result
      })
    }

    // Handle batch generation for multiple languages
    console.log(`🎯 Admin triggered batch brief generation: ${briefType}`)
    console.log(`   Languages: ${languages.join(', ')}`)

    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000'

    const results = []
    
    // Generate briefs for each language sequentially to avoid overwhelming the system
    for (const lang of languages) {
      try {
        console.log(`🎙️ Generating ${briefType} brief for ${lang}`)
        
        const response = await fetch(`${baseUrl}/api/news-briefs/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            briefType,
            language: lang
          })
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`Generation failed for ${lang}:`, response.status, errorText)
          results.push({
            language: lang,
            status: 'error',
            error: `HTTP ${response.status}: ${errorText}`
          })
          continue
        }

        const result = await response.json()
        results.push({
          language: lang,
          status: 'success',
          briefId: result.brief?.id,
          wordCount: result.stats?.wordCount,
          duration: result.stats?.estimatedDurationMinutes
        })

      } catch (error) {
        console.error(`❌ Error generating brief for ${lang}:`, error)
        results.push({
          language: lang,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const successCount = results.filter(r => r.status === 'success').length
    
    console.log(`✅ Batch generation complete: ${successCount}/${languages.length} successful`)

    return NextResponse.json({
      success: true,
      message: `Generated ${successCount} news briefs`,
      briefType,
      results
    })

  } catch (error) {
    console.error('❌ Error in admin news brief generation:', error)
    return NextResponse.json({
      error: 'Failed to trigger news brief generation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}