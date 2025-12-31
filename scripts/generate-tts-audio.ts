#!/usr/bin/env ts-node

/**
 * Simple TTS Audio Generator Script
 * Generates audio file using Google Cloud Text-to-Speech API
 *
 * Usage: ts-node scripts/generate-tts-audio.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { TextToSpeechClient } from '@google-cloud/text-to-speech'

// Initialize the TTS client
const client = new TextToSpeechClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
})

async function generateAudio(text: string, outputFilename: string) {
  console.log('🎤 Generating audio for:', text)

  // Construct the TTS request
  const request = {
    input: { text },
    voice: {
      languageCode: 'en-US',
      name: 'en-US-Studio-Q', // Male authoritative voice
      ssmlGender: 'MALE' as const
    },
    audioConfig: {
      audioEncoding: 'MP3' as const,
      sampleRateHertz: 24000,
      speakingRate: 1.18,
      pitch: -0.8,
      volumeGainDb: 2.0,
      effectsProfileId: ['large-home-entertainment-class-device']
    }
  }

  try {
    // Perform the text-to-speech request
    const [response] = await client.synthesizeSpeech(request)

    if (!response.audioContent) {
      throw new Error('No audio content received')
    }

    // Create output directory if it doesn't exist
    const outputDir = path.join(process.cwd(), 'output')
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // Write the audio file
    const outputPath = path.join(outputDir, outputFilename)
    fs.writeFileSync(outputPath, response.audioContent, 'binary')

    console.log('✅ Audio file generated successfully!')
    console.log('📁 Saved to:', outputPath)
    console.log('🎧 Duration: ~', Math.ceil(text.length / 15), 'seconds (estimated)')

    return outputPath
  } catch (error) {
    console.error('❌ Error generating audio:', error)
    throw error
  }
}

// Main execution
const main = async () => {
  const text = 'ZU5419 MG4 Doors Unlocked'
  const outputFilename = 'zu5419-mg4-doors-unlocked.mp3'

  await generateAudio(text, outputFilename)
}

main().catch(console.error)
