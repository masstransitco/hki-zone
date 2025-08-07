import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
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

// GET: Download full news brief audio as MP3
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const briefId = params.id

    console.log(`🎵 Converting full audio to MP3 for brief ${briefId}`)

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

    if (!brief.audio_url) {
      return NextResponse.json(
        { error: 'No audio available for this brief' },
        { status: 404 }
      )
    }

    console.log(`⬇️ Downloading full audio from: ${brief.audio_url}`)

    // Create temporary file paths
    const tempDir = tmpdir()
    const inputPath = join(tempDir, `full_input_${Date.now()}.wav`)
    const outputPath = join(tempDir, `full_output_${Date.now()}.mp3`)

    try {
      // Download WAV file from URL to temp file
      const audioResponse = await fetch(brief.audio_url)
      if (!audioResponse.ok) {
        throw new Error(`Failed to download audio: ${audioResponse.statusText}`)
      }

      const arrayBuffer = await audioResponse.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      
      await new Promise<void>((resolve, reject) => {
        const writeStream = createWriteStream(inputPath)
        writeStream.write(buffer)
        writeStream.end()
        writeStream.on('finish', resolve)
        writeStream.on('error', reject)
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
      const mp3Filename = `${brief.title.replace(/[^a-z0-9]/gi, '_')}_${brief.language}_full.mp3`

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
    console.error('❌ Error converting full audio to MP3:', error)
    return NextResponse.json({
      error: 'Failed to convert full audio to MP3',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}