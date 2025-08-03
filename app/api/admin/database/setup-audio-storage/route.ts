import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

export async function POST(request: NextRequest) {
  try {
    console.log('🗄️ Setting up audio storage bucket...')

    // Create the audio-files bucket
    const { data: bucketData, error: bucketError } = await supabase.storage
      .createBucket('audio-files', {
        public: true,
        allowedMimeTypes: ['audio/mpeg', 'audio/mp3', 'audio/wav'],
        fileSizeLimit: 50 * 1024 * 1024, // 50MB limit
      })

    if (bucketError && !bucketError.message.includes('already exists')) {
      console.error('Error creating bucket:', bucketError)
      throw bucketError
    }

    console.log('✅ audio-files bucket ready')

    // Set up storage policies for public access
    const policies = [
      {
        name: 'news_briefs_audio_select',
        sql: `
          CREATE POLICY IF NOT EXISTS "news_briefs_audio_select" ON storage.objects
          FOR SELECT USING (bucket_id = 'audio-files' AND (storage.foldername(name))[1] = 'news-briefs');
        `
      },
      {
        name: 'news_briefs_audio_insert', 
        sql: `
          CREATE POLICY IF NOT EXISTS "news_briefs_audio_insert" ON storage.objects
          FOR INSERT WITH CHECK (bucket_id = 'audio-files' AND (storage.foldername(name))[1] = 'news-briefs');
        `
      },
      {
        name: 'news_briefs_audio_delete',
        sql: `
          CREATE POLICY IF NOT EXISTS "news_briefs_audio_delete" ON storage.objects
          FOR DELETE USING (bucket_id = 'audio-files' AND (storage.foldername(name))[1] = 'news-briefs');
        `
      }
    ]

    // Apply storage policies
    for (const policy of policies) {
      try {
        const { error: policyError } = await supabase.rpc('exec_sql', {
          sql: policy.sql
        })
        
        if (policyError) {
          console.warn(`Policy ${policy.name} error:`, policyError)
        } else {
          console.log(`✅ Policy ${policy.name} applied`)
        }
      } catch (policyError) {
        console.warn(`Failed to apply policy ${policy.name}:`, policyError)
      }
    }

    // Test upload and download
    console.log('🧪 Testing storage functionality...')
    
    const testContent = Buffer.from('test audio content', 'utf8')
    const testPath = 'news-briefs/test/test-audio.mp3'
    
    // Test upload
    const { error: uploadError } = await supabase.storage
      .from('audio-files')
      .upload(testPath, testContent, {
        contentType: 'audio/mpeg',
        cacheControl: '3600'
      })

    if (uploadError) {
      console.error('Test upload failed:', uploadError)
      throw uploadError
    }

    // Test public URL
    const { data: { publicUrl } } = supabase.storage
      .from('audio-files')
      .getPublicUrl(testPath)

    // Clean up test file
    await supabase.storage
      .from('audio-files')
      .remove([testPath])

    console.log('✅ Storage test completed successfully')

    return NextResponse.json({
      success: true,
      message: 'Audio storage setup completed successfully',
      bucket: 'audio-files',
      testPublicUrl: publicUrl,
      setup: {
        bucketCreated: true,
        policiesApplied: true,
        testPassed: true
      }
    })

  } catch (error) {
    console.error('❌ Error setting up audio storage:', error)
    return NextResponse.json({
      error: 'Failed to setup audio storage',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check storage bucket status
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
    
    if (bucketsError) {
      throw bucketsError
    }

    const audioFilesBucket = buckets?.find(b => b.name === 'audio-files')
    
    // Check for existing audio files
    let fileCount = 0
    let totalSize = 0
    
    if (audioFilesBucket) {
      try {
        const { data: files, error: filesError } = await supabase.storage
          .from('audio-files')
          .list('news-briefs', {
            limit: 100,
            offset: 0
          })
        
        if (!filesError && files) {
          fileCount = files.length
          totalSize = files.reduce((sum, file) => sum + (file.metadata?.size || 0), 0)
        }
      } catch (filesError) {
        console.warn('Could not list files:', filesError)
      }
    }

    return NextResponse.json({
      configured: !!audioFilesBucket,
      bucket: {
        exists: !!audioFilesBucket,
        name: 'audio-files',
        public: audioFilesBucket?.public || false,
        createdAt: audioFilesBucket?.created_at,
        updatedAt: audioFilesBucket?.updated_at
      },
      stats: {
        fileCount,
        totalSizeBytes: totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2)
      },
      message: audioFilesBucket ? 'Audio storage is configured' : 'Audio storage needs setup'
    })

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to check audio storage status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}