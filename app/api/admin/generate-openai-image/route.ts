import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import sharp from 'sharp'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, articleId } = await request.json()

    if (!imageUrl || !articleId) {
      return NextResponse.json(
        { error: 'Image URL and Article ID are required' },
        { status: 400 }
      )
    }

    // Fetch article details for context
    console.log('Fetching article details...')
    const { data: article, error: fetchError } = await supabase
      .from('articles')
      .select('id, title, summary, category, content')
      .eq('id', articleId)
      .single()

    if (fetchError || !article) {
      console.warn('Could not fetch article for context:', fetchError)
    }

    // Professional newsroom prompt for image cleanup and enhancement
    const prompt = "Clean up and prepare this photo for professional news use.\n" +
      "• Remove all overlaid text, captions, watermarks and visible brand logos without altering the underlying scene.\n" +
      "• Preserve the identity, pose and expression of every person, as well as the original composition of objects and background.\n" +
      "• Enhance sharpness, balanced exposure and natural colours for print-quality clarity.\n" +
      "• Crop or extend the canvas to 16:9 (1792 × 1024 px) while keeping proportions realistic.\n" +
      "• Apply a subtle newsroom-neutral grade (no filters, no stylisation).\n" +
      "• Output a single, photorealistic PNG suitable for front-page editorial use."

    console.log('Calling OpenAI DALL-E 3 API...')
    
    // First, fetch the image and convert to a File-like object
    console.log('Fetching image from URL:', imageUrl)
    const imageResponse = await fetch(imageUrl)
    
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.statusText}`)
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
    
    // Process image with sharp to ensure it's PNG with alpha channel and under 4MB
    console.log('Processing image to meet OpenAI requirements...')
    let processedImage = await sharp(imageBuffer)
      .resize({
        width: 1024,
        height: 1024,
        fit: 'inside',
        withoutEnlargement: true
      })
      .png({ compressionLevel: 9 }) // Convert to PNG with max compression
      .ensureAlpha() // Ensure alpha channel (RGBA)
      .toBuffer()
    
    // Check file size
    let sizeInMB = processedImage.length / (1024 * 1024)
    console.log(`Processed image size: ${sizeInMB.toFixed(2)} MB`)
    
    if (sizeInMB > 4) {
      // If still too large, resize more aggressively
      processedImage = await sharp(imageBuffer)
        .resize({
          width: 800,
          height: 800,
          fit: 'inside',
          withoutEnlargement: true
        })
        .png({ compressionLevel: 9 })
        .ensureAlpha()
        .toBuffer()
      
      sizeInMB = processedImage.length / (1024 * 1024)
      console.log(`Resized image size: ${sizeInMB.toFixed(2)} MB`)
      
      if (sizeInMB > 4) {
        throw new Error('Image is too large even after compression. Please use a smaller image.')
      }
    }
    
    // Create a File object from the processed buffer
    const imageBlob = new Blob([processedImage], { type: 'image/png' })
    const imageFile = new File([imageBlob], 'image.png', { type: 'image/png' })

    // Call OpenAI DALL-E 2 API for image editing
    const response = await openai.images.edit({
      image: imageFile,
      prompt: prompt,
      model: "dall-e-2", // DALL-E 2 is used for image editing
      n: 1,
      size: "1024x1024",
      response_format: "url"
    })

    const generatedImageUrl = response.data[0]?.url
    
    if (!generatedImageUrl) {
      console.error('No image URL found in OpenAI response:', response)
      throw new Error('Generated image URL not found in API response')
    }
    
    console.log('Generated image URL:', generatedImageUrl)
    
    // Download the generated image
    const generatedImageResponse = await fetch(generatedImageUrl)
    if (!generatedImageResponse.ok) {
      throw new Error('Failed to download generated image')
    }
    
    const generatedImageBuffer = await generatedImageResponse.arrayBuffer()
    
    // Generate a unique filename for the generated image
    const timestamp = Date.now()
    const filename = `openai-enhanced-${articleId}-${timestamp}.png`
    const filePath = `articles/${articleId}/${filename}`
    
    console.log('Storing generated image in Supabase:', filePath)
    
    // Upload the generated image to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('article-images')
      .upload(filePath, generatedImageBuffer, {
        contentType: 'image/png',
        upsert: true
      })
    
    if (uploadError) {
      console.error('Supabase upload error:', uploadError)
      throw new Error(`Failed to store generated image: ${uploadError.message}`)
    }
    
    // Get the public URL for the stored image
    const { data: { publicUrl } } = supabase.storage
      .from('article-images')
      .getPublicUrl(filePath)
    
    console.log('Generated image stored at:', publicUrl)
    
    // Update the article with the new image URL
    const { error: updateError } = await supabase
      .from('articles')
      .update({ image_url: publicUrl })
      .eq('id', articleId)
    
    if (updateError) {
      console.error('Article update error:', updateError)
      throw new Error(`Failed to update article: ${updateError.message}`)
    }
    
    console.log('Article updated successfully with OpenAI-enhanced image')
    
    return NextResponse.json({ 
      success: true,
      imageUrl: publicUrl,
      message: 'OpenAI image enhancement completed successfully'
    })
  } catch (error) {
    console.error('OpenAI image generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate image' },
      { status: 500 }
    )
  }
}