import { type NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "../../../../lib/supabase-server"

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Resetting article images to pending for testing...')
    
    // Reset all articles to have pending image status
    const { error } = await supabaseAdmin
      .from('perplexity_news')
      .update({ 
        image_status: 'pending',
        image_url: null,
        image_license: null
      })
      .neq('source', 'Perplexity AI (Fallback)')
    
    if (error) {
      console.error('Error resetting images:', error)
      return NextResponse.json({ error: 'Failed to reset images' }, { status: 500 })
    }
    
    console.log('✅ Reset all article images to pending')
    
    return NextResponse.json({
      success: true,
      message: 'All article images reset to pending for improved search testing'
    })
    
  } catch (error) {
    console.error('Error in reset:', error)
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 })
  }
}