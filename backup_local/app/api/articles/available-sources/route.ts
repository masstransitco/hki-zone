import { NextResponse } from "next/server"
import { checkDatabaseSetup } from "@/lib/supabase"
import { supabaseAdmin } from "@/lib/supabase-server"

export const dynamic = 'force-dynamic'

// Hardcoded fallback sources when database is not available
const FALLBACK_SOURCES = [
  "Bloomberg",
  "SCMP", 
  "HKFP",
  "RTHK",
  "HK01",
  "TVB",
  "The Standard",
  "Now News",
  "Hong Kong Government News"
]

export async function GET() {
  try {
    console.log("Available sources API called, checking database setup...")
    
    // Check if database is set up
    const isDatabaseReady = await checkDatabaseSetup()
    
    if (!isDatabaseReady) {
      console.warn("Database not set up, using fallback sources")
      return NextResponse.json({
        sources: FALLBACK_SOURCES,
        usingFallbackData: true
      })
    }

    // Query database for distinct sources with articles
    // Use raw SQL to get distinct sources to avoid row limits
    const { data, error } = await supabaseAdmin
      .from('articles')
      .select('source')
      .is('deleted_at', null) // Only include non-deleted articles
      .not('source', 'is', null) // Exclude articles without source
      .order('created_at', { ascending: false }) // Order by newest first
      .limit(5000) // Set a reasonable limit to get recent sources
    
    if (error) {
      console.error("Error fetching sources from database:", error)
      return NextResponse.json({
        sources: FALLBACK_SOURCES,
        usingFallbackData: true
      })
    }

    // Get unique sources from database
    const uniqueSources = new Set<string>()
    
    data?.forEach(row => {
      if (row.source) {
        // Clean up source name
        const cleanSource = row.source.replace(' (AI Enhanced)', '').replace(/ \+ AI$/, '').trim()
        uniqueSources.add(cleanSource)
      }
    })

    const availableSources = Array.from(uniqueSources).sort()
    
    console.log(`Found ${availableSources.length} unique sources in database:`, availableSources)
    
    return NextResponse.json({
      sources: availableSources,
      usingFallbackData: false
    })
    
  } catch (error) {
    console.error("Error in available sources API:", error)
    
    return NextResponse.json({
      sources: FALLBACK_SOURCES,
      usingFallbackData: true
    })
  }
}