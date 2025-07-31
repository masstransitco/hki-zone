import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Validation schema for PATCH request body
const UpdateArticleSchema = z.object({
  title: z.string().min(4, "Title must be at least 4 characters").optional(),
  summary: z.string().optional(),
  content: z.string().optional(),
  language: z.enum(["en", "zh-TW", "zh-CN"]).nullable().optional(),
  imageUrl: z.string().url("Invalid image URL").nullable().optional(),
  category: z.string().optional(),
  ai_summary: z.string().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    
    // Validate request body
    const validationResult = UpdateArticleSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    const updateData = validationResult.data
    
    // Map frontend field names to database column names
    const dbUpdateData: any = {
      updated_at: new Date().toISOString(),
    }
    
    if (updateData.title !== undefined) dbUpdateData.title = updateData.title
    if (updateData.summary !== undefined) dbUpdateData.summary = updateData.summary
    if (updateData.content !== undefined) dbUpdateData.content = updateData.content
    if (updateData.language !== undefined) dbUpdateData.language = updateData.language
    if (updateData.imageUrl !== undefined) dbUpdateData.image_url = updateData.imageUrl
    if (updateData.category !== undefined) dbUpdateData.category = updateData.category
    if (updateData.ai_summary !== undefined) dbUpdateData.ai_summary = updateData.ai_summary

    // Check which columns exist before updating
    const { data: columnsCheck } = await supabase
      .from('articles')
      .select('*')
      .limit(1)
    
    const hasLanguageColumn = columnsCheck && columnsCheck[0] && 'language' in columnsCheck[0]
    
    // Remove language from update if column doesn't exist
    if (!hasLanguageColumn && 'language' in dbUpdateData) {
      console.warn('Language column does not exist in database, skipping language update')
      delete dbUpdateData.language
    }
    
    // Update the article
    const { data, error } = await supabase
      .from("articles")
      .update(dbUpdateData)
      .eq("id", params.id)
      .select()
      .single()

    if (error) {
      console.error("Error updating article:", error)
      
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Article not found or already deleted" },
          { status: 404 }
        )
      }
      
      // Handle missing column errors
      if (error.code === "PGRST204" && error.message.includes("column")) {
        const missingColumn = error.message.match(/column '(\w+)'/)?.[1]
        return NextResponse.json(
          { 
            error: `Database schema is outdated. Missing column: ${missingColumn}`,
            details: "Please run database migrations to update the schema.",
            migrationUrl: "/api/admin/database/status"
          },
          { status: 400 }
        )
      }
      
      return NextResponse.json(
        { error: "Failed to update article", details: error.message },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: "Article not found or already deleted" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ok: true,
      article: {
        id: data.id,
        title: data.title,
        summary: data.summary,
        content: data.content,
        language: data.language || 'en',
        imageUrl: data.image_url,
        category: data.category,
        updatedAt: data.updated_at,
      },
      warning: !hasLanguageColumn ? 'Language column not available in database' : undefined
    })

  } catch (error) {
    console.error("Error in PATCH /api/admin/articles/[id]:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Soft delete - just set deleted_at timestamp
    const { data, error } = await supabase
      .from("articles")
      .update({ 
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", params.id)
      .select()
      .single()

    if (error) {
      console.error("Error deleting article:", error)
      
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Article not found or already deleted" },
          { status: 404 }
        )
      }
      
      return NextResponse.json(
        { error: "Failed to delete article", details: error.message },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: "Article not found or already deleted" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ok: true,
      message: "Article deleted successfully",
      deletedAt: data.deleted_at
    })

  } catch (error) {
    console.error("Error in DELETE /api/admin/articles/[id]:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}