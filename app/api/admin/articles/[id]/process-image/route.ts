import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import sharp from "sharp"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface ProcessedImages {
  original: string
  optimized: string
  whatsapp: string
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { imageUrl } = await req.json()
    
    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 }
      )
    }
    
    const articleId = params.id
    
    // Download the image
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error("Failed to download image")
    }
    
    const imageBuffer = Buffer.from(await response.arrayBuffer())
    
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
      throw new Error("Failed to upload processed images")
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
    
    // Update article with processed image URLs
    const { error: updateError } = await supabase
      .from("articles")
      .update({
        image_url: optimizedUrl,
        image_metadata: processedImages
      })
      .eq("id", articleId)
    
    if (updateError) {
      console.error("Error updating article:", updateError)
      
      // If it's a schema cache issue, try updating without image_metadata
      if (updateError.message.includes("image_metadata")) {
        console.log("Schema cache issue detected, updating image_url only")
        const { error: fallbackError } = await supabase
          .from("articles")
          .update({
            image_url: optimizedUrl
          })
          .eq("id", articleId)
        
        if (fallbackError) {
          console.error("Fallback update also failed:", fallbackError)
        } else {
          console.log("Successfully updated image_url (without metadata)")
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      images: processedImages,
      sizes: {
        optimized: `${(optimizedBuffer.length / 1024).toFixed(2)}KB`,
        whatsapp: `${(whatsappBuffer.length / 1024).toFixed(2)}KB`
      }
    })
    
  } catch (error) {
    console.error("Error processing image:", error)
    return NextResponse.json(
      { error: "Failed to process image", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}