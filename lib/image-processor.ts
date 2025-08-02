import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface ProcessedImages {
  original: string
  optimized: string
  whatsapp: string
}

export async function processArticleImage(articleId: string, imageUrl: string): Promise<ProcessedImages | null> {
  try {
    console.log(`🔧 Processing image for article ${articleId}: ${imageUrl.substring(0, 80)}...`)

    // Download the image with timeout and user agent
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    })

    if (!response.ok) {
      throw new Error(`Failed to download image: HTTP ${response.status}`)
    }

    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.startsWith('image/')) {
      throw new Error(`Invalid content type: ${contentType}`)
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer())
    console.log(`📥 Downloaded image: ${(imageBuffer.length / 1024).toFixed(1)}KB`)

    // Process images in parallel
    const [optimizedBuffer, whatsappBuffer] = await Promise.all([
      // Optimized for general social media (1200x630)
      sharp(imageBuffer)
        .resize(1200, 630, {
          fit: "cover",
          position: "center"
        })
        .jpeg({ quality: 85, progressive: true })
        .toBuffer(),
      
      // Optimized for WhatsApp (800x800)
      sharp(imageBuffer)
        .resize(800, 800, {
          fit: "cover",
          position: "center"
        })
        .jpeg({ quality: 80, progressive: true })
        .toBuffer()
    ])

    console.log(`🔧 Processed: ${(optimizedBuffer.length / 1024).toFixed(1)}KB optimized, ${(whatsappBuffer.length / 1024).toFixed(1)}KB whatsapp`)

    // Upload processed images to Supabase
    const timestamp = Date.now()
    const basePath = `articles/${articleId}/processed`
    
    const uploadPromises = [
      supabase.storage
        .from("article-images")
        .upload(`${basePath}/${timestamp}-optimized.jpg`, optimizedBuffer, {
          contentType: "image/jpeg",
          upsert: true
        }),
      
      supabase.storage
        .from("article-images")
        .upload(`${basePath}/${timestamp}-whatsapp.jpg`, whatsappBuffer, {
          contentType: "image/jpeg",
          upsert: true
        })
    ]
    
    const [optimizedUpload, whatsappUpload] = await Promise.all(uploadPromises)
    
    if (optimizedUpload.error || whatsappUpload.error) {
      throw new Error(`Upload failed: ${optimizedUpload.error?.message || whatsappUpload.error?.message}`)
    }
    
    // Get public URLs
    const { data: { publicUrl: optimizedUrl } } = supabase.storage
      .from("article-images")
      .getPublicUrl(optimizedUpload.data.path)
    
    const { data: { publicUrl: whatsappUrl } } = supabase.storage
      .from("article-images")
      .getPublicUrl(whatsappUpload.data.path)
    
    const processedImages: ProcessedImages = {
      original: imageUrl,
      optimized: optimizedUrl,
      whatsapp: whatsappUrl
    }

    console.log(`✅ Images uploaded and ready for social media previews`)
    return processedImages

  } catch (error) {
    console.error(`❌ Failed to process image for article ${articleId}:`, error)
    return null
  }
}

export async function updateArticleWithProcessedImages(
  articleId: string, 
  processedImages: ProcessedImages,
  table: 'articles' | 'perplexity_news' = 'articles'
): Promise<boolean> {
  try {
    const imageMetadata = {
      original: processedImages.original,
      optimized: processedImages.optimized,
      whatsapp: processedImages.whatsapp,
      processed_at: new Date().toISOString()
    }

    let updateData: any
    if (table === 'articles') {
      updateData = {
        image_url: processedImages.optimized, // Use optimized as primary image
        image_metadata: imageMetadata
      }
    } else if (table === 'perplexity_news') {
      // For perplexity table, just update the image_url for now
      updateData = {
        image_url: processedImages.optimized
      }
    }

    const { error } = await supabase
      .from(table)
      .update(updateData)
      .eq('id', articleId)

    if (error) {
      console.error(`❌ Failed to update ${table} with processed images:`, error)
      return false
    }

    console.log(`✅ Updated ${table} with processed image metadata`)
    return true

  } catch (error) {
    console.error(`❌ Error updating article with processed images:`, error)
    return false
  }
}

/**
 * Main function to process and update article images
 * This should be called whenever a new article with an image is created
 */
export async function autoProcessArticleImage(
  articleId: string, 
  imageUrl: string,
  table: 'articles' | 'perplexity_news' = 'articles',
  forceReprocess: boolean = false
): Promise<boolean> {
  try {
    // Don't process if no image URL
    if (!imageUrl) {
      return false
    }

    // Check if already processed (has image_metadata for articles table)
    // Skip this check if forceReprocess is true
    if (table === 'articles' && !forceReprocess) {
      const { data: existing } = await supabase
        .from('articles')
        .select('image_metadata')
        .eq('id', articleId)
        .single()

      if (existing?.image_metadata && typeof existing.image_metadata === 'object') {
        console.log(`⏭️  Article ${articleId} already has processed images, skipping`)
        return true
      }
    } else if (forceReprocess) {
      console.log(`🔄 Force reprocessing image for article ${articleId}`)
    }

    // Process the image
    const processedImages = await processArticleImage(articleId, imageUrl)
    
    if (!processedImages) {
      console.warn(`⚠️ Failed to process image for article ${articleId}`)
      return false
    }

    // Update the article with processed images
    const updated = await updateArticleWithProcessedImages(articleId, processedImages, table)
    
    if (updated) {
      console.log(`🎉 Successfully auto-processed image for article ${articleId}`)
      return true
    } else {
      console.warn(`⚠️ Failed to update article ${articleId} with processed images`)
      return false
    }

  } catch (error) {
    console.error(`❌ Auto-process failed for article ${articleId}:`, error)
    return false
  }
}