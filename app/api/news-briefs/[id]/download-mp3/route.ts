import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Storage } from '@google-cloud/storage'
import { spawn } from 'child_process'
import { createWriteStream, createReadStream, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

// GET: Download individual dialogue segment as MP3
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const briefId = params.id
    const { searchParams } = new URL(request.url)
    const segmentId = searchParams.get('segmentId')

    if (!segmentId) {
      return NextResponse.json(
        { error: 'Segment ID is required' },
        { status: 400 }
      )
    }

    console.log(`🎵 Converting segment ${segmentId} to MP3 for brief ${briefId}`)

    // Get the news brief
    const { data: brief, error: briefError } = await supabase
      .from('news_briefs')
      .select('*')
      .eq('id', briefId)
      .single()

    if (briefError || !brief) {
      return NextResponse.json(
        { error: 'News brief not found' },
        { status: 404 }
      )
    }

    // Find the dialogue operation for this segment
    const dialogueOperations = brief.tts_dialogue_operations || []
    const operation = dialogueOperations.find((op: any) => op.segmentId === segmentId)

    if (!operation || !operation.audioUrl) {
      return NextResponse.json(
        { error: 'Audio not found for this segment' },
        { status: 404 }
      )
    }

    // Extract GCS path from operation
    const gcsUri = operation.outputGcsUri
    if (!gcsUri || !gcsUri.startsWith('gs://')) {
      return NextResponse.json(
        { error: 'Invalid GCS URI' },
        { status: 400 }
      )
    }

    // Parse GCS URI to get bucket and filename
    const gcsPath = gcsUri.replace('gs://', '')
    const [bucketName, ...filePathParts] = gcsPath.split('/')
    const fileName = filePathParts.join('/')

    console.log(`☁️ Downloading from GCS: ${bucketName}/${fileName}`)

    // Initialize Google Cloud Storage
    const storage = new Storage({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    })

    const bucket = storage.bucket(bucketName)
    const file = bucket.file(fileName)

    // Check if file exists
    const [exists] = await file.exists()
    if (!exists) {
      return NextResponse.json(
        { error: 'Audio file not found in storage' },
        { status: 404 }
      )
    }

    // Create temporary file paths
    const tempDir = tmpdir()
    const inputPath = join(tempDir, `input_${Date.now()}.wav`)
    const outputPath = join(tempDir, `output_${Date.now()}.mp3`)

    try {
      // Download WAV file from GCS to temp file
      await new Promise<void>((resolve, reject) => {
        const writeStream = createWriteStream(inputPath)
        file.createReadStream()
          .pipe(writeStream)
          .on('finish', resolve)
          .on('error', reject)
      })

      console.log(`⬇️ Downloaded WAV to: ${inputPath}`)

      // Convert WAV to MP3 using ffmpeg
      await new Promise<void>((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
          '-i', inputPath,
          '-codec:a', 'libmp3lame',
          '-b:a', '128k',
          '-ac', '2',
          '-ar', '44100',
          '-y', // Overwrite output file
          outputPath
        ])

        ffmpeg.stderr.on('data', (data) => {
          console.log(`ffmpeg: ${data}`)
        })

        ffmpeg.on('close', (code) => {
          if (code === 0) {
            console.log(`✅ MP3 conversion successful: ${outputPath}`)
            resolve()
          } else {
            console.error(`❌ ffmpeg failed with code ${code}`)
            reject(new Error(`ffmpeg conversion failed with code ${code}`))
          }
        })

        ffmpeg.on('error', (error) => {
          console.error(`❌ ffmpeg spawn error:`, error)
          reject(error)
        })
      })

      // Stream the MP3 file back to client
      const mp3Stream = createReadStream(outputPath)
      const mp3Filename = `${brief.title.replace(/[^a-z0-9]/gi, '_')}_${segmentId}.mp3`

      // Create response with MP3 stream
      const response = new NextResponse(mp3Stream as any, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Disposition': `attachment; filename="${mp3Filename}"`,
        },
      })

      // Clean up temp files after response (in background)
      setTimeout(() => {
        try {
          unlinkSync(inputPath)
          unlinkSync(outputPath)
          console.log(`🧹 Cleaned up temp files`)
        } catch (error) {
          console.warn(`⚠️ Failed to clean up temp files:`, error)
        }
      }, 5000)

      return response

    } catch (conversionError) {
      // Clean up temp files on error
      try {
        unlinkSync(inputPath)
        if (outputPath) unlinkSync(outputPath)
      } catch (cleanupError) {
        console.warn(`⚠️ Failed to clean up temp files on error:`, cleanupError)
      }
      throw conversionError
    }

  } catch (error) {
    console.error('❌ Error converting to MP3:', error)
    return NextResponse.json({
      error: 'Failed to convert audio to MP3',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}