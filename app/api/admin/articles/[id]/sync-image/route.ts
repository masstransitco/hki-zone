import { NextRequest, NextResponse } from 'next/server'
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { imageUrl } = await request.json()
    const articleId = params.id

    if (!articleId) {
      return NextResponse.json({ error: 'Article ID is required' }, { status: 400 })
    }

    // First, get the current article to check if it's AI enhanced and get trilingual batch info
    const { data: currentArticle, error: fetchError } = await supabase
      .from('articles')
      .select('id, is_ai_enhanced, trilingual_batch_id, language_variant, image_url')
      .eq('id', articleId)
      .single()

    if (fetchError) {
      console.error('Error fetching article:', fetchError)
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    // If the article is not AI enhanced or doesn't have a trilingual batch, just update this article
    if (!currentArticle.is_ai_enhanced || !currentArticle.trilingual_batch_id) {
      const { error: updateError } = await supabase
        .from('articles')
        .update({ 
          image_url: imageUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', articleId)

      if (updateError) {
        console.error('Error updating article:', updateError)
        return NextResponse.json({ error: 'Failed to update article' }, { status: 500 })
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Image updated successfully',
        updatedArticles: 1 
      })
    }

    // If it's AI enhanced with a trilingual batch, update all articles in the same batch
    const { data: trilingualArticles, error: batchError } = await supabase
      .from('articles')
      .select('id, language_variant, image_url')
      .eq('trilingual_batch_id', currentArticle.trilingual_batch_id)
      .eq('is_ai_enhanced', true)

    if (batchError) {
      console.error('Error fetching trilingual batch:', batchError)
      return NextResponse.json({ error: 'Failed to fetch trilingual articles' }, { status: 500 })
    }

    if (!trilingualArticles || trilingualArticles.length === 0) {
      // Fallback to single article update
      const { error: updateError } = await supabase
        .from('articles')
        .update({ 
          image_url: imageUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', articleId)

      if (updateError) {
        console.error('Error updating article:', updateError)
        return NextResponse.json({ error: 'Failed to update article' }, { status: 500 })
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Image updated successfully',
        updatedArticles: 1 
      })
    }

    // Update all articles in the trilingual batch
    const updatePromises = trilingualArticles.map(article => 
      supabase
        .from('articles')
        .update({ 
          image_url: imageUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', article.id)
    )

    const updateResults = await Promise.allSettled(updatePromises)
    
    // Count successful updates
    const successfulUpdates = updateResults.filter(result => result.status === 'fulfilled').length
    const failedUpdates = updateResults.filter(result => result.status === 'rejected')

    if (failedUpdates.length > 0) {
      console.error('Some updates failed:', failedUpdates)
    }

    const languages = trilingualArticles.map(a => a.language_variant || 'unknown').join(', ')

    return NextResponse.json({
      success: true,
      message: `Image synchronized across ${successfulUpdates} trilingual articles`,
      updatedArticles: successfulUpdates,
      languages: languages,
      trilingualBatchId: currentArticle.trilingual_batch_id,
      details: {
        totalArticles: trilingualArticles.length,
        successfulUpdates,
        failedUpdates: failedUpdates.length
      }
    })

  } catch (error) {
    console.error('Error in sync-image API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}