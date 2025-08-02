import { DeviceInfo } from '@/store/audioSlice'

// Audio Context management service
export class AudioService {
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private mediaSource: MediaElementAudioSourceNode | null = null
  private animationFrameId: number | null = null
  private deviceInfo: DeviceInfo
  private isInitialized: boolean = false
  
  constructor(deviceInfo: DeviceInfo) {
    this.deviceInfo = deviceInfo
  }
  
  // Initialize AudioContext with proper user gesture handling for mobile
  async initializeAudioContext(): Promise<boolean> {
    try {
      if (this.audioContext) {
        return await this.resumeContextIfNeeded()
      }
      
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextClass) {
        console.warn('Web Audio API not supported')
        return false
      }
      
      this.audioContext = new AudioContextClass()
      
      // Handle suspended AudioContext (common on mobile browsers)
      const success = await this.resumeContextIfNeeded()
      
      if (success) {
        this.isInitialized = true
      }
      
      return success
    } catch (error) {
      console.error('AudioContext initialization failed:', error)
      return false
    }
  }
  
  // Resume AudioContext if suspended
  private async resumeContextIfNeeded(): Promise<boolean> {
    if (!this.audioContext) return false
    
    if (this.audioContext.state === 'suspended') {
      try {
        // For iOS Chrome, we need to be more aggressive about resumption
        if (this.deviceInfo.isIOSChrome) {
          
          // Try multiple times with delays for iOS Chrome
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              await this.audioContext.resume()
              if (this.audioContext.state === 'running') {
                return true
              }
              await new Promise(resolve => setTimeout(resolve, 100))
            } catch (resumeError) {
              if (attempt === 2) console.warn('AudioContext resume failed:', resumeError)
            }
          }
        } else {
          // Standard resumption for other browsers
          await this.audioContext.resume()
        }
        
        return this.audioContext.state === 'running'
      } catch (error) {
        console.error('AudioContext resume failed:', error)
        return false
      }
    }
    
    return this.audioContext.state === 'running'
  }
  
  // Client playback polish with DSP processing
  private setupAudioProcessing(source: MediaElementAudioSourceNode): AudioNode {
    if (!this.audioContext) return source
    
    try {
      // Create processing chain: source -> de-esser -> soft limiter -> analyser -> destination
      
      // 1. De-esser: High-shelf filter to tame harsh sibilants (6-8 kHz, -2dB)
      const deEsser = this.audioContext.createBiquadFilter()
      deEsser.type = 'highshelf'
      deEsser.frequency.setValueAtTime(6500, this.audioContext.currentTime) // Target sibilant frequencies
      deEsser.gain.setValueAtTime(-2, this.audioContext.currentTime) // Gentle reduction
      deEsser.Q.setValueAtTime(0.7, this.audioContext.currentTime) // Smooth rolloff
      
      // 2. Soft limiter: Dynamics processor to prevent clipping (-1 dBFS ceiling)
      const compressor = this.audioContext.createDynamicsCompressor()
      compressor.threshold.setValueAtTime(-6, this.audioContext.currentTime) // Start compression at -6dB
      compressor.knee.setValueAtTime(3, this.audioContext.currentTime) // Soft knee for natural sound
      compressor.ratio.setValueAtTime(4, this.audioContext.currentTime) // 4:1 ratio for gentle limiting
      compressor.attack.setValueAtTime(0.003, this.audioContext.currentTime) // Fast attack (3ms)
      compressor.release.setValueAtTime(0.1, this.audioContext.currentTime) // Medium release (100ms)
      
      // 3. Fade in/out gain node for smooth chunk transitions
      const fadeGain = this.audioContext.createGain()
      fadeGain.gain.setValueAtTime(1, this.audioContext.currentTime) // Start at full volume
      
      // Connect processing chain
      source.connect(deEsser)
      deEsser.connect(compressor)
      compressor.connect(fadeGain)
      
      return fadeGain
      
    } catch (error) {
      console.warn('DSP setup failed, using direct connection:', error)
      return source
    }
  }
  
  // Apply fade in/out to prevent clicks between chunks
  applyAudioFades(gainNode: GainNode, duration: number = 0.015): void {
    if (!this.audioContext || !gainNode) return
    
    const now = this.audioContext.currentTime
    const fadeDuration = Math.min(duration, 0.05) // Max 50ms fade
    
    // Fade in at start
    gainNode.gain.setValueAtTime(0, now)
    gainNode.gain.linearRampToValueAtTime(1, now + fadeDuration)
    
    // Schedule fade out at end (if we know the duration)
    // This would be called when we know the audio is about to end
  }
  
  // Trim trailing silence when concatenating chunks
  private trimSilence(audioBuffer: AudioBuffer): AudioBuffer {
    if (!this.audioContext) return audioBuffer
    
    const channelData = audioBuffer.getChannelData(0)
    const sampleRate = audioBuffer.sampleRate
    const threshold = 0.01 // -40dB threshold for silence detection
    
    // Find last non-silent sample
    let endSample = channelData.length - 1
    while (endSample > 0 && Math.abs(channelData[endSample]) < threshold) {
      endSample--
    }
    
    // Add small fade out (5ms) to prevent clicks
    const fadeOutSamples = Math.floor(sampleRate * 0.005)
    const trimLength = Math.min(endSample + fadeOutSamples + 1, channelData.length)
    
    if (trimLength < channelData.length) {
      
      // Create new trimmed buffer
      const trimmedBuffer = this.audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        trimLength,
        sampleRate
      )
      
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const sourceData = audioBuffer.getChannelData(channel)
        const trimmedData = trimmedBuffer.getChannelData(channel)
        
        // Copy non-silent samples
        for (let i = 0; i < trimLength - fadeOutSamples; i++) {
          trimmedData[i] = sourceData[i]
        }
        
        // Apply fade out to prevent clicks
        for (let i = trimLength - fadeOutSamples; i < trimLength; i++) {
          const fadeRatio = (trimLength - i) / fadeOutSamples
          trimmedData[i] = sourceData[i] * fadeRatio
        }
      }
      
      return trimmedBuffer
    }
    
    return audioBuffer
  }

  // Initialize audio analysis for an audio element
  async setupAudioAnalysis(audioElement: HTMLAudioElement): Promise<boolean> {
    try {
      if (!this.audioContext || !this.isInitialized) {
        return false
      }
      
      // Validate and resume AudioContext state if needed
      if (this.audioContext.state === 'suspended') {
        try {
          await this.audioContext.resume()
        } catch (resumeError) {
          console.error('AudioContext resume failed:', resumeError)
          return false
        }
      }
      
      if (this.audioContext.state !== 'running') {
        return false
      }
      
      // Clean up existing connections
      this.cleanupAnalysis()
      
      // Create analyser
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 256
      this.analyser.smoothingTimeConstant = 0.8
      
      
      // Retry logic for MediaElementSource creation
      let createSourceAttempts = 0
      const maxAttempts = 3
      
      while (createSourceAttempts < maxAttempts) {
        try {
          this.mediaSource = this.audioContext.createMediaElementSource(audioElement)
          break
        } catch (sourceError) {
          createSourceAttempts++
          
          if (createSourceAttempts >= maxAttempts) {
            console.error('MediaElementSource creation failed:', sourceError)
            return false
          }
          
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 100 * createSourceAttempts))
        }
      }
      
      try {
        // Setup DSP processing chain
        const processedSource = this.setupAudioProcessing(this.mediaSource)
        
        // Connect processed audio to analyser and destination
        processedSource.connect(this.analyser)
        this.analyser.connect(this.audioContext.destination)
        
        return true
      } catch (connectionError) {
        console.error('Audio connection failed:', connectionError)
        
        // Fallback: try basic connection without DSP
        try {
          this.mediaSource.connect(this.analyser)
          this.analyser.connect(this.audioContext.destination)
          return true
        } catch (basicConnectionError) {
          // Final fallback: direct connection for audio playback only
          try {
            this.mediaSource?.connect(this.audioContext.destination)
          } catch (directConnectionError) {
            console.error('Audio connection completely failed:', directConnectionError)
          }
          return false
        }
      }
    } catch (error) {
      console.error('Audio analysis initialization failed:', error)
      return false
    }
  }
  
  // Get real-time frequency data for visualization
  getFrequencyData(): number[] {
    if (!this.analyser) {
      return Array(6).fill(0)
    }
    
    const bufferLength = this.analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    this.analyser.getByteFrequencyData(dataArray)
    
    // Check if we're getting any frequency data
    const maxFreq = Math.max(...dataArray)
    if (maxFreq === 0) {
      return Array(6).fill(0)
    }
    
    // Speech-optimized frequency bands (FFT size 256 = 128 bins, ~172Hz per bin at 44.1kHz)
    // Human speech: 85-255Hz (fundamental), 700-3000Hz (formants), 3000-8000Hz (clarity)
    const speechBands = [
      { start: 0, end: 2, weight: 1.5 },    // 0-344Hz: Voice fundamental
      { start: 2, end: 4, weight: 1.3 },    // 344-688Hz: Lower harmonics
      { start: 4, end: 8, weight: 1.2 },    // 688-1376Hz: First formant
      { start: 8, end: 15, weight: 1.0 },   // 1376-2580Hz: Second formant
      { start: 15, end: 25, weight: 0.8 },  // 2580-4300Hz: Higher formants
      { start: 25, end: 40, weight: 0.6 }   // 4300-6880Hz: Consonants/clarity
    ]

    return speechBands.map((band) => {
      let sum = 0
      let count = 0

      // Calculate weighted average for this frequency band
      for (let j = band.start; j < band.end && j < bufferLength; j++) {
        sum += dataArray[j] * band.weight
        count++
      }

      // Normalize the frequency data
      const average = count > 0 ? sum / count : 0
      const normalized = average / 255
      
      // Amplify for better visual impact
      return Math.min(1, normalized * 2.0)
    })
  }
  
  // Generate mock visualization data when analyser is not available
  generateMockVisualization(type: 'playing' | 'loading' | 'paused' | 'idle' = 'idle', intensity: number = 0.5): number[] {
    const frequencyBands = 6
    
    switch (type) {
      case 'playing':
        // Generate dynamic data for playing state
        return Array.from({ length: frequencyBands }, (_, i) => {
          const baseEnergy = Math.random() * intensity
          const frequencyBand = i / frequencyBands
          const frequencyWeight = 1 - frequencyBand * 0.6 // Lower frequencies have more energy
          return Math.min(1, baseEnergy * frequencyWeight)
        })
        
      case 'loading':
        // Shimmer effect during loading
        return Array.from({ length: frequencyBands }, () => Math.random() * 0.4 + 0.1)
        
      case 'paused':
        // Gentle breathing animation when paused
        const time = Date.now() * 0.001
        return Array.from({ length: frequencyBands }, () => 0.05 + Math.sin(time * 0.5) * 0.03)
        
      case 'idle':
      default:
        // Minimal activity for idle state
        return Array.from({ length: frequencyBands }, () => 0.02)
    }
  }
  
  // Start visualization animation loop
  startVisualizationLoop(updateCallback: (data: number[]) => void, type: 'playing' | 'loading' | 'paused' | 'idle' = 'playing'): void {
    if (this.animationFrameId) {
      this.stopVisualizationLoop()
    }
    
    const animate = () => {
      let data: number[]
      
      if (this.analyser && type === 'playing') {
        // Use real frequency data when available
        data = this.getFrequencyData()
      } else {
        // No analyser available - return zeros instead of mock data
        data = Array(6).fill(0)
      }
      
      updateCallback(data)
      
      // Continue animation loop
      this.animationFrameId = requestAnimationFrame(animate)
    }
    
    animate()
  }
  
  // Stop visualization animation loop
  stopVisualizationLoop(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }
  
  // Clean up analysis connections
  private cleanupAnalysis(): void {
    try {
      if (this.mediaSource) {
        this.mediaSource.disconnect()
        this.mediaSource = null
      }
      
      if (this.analyser) {
        this.analyser.disconnect()
        this.analyser = null
      }
    } catch (error) {
      console.warn('Error during analysis cleanup:', error)
    }
  }
  
  // Complete cleanup
  cleanup(): void {
    this.stopVisualizationLoop()
    this.cleanupAnalysis()
    
    if (this.audioContext) {
      try {
        this.audioContext.close()
        this.audioContext = null
      } catch (error) {
        console.warn('Error closing AudioContext:', error)
      }
    }
    
    this.isInitialized = false
  }
  
  // Get current state information
  getState() {
    return {
      isInitialized: this.isInitialized,
      contextState: this.audioContext?.state || 'idle',
      hasAnalyser: !!this.analyser,
      hasMediaSource: !!this.mediaSource,
      isAnimating: !!this.animationFrameId,
      deviceInfo: this.deviceInfo
    }
  }
  
  // Get AudioContext for direct access (needed for emergency fallbacks)
  getAudioContext(): AudioContext | null {
    return this.audioContext
  }
  
  // Update device information
  updateDeviceInfo(deviceInfo: DeviceInfo): void {
    this.deviceInfo = deviceInfo
  }
  
  // Check if audio analysis is supported
  isAnalysisSupported(): boolean {
    return this.isInitialized && !!this.audioContext && !!this.analyser
  }
}

// Utility functions for audio processing
export const audioUtils = {
  // Smooth audio data using exponential smoothing
  smoothAudioData(currentData: number[], previousData: number[], smoothingFactor: number = 0.3): number[] {
    return currentData.map((value, index) => {
      const previousValue = previousData[index] || 0
      return previousValue * smoothingFactor + value * (1 - smoothingFactor)
    })
  },
  
  // Calculate average energy level
  calculateAverageEnergy(data: number[]): number {
    return data.reduce((sum, value) => sum + value, 0) / data.length
  },
  
  // Detect silence in audio data
  isSilent(data: number[], threshold: number = 0.01): boolean {
    return audioUtils.calculateAverageEnergy(data) < threshold
  },
  
  // Apply gain to audio data
  applyGain(data: number[], gain: number): number[] {
    return data.map(value => Math.min(1, value * gain))
  }
}

// Factory function to create AudioService with device detection
export const createAudioService = (): AudioService => {
  // Detect device capabilities
  const deviceInfo: DeviceInfo = {
    isMobile: false,
    isIOS: false,
    isIOSChrome: false,
    isIOSSafari: false,
    isAndroid: false
  }
  
  if (typeof window !== 'undefined') {
    const userAgent = navigator.userAgent
    const isIOS = /iPhone|iPad|iPod/.test(userAgent)
    const isAndroid = /Android/.test(userAgent)
    
    deviceInfo.isMobile = isIOS || isAndroid || /webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
    deviceInfo.isIOS = isIOS
    deviceInfo.isIOSChrome = /CriOS/i.test(userAgent) || (isIOS && /Chrome/i.test(userAgent))
    deviceInfo.isIOSSafari = isIOS && /Safari/i.test(userAgent) && !/Chrome|CriOS|FxiOS|EdgiOS/i.test(userAgent)
    deviceInfo.isAndroid = isAndroid
  }
  
  return new AudioService(deviceInfo)
}