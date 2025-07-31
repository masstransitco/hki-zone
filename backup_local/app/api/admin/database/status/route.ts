import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface ColumnCheck {
  column: string
  exists: boolean
  type?: string
}

interface MigrationStatus {
  tableName: string
  tableExists: boolean
  columns: ColumnCheck[]
  missingColumns: string[]
  migrations: {
    name: string
    required: boolean
    applied: boolean
  }[]
}

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Expected columns in articles table
    const expectedColumns = [
      'id',
      'title',
      'content',
      'summary',
      'ai_summary',
      'url',
      'source',
      'author',
      'published_at',
      'image_url',
      'image_metadata',
      'category',
      'created_at',
      'updated_at',
      'is_ai_enhanced',
      'original_article_id',
      'enhancement_metadata',
      'language',
      'deleted_at'
    ]
    
    // Check if table exists
    const { data: tableCheck, error: tableError } = await supabase
      .from('articles')
      .select('id')
      .limit(1)
    
    const tableExists = !tableError || !tableError.message.includes('does not exist')
    
    if (!tableExists) {
      return NextResponse.json({
        tableName: 'articles',
        tableExists: false,
        columns: [],
        missingColumns: expectedColumns,
        migrations: [
          { name: 'setup-database', required: true, applied: false }
        ],
        summary: 'Articles table does not exist. Please run setup-database migration first.'
      })
    }
    
    // Check each column
    const columnChecks: ColumnCheck[] = []
    const missingColumns: string[] = []
    
    for (const column of expectedColumns) {
      const { error } = await supabase
        .from('articles')
        .select(column)
        .limit(1)
      
      const exists = !error || !error.message.includes(`column "${column}"`)
      columnChecks.push({ column, exists })
      
      if (!exists) {
        missingColumns.push(column)
      }
    }
    
    // Determine which migrations need to be run
    const migrations = [
      {
        name: 'setup-database',
        required: missingColumns.includes('id'),
        applied: !missingColumns.includes('id')
      },
      {
        name: 'ai-enhancement-fields',
        required: missingColumns.includes('is_ai_enhanced') || 
                  missingColumns.includes('original_article_id') || 
                  missingColumns.includes('enhancement_metadata'),
        applied: !missingColumns.includes('is_ai_enhanced') && 
                 !missingColumns.includes('original_article_id') && 
                 !missingColumns.includes('enhancement_metadata')
      },
      {
        name: 'language-field',
        required: missingColumns.includes('language'),
        applied: !missingColumns.includes('language')
      },
      {
        name: 'deleted-at-field',
        required: missingColumns.includes('deleted_at'),
        applied: !missingColumns.includes('deleted_at')
      },
      {
        name: 'image-metadata-field',
        required: missingColumns.includes('image_metadata'),
        applied: !missingColumns.includes('image_metadata')
      }
    ]
    
    const pendingMigrations = migrations.filter(m => m.required && !m.applied)
    
    let summary = 'Database is fully configured.'
    if (pendingMigrations.length > 0) {
      summary = `Missing columns: ${missingColumns.join(', ')}. ` +
                `Pending migrations: ${pendingMigrations.map(m => m.name).join(', ')}`
    }
    
    return NextResponse.json({
      tableName: 'articles',
      tableExists,
      columns: columnChecks,
      missingColumns,
      migrations,
      summary,
      instructions: pendingMigrations.length > 0 ? {
        message: "Run the following endpoints to apply missing migrations:",
        endpoints: pendingMigrations.map(m => {
          switch (m.name) {
            case 'setup-database':
              return { name: m.name, method: 'POST', endpoint: '/api/setup-database' }
            case 'ai-enhancement-fields':
              return { name: m.name, method: 'POST', endpoint: '/api/admin/database/migrate-ai-enhancement' }
            case 'language-field':
              return { name: m.name, method: 'POST', endpoint: '/api/admin/database/add-language-field' }
            case 'deleted-at-field':
              return { name: m.name, method: 'POST', endpoint: '/api/admin/database/add-deleted-at-field' }
            case 'image-metadata-field':
              return { name: m.name, method: 'POST', endpoint: '/api/admin/database/add-image-metadata' }
            default:
              return { name: m.name, method: 'UNKNOWN', endpoint: 'UNKNOWN' }
          }
        })
      } : null
    })
    
  } catch (error) {
    console.error("Error checking database status:", error)
    return NextResponse.json({ 
      success: false, 
      error: "Failed to check database status",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}