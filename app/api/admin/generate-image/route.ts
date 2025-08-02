import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { autoProcessArticleImage } from '@/lib/image-processor'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Generic scenic image generation using reference elements
function generateGenericScenicPrompt(article: any): string {
  // Base generic scene creation prompt
  const baseScenic = "photorealistic generic scene, professional stock photography style, clean composition, commercial quality imagery, suitable for editorial use"
  
  // Scenic generation prompts for different content types
  const scenicPrompts: Record<string, string> = {
    'Politics': `${baseScenic}, modern government building exterior, professional conference room, or contemporary office meeting space, neutral political imagery, institutional architecture`,
    'Technology': `${baseScenic}, modern tech office environment, sleek conference room, contemporary workspace, clean minimalist design, professional business setting`,
    'Business': `${baseScenic}, executive boardroom, modern corporate lobby, professional office space, contemporary business environment, clean architectural lines`,
    'Sports': `${baseScenic}, modern sports facility, athletic field or court, fitness center, stadium exterior, sports equipment in clean setting`,
    'Health': `${baseScenic}, modern medical facility exterior, clean hospital corridor, contemporary healthcare environment, professional medical setting`,
    'Environment': `${baseScenic}, natural landscape, urban park, sustainable architecture, environmental conservation scene, clean outdoor setting`,
    'Entertainment': `${baseScenic}, modern theater or venue exterior, contemporary cultural space, arts facility, entertainment district street view`,
    'Crime': `${baseScenic}, courthouse exterior, modern justice building, professional legal environment, institutional architecture`,
    'Education': `${baseScenic}, modern university campus, contemporary library, educational facility exterior, academic institution architecture`,
    'International': `${baseScenic}, modern diplomatic building, international conference center, contemporary institutional architecture, professional governmental facility`
  }
  
  // Default generic scene prompt
  let scenicPrompt = `Generate a generic ${baseScenic}`
  
  // Apply category-specific scenic enhancement if available
  if (article?.category && scenicPrompts[article.category]) {
    scenicPrompt = `Generate a ${scenicPrompts[article.category]}`
  }
  
  // Extract scenic elements from reference image context
  const scenicKeywords = extractScenicElements(article)
  if (scenicKeywords.length > 0) {
    scenicPrompt += `, incorporating themes of: ${scenicKeywords.slice(0, 3).join(', ')}`
  }
  
  // Generic scene quality modifiers
  const qualityModifiers = [
    "professional stock photography",
    "clean commercial composition", 
    "editorial-appropriate imagery",
    "neutral perspective",
    "contemporary aesthetic",
    "high production value",
    "suitable for publication",
    "generic representative imagery",
    "broad appeal composition"
  ].join(", ")
  
  scenicPrompt += `, ${qualityModifiers}`
  
  // Elements to avoid for generic imagery
  const genericAvoidList = [
    "specific identifiable people",
    "recognizable faces", 
    "branded elements",
    "copyrighted content",
    "specific locations",
    "identifiable architecture",
    "personal details",
    "controversial imagery"
  ]
  
  scenicPrompt += `, avoiding ${genericAvoidList.slice(0, 5).join(", ")}`
  
  return scenicPrompt
}

// Scenic element extraction for generic imagery inspiration
function extractScenicElements(article: any): string[] {
  if (!article?.title && !article?.summary) return []
  
  const text = `${article.title || ''} ${article.summary || ''}`.toLowerCase()
  
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

// Generic creative generation parameters - optimized for scenic inspiration
function getCreativeStrength(article: any): number {
  // Higher strength for creative interpretation while maintaining reference themes
  const creativeStrengths: Record<string, number> = {
    'Politics': 0.65,     // Creative political/institutional imagery
    'Crime': 0.60,        // Generic legal/judicial environments
    'Business': 0.70,     // Creative corporate/office settings
    'Technology': 0.75,   // Modern tech environments with flexibility
    'Sports': 0.70,       // Generic athletic/fitness facilities
    'Entertainment': 0.75,// Creative cultural/entertainment spaces
    'Health': 0.65,       // Clean medical/wellness environments
    'Environment': 0.80,  // Creative natural/urban landscapes
    'Education': 0.70,    // Generic academic/institutional settings
    'International': 0.65 // Generic diplomatic/governmental imagery
  }
  
  return creativeStrengths[article?.category] || 0.70 // Balanced creative default
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
  // Moderate guidance for balanced prompt following with creative freedom
  const creativeGuidance: Record<string, number> = {
    'Politics': 7.5,      // Balanced institutional guidance
    'Crime': 7.5,         // Professional legal environment adherence
    'Business': 7.0,      // Standard corporate prompt following
    'Technology': 6.5,    // Flexible tech environment creation
    'Sports': 7.0,        // Athletic facility prompt adherence
    'Entertainment': 6.5, // Creative cultural space flexibility
    'Health': 7.5,        // Professional medical adherence
    'Environment': 6.0,   // Natural creative landscape flexibility
    'Education': 7.0,     // Academic setting prompt following
    'International': 7.5  // Professional governmental adherence
  }
  
  return creativeGuidance[article?.category] || 7.0 // Balanced default
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

    // Generate generic scenic prompt based on article content  
    const scenicPrompt = article ? generateGenericScenicPrompt(article) : 
      "Generate a photorealistic generic scene, professional stock photography style, clean composition, commercial quality imagery, suitable for editorial use"
    
    // Enhanced scene creation and cleaning instructions
    const sceneCreationInstructions = [
      // Generic scene requirements
      "create entirely new generic scene inspired by reference",
      "professional stock photography composition",
      "editorial-appropriate commercial imagery",
      "clean modern aesthetic suitable for publication",
      
      // Reference extraction without replication
      "draw scenic inspiration from reference image themes",
      "interpret environmental and architectural elements generically", 
      "maintain reference mood and atmosphere in new composition",
      "use reference for color palette and lighting inspiration",
      
      // Content sanitization  
      "completely avoid specific identifiable people or faces",
      "exclude all branded elements, logos, and corporate identities",
      "remove any text, typography, captions, or graphic overlays",
      "avoid recognizable specific locations or unique architecture",
      
      // Final composition specifications
      "single unified scene with consistent lighting",
      "professional depth of field and composition",
      "neutral perspective suitable for broad editorial use",
      "contemporary aesthetic with commercial appeal"
    ].join(", ")
    
    const finalPrompt = scenicPrompt + ", " + sceneCreationInstructions
    
    console.log('Generated scenic prompt:', finalPrompt)
    console.log('Creative generation parameters:', {
      strength: getCreativeStrength(article),
      steps: getCreativeSteps(article), 
      guidance: getCreativeGuidance(article),
      category: article?.category || 'Unknown'
    })

    // Fetch the image and convert to base64
    console.log('Fetching image from URL:', imageUrl)
    const imageResponse = await fetch(imageUrl)
    
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.statusText}`)
    }

    const imageBuffer = await imageResponse.arrayBuffer()
    const base64Image = Buffer.from(imageBuffer).toString('base64')
    
    console.log('Image converted to base64, length:', base64Image.length)

    // Call getimg.ai API with base64 image
    const apiResponse = await fetch('https://api.getimg.ai/v1/stable-diffusion/image-to-image', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GETIMG_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'stable-diffusion-v1-5',
        image: base64Image,
        prompt: finalPrompt,
        negative_prompt: "specific people, identifiable faces, recognizable individuals, branded elements, corporate logos, news media branding, text overlays, captions, headlines, watermarks, specific locations, identifiable architecture, copyrighted content, controversial imagery, multiple photo layouts, collage compositions",
        width: 1024,
        height: 768,
        strength: getCreativeStrength(article),
        steps: getCreativeSteps(article),
        guidance: getCreativeGuidance(article),
        response_format: 'url'
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
    let generatedImageUrl = data.image_url || data.url || data.image || data.output
    
    if (!generatedImageUrl) {
      console.error('No image URL found in response:', data)
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