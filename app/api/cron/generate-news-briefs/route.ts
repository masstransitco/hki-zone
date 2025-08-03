import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

// Define when to generate briefs (HKT times)
const BRIEF_SCHEDULE = {
  morning: { hour: 6, type: 'morning' },    // 6:00 AM HKT
  afternoon: { hour: 12, type: 'afternoon' }, // 12:00 PM HKT
  evening: { hour: 18, type: 'evening' }     // 6:00 PM HKT
}

function getCurrentHKTHour(): number {
  const now = new Date()
  // Convert to HKT (UTC+8)
  const hktTime = new Date(now.getTime() + (8 * 60 * 60 * 1000))
  return hktTime.getUTCHours()
}

function shouldGenerateBrief(): { should: boolean; type: string } {
  const currentHour = getCurrentHKTHour()
  
  // Check if we're within 30 minutes of any scheduled time
  for (const [key, schedule] of Object.entries(BRIEF_SCHEDULE)) {
    if (Math.abs(currentHour - schedule.hour) < 0.5) {
      return { should: true, type: schedule.type }
    }
  }
  
  return { should: false, type: '' }
}

async function hasRecentBrief(type: string, language: string, hoursAgo: number = 2): Promise<boolean> {
  const since = new Date()
  since.setHours(since.getHours() - hoursAgo)
  
  const { data, error } = await supabase
    .from('news_briefs')
    .select('id')
    .eq('category', type)
    .eq('language', language)
    .gte('created_at', since.toISOString())
    .limit(1)
  
  if (error) {
    console.error('Error checking recent briefs:', error)
    return false
  }
  
  return (data?.length || 0) > 0
}

async function generateBriefForLanguage(language: string, briefType: string) {
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:3000'
  
  const response = await fetch(`${baseUrl}/api/news-briefs/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.CRON_SECRET}`
    },
    body: JSON.stringify({
      language,
      briefType
    })
  })
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to generate brief: ${error}`)
  }
  
  return await response.json()
}

export async function GET(request: NextRequest) {
  // Check authentication
  const authHeader = request.headers.get('authorization')
  const userAgent = request.headers.get('user-agent')
  const isVercelCron = userAgent === 'vercel-cron/1.0'
  const isValidSecret = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`
  
  if (!isVercelCron && !isValidSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    const now = new Date()
    const hktHour = getCurrentHKTHour()
    console.log(`🕐 Current HKT hour: ${hktHour}`)
    
    // Check if we should generate briefs at this time
    const { should, type: briefType } = shouldGenerateBrief()
    
    if (!should) {
      console.log('⏭️ Not a scheduled time for brief generation')
      return NextResponse.json({
        success: true,
        message: 'Not a scheduled time for brief generation',
        currentHKTHour: hktHour,
        nextScheduled: Object.entries(BRIEF_SCHEDULE)
          .map(([key, schedule]) => ({
            type: key,
            hour: schedule.hour,
            hoursUntil: (schedule.hour - hktHour + 24) % 24
          }))
          .sort((a, b) => a.hoursUntil - b.hoursUntil)[0]
      })
    }
    
    console.log(`📰 Generating ${briefType} news briefs`)
    
    const languages = ['en', 'zh-TW', 'zh-CN']
    const results = []
    
    for (const language of languages) {
      try {
        // Check if we already have a recent brief
        const hasRecent = await hasRecentBrief(briefType, language)
        
        if (hasRecent) {
          console.log(`⏭️ Already have recent ${briefType} brief for ${language}`)
          results.push({
            language,
            status: 'skipped',
            reason: 'Recent brief exists'
          })
          continue
        }
        
        console.log(`🎙️ Generating ${briefType} brief for ${language}`)
        const result = await generateBriefForLanguage(language, briefType)
        
        results.push({
          language,
          status: 'success',
          briefId: result.brief?.id,
          wordCount: result.stats?.wordCount,
          duration: result.stats?.estimatedDurationMinutes
        })
        
      } catch (error) {
        console.error(`❌ Error generating brief for ${language}:`, error)
        results.push({
          language,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
    
    const successCount = results.filter(r => r.status === 'success').length
    
    return NextResponse.json({
      success: true,
      message: `Generated ${successCount} news briefs`,
      briefType,
      timestamp: now.toISOString(),
      hktHour,
      results
    })
    
  } catch (error) {
    console.error('❌ Error in news brief generation cron:', error)
    return NextResponse.json({
      error: 'Failed to generate news briefs',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Manual trigger endpoint for testing
export async function POST(request: NextRequest) {
  // Allow manual trigger with proper auth
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    const { briefType = 'morning', languages = ['en', 'zh-TW', 'zh-CN'] } = await request.json()
    
    console.log(`📰 Manual trigger: Generating ${briefType} news briefs`)
    
    const results = []
    
    for (const language of languages) {
      try {
        console.log(`🎙️ Generating ${briefType} brief for ${language}`)
        const result = await generateBriefForLanguage(language, briefType)
        
        results.push({
          language,
          status: 'success',
          briefId: result.brief?.id,
          wordCount: result.stats?.wordCount,
          duration: result.stats?.estimatedDurationMinutes
        })
        
      } catch (error) {
        console.error(`❌ Error generating brief for ${language}:`, error)
        results.push({
          language,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Manual generation complete',
      briefType,
      results
    })
    
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to generate news briefs',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}