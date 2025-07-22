import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

function getDateHoursAgo(hours: number): string {
  const date = new Date()
  date.setTime(date.getTime() - (hours * 60 * 60 * 1000))
  return date.toISOString()
}

function getTimeAgo(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  
  if (diffHours < 1) {
    const diffMins = Math.floor(diffMs / (1000 * 60))
    return `${diffMins}m ago`
  } else if (diffHours < 24) {
    return `${diffHours}h ago`
  } else {
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  }
}

async function findStuckSelections(stuckThresholdHours: number = 4) {
  const stuckThreshold = getDateHoursAgo(stuckThresholdHours)
  
  console.log(`🔍 Finding articles stuck for more than ${stuckThresholdHours} hours...`)
  console.log(`   Threshold: ${stuckThreshold}`)
  
  const { data: stuckArticles, error } = await supabase
    .from('articles')
    .select('id, title, source, created_at, selection_metadata')
    .eq('selected_for_enhancement', true)
    .eq('is_ai_enhanced', false)
    .lt('selection_metadata->>selected_at', stuckThreshold)
    .order('selection_metadata->>selected_at', { ascending: true })
    .limit(50) // Limit to prevent overwhelming logs

  if (error) {
    console.error('❌ Error finding stuck articles:', error)
    throw error
  }

  return stuckArticles || []
}

async function resetStuckSelections(stuckArticles: any[]) {
  if (stuckArticles.length === 0) {
    return { resetCount: 0, errors: [] }
  }

  console.log(`🔄 Resetting ${stuckArticles.length} stuck selections...`)
  
  const idsToReset = stuckArticles.map(a => a.id)
  const resetTimestamp = new Date().toISOString()
  
  const { error: resetError } = await supabase
    .from('articles')
    .update({
      selected_for_enhancement: false,
      selection_metadata: {
        ...stuckArticles[0]?.selection_metadata,
        reset_at: resetTimestamp,
        reset_reason: 'cleanup_stuck_selections_cron',
        previously_stuck: true
      }
    })
    .in('id', idsToReset)

  if (resetError) {
    console.error('❌ Error resetting stuck selections:', resetError)
    throw resetError
  }

  console.log(`✅ Successfully reset ${stuckArticles.length} stuck selections`)
  return { resetCount: stuckArticles.length, errors: [] }
}

async function analyzeStuckPatterns(stuckArticles: any[]) {
  if (stuckArticles.length === 0) {
    return { patterns: {}, insights: [] }
  }

  // Analyze patterns in stuck articles
  const sourcePattern = stuckArticles.reduce((acc, article) => {
    acc[article.source] = (acc[article.source] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const agePattern = stuckArticles.reduce((acc, article) => {
    const selectedAt = article.selection_metadata?.selected_at
    if (selectedAt) {
      const hoursStuck = Math.floor((Date.now() - new Date(selectedAt).getTime()) / (1000 * 60 * 60))
      const bucket = hoursStuck < 12 ? '<12h' : hoursStuck < 24 ? '12-24h' : hoursStuck < 48 ? '1-2d' : '>2d'
      acc[bucket] = (acc[bucket] || 0) + 1
    }
    return acc
  }, {} as Record<string, number>)

  const insights = []
  
  // Generate insights
  const topSource = Object.entries(sourcePattern).sort(([,a], [,b]) => b - a)[0]
  if (topSource && topSource[1] > stuckArticles.length * 0.3) {
    insights.push(`${topSource[0]} source has ${topSource[1]} stuck articles (${Math.round(topSource[1] / stuckArticles.length * 100)}%)`)
  }

  const veryOldCount = agePattern['>2d'] || 0
  if (veryOldCount > 0) {
    insights.push(`${veryOldCount} articles stuck for over 2 days - indicates severe pipeline issues`)
  }

  return {
    patterns: {
      bySource: sourcePattern,
      byAge: agePattern,
      totalStuck: stuckArticles.length
    },
    insights
  }
}

export async function POST(request: NextRequest) {
  try {
    // Enhanced authentication for cron jobs
    const authHeader = request.headers.get('authorization')
    const userAgent = request.headers.get('user-agent')
    
    const isVercelCron = userAgent === 'vercel-cron/1.0'
    const isValidSecret = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`
    
    console.log(`🔐 Cleanup Authentication: isVercelCron=${isVercelCron}, isValidSecret=${isValidSecret}`)
    
    if (!isVercelCron && !isValidSecret) {
      console.log(`❌ CLEANUP UNAUTHORIZED: userAgent=${userAgent}, hasSecret=${!!process.env.CRON_SECRET}`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const utcTime = now.toISOString()
    const hkTime = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().replace('Z', ' HKT')
    
    console.log('🧹 Starting cleanup of stuck article selections...')
    console.log(`⏰ Execution time: ${utcTime} (UTC) / ${hkTime}`)

    // 1. Find stuck articles (default: >4 hours)
    const stuckArticles = await findStuckSelections(4)
    
    if (stuckArticles.length === 0) {
      console.log('✅ No stuck selections found - pipeline is healthy')
      return NextResponse.json({
        success: true,
        message: 'No stuck selections found',
        stuckCount: 0,
        resetCount: 0
      })
    }

    // 2. Log details about stuck articles
    console.log(`⚠️ Found ${stuckArticles.length} stuck selections:`)
    stuckArticles.slice(0, 5).forEach((article, i) => {
      const selectedAt = article.selection_metadata?.selected_at
      const timeStuck = selectedAt ? getTimeAgo(selectedAt) : 'unknown'
      console.log(`   ${i + 1}. "${article.title?.substring(0, 50)}..." (${article.source}) - stuck ${timeStuck}`)
    })
    
    if (stuckArticles.length > 5) {
      console.log(`   ... and ${stuckArticles.length - 5} more`)
    }

    // 3. Analyze patterns
    const analysis = await analyzeStuckPatterns(stuckArticles)
    
    if (analysis.insights.length > 0) {
      console.log(`📊 Stuck article patterns detected:`)
      analysis.insights.forEach(insight => {
        console.log(`   • ${insight}`)
      })
    }

    // 4. Reset stuck selections
    const resetResult = await resetStuckSelections(stuckArticles)
    
    console.log(`✅ Cleanup complete: Reset ${resetResult.resetCount} stuck selections`)
    console.log('🎯 Fresh articles should now be selectable in next cron run')

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${resetResult.resetCount} stuck selections`,
      stuckCount: stuckArticles.length,
      resetCount: resetResult.resetCount,
      patterns: analysis.patterns,
      insights: analysis.insights,
      examples: stuckArticles.slice(0, 3).map(article => ({
        title: article.title,
        source: article.source,
        stuckSince: article.selection_metadata?.selected_at,
        timeStuck: article.selection_metadata?.selected_at ? getTimeAgo(article.selection_metadata.selected_at) : 'unknown'
      }))
    })

  } catch (error) {
    console.error('❌ Error in stuck selections cleanup:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        stuckCount: 0,
        resetCount: 0
      }, 
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // Return statistics about stuck selections (for monitoring)
    const stuckArticles = await findStuckSelections(4)
    const veryStuckArticles = await findStuckSelections(24) // >24 hours
    
    const analysis = await analyzeStuckPatterns(stuckArticles)
    
    return NextResponse.json({
      configured: true,
      message: 'Stuck selections cleanup endpoint is ready',
      currentStuck: stuckArticles.length,
      severelyStuck: veryStuckArticles.length,
      patterns: analysis.patterns,
      insights: analysis.insights,
      healthStatus: stuckArticles.length === 0 ? 'healthy' : 
                   stuckArticles.length < 5 ? 'warning' : 'critical'
    })
  } catch (error) {
    console.error('Error getting stuck selections statistics:', error)
    return NextResponse.json(
      { 
        configured: false, 
        error: 'Failed to get statistics' 
      }, 
      { status: 500 }
    )
  }
}