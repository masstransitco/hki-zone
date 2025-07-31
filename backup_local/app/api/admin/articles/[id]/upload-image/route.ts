import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const articleId = params.id
    
    // Verify article exists and is not deleted
    const { data: article, error: articleError } = await supabase
      .from("articles")
      .select("id, title")
      .eq("id", articleId)
      .single()
    
    if (articleError || !article) {
      return NextResponse.json(
        { error: "Article not found or already deleted" },
        { status: 404 }
      )
    }
    
    // Generate a unique filename
    const timestamp = Date.now()
    const filename = `articles/${articleId}/${timestamp}-image.jpg`
    
    // Create a signed upload URL
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("article-images")
      .createSignedUploadUrl(filename)
    
    if (uploadError) {
      console.error("Error creating signed upload URL:", uploadError)
      
      // If bucket doesn't exist, provide helpful error
      if (uploadError.message.includes("bucket") || uploadError.message.includes("not found") || uploadError.message.includes("does not exist")) {
        return NextResponse.json(
          { 
            error: "Storage bucket not configured",
            details: "Please create an 'article-images' bucket in Supabase Storage",
            instructions: [
              "1. Go to your Supabase Dashboard",
              "2. Navigate to Storage section",
              "3. Click 'Create a new bucket'",
              "4. Name it 'article-images'",
              "5. Set it to 'Public' if you want images to be publicly accessible",
              "6. Save the bucket"
            ]
          },
          { status: 400 }
        )
      }
      
      return NextResponse.json(
        { error: "Failed to create upload URL", details: uploadError.message },
        { status: 500 }
      )
    }
    
    // Get the public URL for the file
    const { data: { publicUrl } } = supabase.storage
      .from("article-images")
      .getPublicUrl(filename)
    
    return NextResponse.json({
      uploadUrl: uploadData.signedUrl,
      token: uploadData.token,
      path: uploadData.path,
      publicUrl,
      maxFileSize: MAX_FILE_SIZE,
      needsProcessing: true,
      instructions: {
        method: "PUT",
        headers: {
          "x-upsert": "true", // Overwrite if exists
        },
        note: "Upload the file directly to the uploadUrl using PUT method"
      }
    })
    
  } catch (error) {
    console.error("Error in POST /api/admin/articles/[id]/upload-image:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}