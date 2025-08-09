import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { autoProcessArticleImage } from '@/lib/image-processor'
import sharp from 'sharp'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Generate completely new supplementary scene based on article context
function generateGenericScenicPrompt(article: any): string {
  // Shortened article context for API limits
  const title = article?.title ? article.title.slice(0, 80) : ''
  const summary = article?.summary ? article.summary.slice(0, 100) : ''
  
  // Much shorter base prompt
  const basePrompt = title ? `"${title}". ` : ''
  
  // Shorter category-specific prompts
  const categoryPrompts: Record<string, string> = {
    'Politics': 'government building, diplomatic meeting room, civic plaza',
    'Technology': 'tech lab, data center, innovation workspace',
    'Business': 'trading floor, corporate office, industrial facility',
    'Sports': 'training facility, stadium, sports equipment',
    'Health': 'medical facility, research lab, wellness center',
    'Environment': 'renewable energy site, natural landscape, eco project',
    'Entertainment': 'production studio, theater, creative space',
    'Crime': 'courthouse, police station, legal office',
    'Education': 'classroom, library, campus',
    'International': 'port, trade center, diplomatic venue'
  }
  
  // Build concise prompt
  let prompt = basePrompt
  
  // Add category-specific scene
  if (article?.category && categoryPrompts[article.category]) {
    prompt += `Create supplementary ${categoryPrompts[article.category]} scene. `
  } else {
    prompt += 'Create supplementary professional scene. '
  }
  
  // Core instructions (very concise)
  prompt += 'Photorealistic, editorial quality, completely new scene not replicating input, different location and perspective, clean professional composition'
  
  return prompt
}

// Scenic element extraction for generic imagery inspiration
function extractScenicElements(article: any): string[] {
  if (!article?.title && !article?.summary && !article?.content) return []
  
  // Use title, summary, and first part of content for better context
  const text = `${article.title || ''} ${article.summary || ''} ${(article.content || '').slice(0, 500)}`.toLowerCase()
  
  // Scenic themes and environmental elements for generic imagery
  const scenicElements: Record<string, string[]> = {
    // Environmental themes
    'urban': ['cityscape', 'metropolitan architecture', 'urban development'],
    'nature': ['natural landscape', 'environmental beauty', 'outdoor scenery'],
    'technology': ['modern innovation', 'digital transformation', 'contemporary design'],
    'business': ['corporate environment', 'professional setting', 'commercial space'],
    'education': ['academic atmosphere', 'learning environment', 'institutional setting'],
    'health': ['wellness theme', 'healthcare environment', 'medical facility'],
    'sports': ['athletic environment', 'fitness theme', 'recreational facility'],
    'culture': ['cultural heritage', 'artistic environment', 'creative space'],
    
    // Mood and atmosphere
    'meeting': ['conference setting', 'collaborative space', 'professional gathering'],
    'innovation': ['cutting-edge design', 'modern technology', 'forward-thinking'],
    'growth': ['development theme', 'progress imagery', 'advancement concept'],
    'community': ['social connection', 'public space', 'civic engagement'],
    'sustainability': ['green technology', 'environmental responsibility', 'eco-friendly'],
    'leadership': ['authority theme', 'executive setting', 'decision-making environment'],
    
    // Architectural themes
    'building': ['architectural elegance', 'structural design', 'construction theme'],
    'office': ['workplace environment', 'business facility', 'corporate setting'],
    'facility': ['institutional architecture', 'public building', 'service facility'],
    'center': ['community hub', 'central facility', 'gathering place'],
    
    // Activity themes
    'research': ['scientific environment', 'investigation theme', 'analytical setting'],
    'development': ['construction theme', 'progress imagery', 'building activity'],
    'service': ['customer focus', 'public service', 'assistance theme'],
    'security': ['safety theme', 'protection environment', 'secure facility']
  }
  
  const foundElements: string[] = []
  
  for (const [keyword, themes] of Object.entries(scenicElements)) {
    if (text.includes(keyword)) {
      foundElements.push(...themes.slice(0, 1)) // Take top theme per category
    }
  }
  
  return foundElements
}

// Creative generation parameters - optimized for NEW supplementary scenes
function getCreativeStrength(article: any): number {
  // Much higher strength to create completely NEW scenes (not replicas)
  const creativeStrengths: Record<string, number> = {
    'Politics': 0.85,     // Highly original political/civic scenes
    'Crime': 0.80,        // New justice/legal perspectives
    'Business': 0.85,     // Fresh business/economic angles
    'Technology': 0.90,   // Innovative tech visualizations
    'Sports': 0.85,       // Original athletic perspectives
    'Entertainment': 0.90,// Creative cultural interpretations
    'Health': 0.80,       // New healthcare visualizations
    'Environment': 0.95,  // Highly creative environmental scenes
    'Education': 0.85,    // Fresh educational perspectives
    'International': 0.85 // Original global/diplomatic scenes
  }
  
  return creativeStrengths[article?.category] || 0.85 // High creative default for originality
}

function getCreativeSteps(article: any): number {
  // Balanced steps for quality while allowing creative interpretation
  const creativeSteps: Record<string, number> = {
    'Politics': 35,       // Clean institutional imagery
    'Crime': 35,          // Professional legal environments
    'Business': 30,       // Standard corporate quality
    'Technology': 30,     // Modern tech environments
    'Sports': 30,         // Clean athletic settings
    'Entertainment': 35,  // Quality cultural spaces
    'Health': 35,         // Professional medical environments
    'Environment': 30,    // Natural/urban scenes
    'Education': 30,      // Academic facility imagery
    'International': 35   // Professional governmental settings
  }
  
  return creativeSteps[article?.category] || 30 // Efficient quality default
}

function getCreativeGuidance(article: any): number {
  // Lower guidance for more creative freedom in generating NEW scenes
  const creativeGuidance: Record<string, number> = {
    'Politics': 5.5,      // More freedom for civic scene creation
    'Crime': 5.5,         // Flexible justice perspective creation
    'Business': 5.0,      // Creative business angle freedom
    'Technology': 4.5,    // High flexibility for tech innovation
    'Sports': 5.0,        // Creative athletic scene freedom
    'Entertainment': 4.5, // Maximum creative cultural flexibility
    'Health': 5.5,        // Flexible healthcare visualization
    'Environment': 4.0,   // Maximum creative environmental freedom
    'Education': 5.0,     // Creative educational scene flexibility
    'International': 5.5  // Flexible global perspective creation
  }
  
  return creativeGuidance[article?.category] || 5.0 // Lower default for creativity
}

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, articleId } = await request.json()

    if (!imageUrl || !articleId) {
      return NextResponse.json(
        { error: 'Image URL and Article ID are required' },
        { status: 400 }
      )
    }

    // Fetch article details for enhanced prompt generation
    console.log('Fetching article details for enhanced prompt...')
    const { data: article, error: fetchError } = await supabase
      .from('articles')
      .select('id, title, summary, category, content')
      .eq('id', articleId)
      .single()

    if (fetchError || !article) {
      console.warn('Could not fetch article for prompt enhancement:', fetchError)
      // Continue with basic prompt if article fetch fails
    }

    // Generate supplementary scene prompt based on article content  
    const scenicPrompt = article ? generateGenericScenicPrompt(article) : 
      "Create a completely new original scene that supplements the article, photorealistic professional photography, fresh perspective, do not replicate reference image"
    
    // Much shorter instructions
    const sceneCreationInstructions = "Use input only for mood/color reference, create entirely different supplementary scene, new location and angle, no people or brands, professional editorial photography"
    
    const finalPrompt = scenicPrompt + ", " + sceneCreationInstructions
    
    console.log('Article context being used:', {
      title: article?.title?.slice(0, 100) || 'No title',
      summary: article?.summary?.slice(0, 100) || 'No summary',
      contentLength: article?.content?.length || 0,
      category: article?.category || 'Unknown'
    })
    
    console.log('Final prompt length:', finalPrompt.length, 'characters')
    console.log('Final prompt:', finalPrompt)
    console.log('Creative generation parameters:', {
      strength: getCreativeStrength(article),
      steps: getCreativeSteps(article), 
      guidance_scale: getCreativeGuidance(article),
      category: article?.category || 'Unknown'
    })

    // Fetch the image and resize it for API consumption
    console.log('Fetching image from URL:', imageUrl)
    const imageResponse = await fetch(imageUrl)
    
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.statusText}`)
    }

    const originalBuffer = await imageResponse.arrayBuffer()
    
    // Resize and optimize the image to reduce base64 size
    // GetImg API works better with smaller images (512x512 is common for img2img)
    console.log('Resizing and optimizing image for API...')
    const resizedBuffer = await sharp(Buffer.from(originalBuffer))
      .resize(512, 512, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({
        quality: 85, // Good quality while keeping file size down
        mozjpeg: true // Better compression
      })
      .toBuffer()
    
    // Convert resized image to base64
    const base64Image = resizedBuffer.toString('base64')
    
    console.log('Original image size:', originalBuffer.byteLength, 'bytes')
    console.log('Resized image size:', resizedBuffer.length, 'bytes')
    console.log('Base64 length:', base64Image.length, 'characters')

    // Call getimg.ai API with base64 image
    // Using the correct endpoint and model for stable diffusion XL
    const apiResponse = await fetch('https://api.getimg.ai/v1/stable-diffusion-xl/image-to-image', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GETIMG_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Don't include model parameter - it's determined by the endpoint
        // Use plain base64 without data URI prefix
        image: base64Image,
        prompt: finalPrompt,
        negative_prompt: "copy of input, same scene, people, faces, text, logos, brands",
        width: 1024,
        height: 1024, // SDXL works better with square images
        strength: getCreativeStrength(article),
        steps: getCreativeSteps(article),
        guidance_scale: getCreativeGuidance(article), // Use guidance_scale instead of guidance
        output_format: 'jpeg' // Use output_format instead of response_format
      }),
    })

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text()
      console.error('GetImg API error:', errorText)
      return NextResponse.json(
        { error: `Failed to generate image: ${errorText}` },
        { status: apiResponse.status }
      )
    }

    const data = await apiResponse.json()
    console.log('GetImg.ai API response:', JSON.stringify(data, null, 2))
    
    // Handle different possible response formats
    // The API returns base64 image data directly
    let generatedImageData = data.image || data.images?.[0] || data.output
    
    if (!generatedImageData) {
      console.error('No image data found in response:', data)
      throw new Error('Generated image data not found in API response')
    }
    
    // Convert base64 to buffer if needed
    let generatedImageBuffer: ArrayBuffer
    
    if (generatedImageData.startsWith('data:')) {
      // Extract base64 from data URI
      const base64Data = generatedImageData.split(',')[1]
      generatedImageBuffer = Buffer.from(base64Data, 'base64')
      console.log('Converted base64 data URI to buffer')
    } else if (generatedImageData.startsWith('http')) {
      // If it's a URL, download the image
      console.log('Downloading generated image from URL:', generatedImageData)
      const downloadResponse = await fetch(generatedImageData)
      if (!downloadResponse.ok) {
        throw new Error('Failed to download generated image')
      }
      generatedImageBuffer = await downloadResponse.arrayBuffer()
    } else {
      // Assume it's raw base64
      generatedImageBuffer = Buffer.from(generatedImageData, 'base64')
      console.log('Converted raw base64 to buffer')
    }
    
    // Generate a unique filename for the generated image
    const timestamp = Date.now()
    const filename = `ai-generated-${articleId}-${timestamp}.jpg`
    const filePath = `articles/${articleId}/${filename}`
    
    console.log('Storing generated image in Supabase:', filePath)
    
    // Upload the generated image to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('article-images')
      .upload(filePath, generatedImageBuffer, {
        contentType: 'image/jpeg',
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
    
    // Update the article with the new image URL (using correct database column name)
    const { error: updateError } = await supabase
      .from('articles')
      .update({ image_url: publicUrl })
      .eq('id', articleId)
    
    if (updateError) {
      console.error('Article update error:', updateError)
      throw new Error(`Failed to update article: ${updateError.message}`)
    }
    
    console.log('Article updated successfully with new AI-generated image')
    
    // Auto-process the AI-generated image for social media previews
    autoProcessArticleImage(articleId, publicUrl, 'articles').catch(error => {
      console.error(`Failed to process AI-generated image for article ${articleId}:`, error)
    })
    
    return NextResponse.json({ 
      success: true,
      imageUrl: publicUrl,
      message: 'AI image generated and article updated successfully'
    })
  } catch (error) {
    console.error('Image generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate image' },
      { status: 500 }
    )
  }
}