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
        console.log('🎵 Audio Service - AudioContext already exists, checking state')
        return await this.resumeContextIfNeeded()
      }
      
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextClass) {
        console.warn('🎵 Audio Service - Web Audio API not supported')
        return false
      }
      
      this.audioContext = new AudioContextClass()
      console.log('🎵 Audio Service - Created new AudioContext, state:', this.audioContext.state)
      
      // Handle suspended AudioContext (common on mobile browsers)
      const success = await this.resumeContextIfNeeded()
      
      if (success) {
        this.isInitialized = true
        console.log('🎵 Audio Service - AudioContext initialized successfully')
      }
      
      return success
    } catch (error) {
      console.error('🎵 Audio Service - Failed to initialize AudioContext:', error)
      return false
    }
  }
  
  // Resume AudioContext if suspended
  private async resumeContextIfNeeded(): Promise<boolean> {
    if (!this.audioContext) return false
    
    if (this.audioContext.state === 'suspended') {
      console.log('🎵 Audio Service - AudioContext suspended, attempting to resume...')
      
      try {
        // For iOS Chrome, we need to be more aggressive about resumption
        if (this.deviceInfo.isIOSChrome) {
          console.log('🎵 Audio Service - iOS Chrome detected, using enhanced resumption strategy')
          
          // Try multiple times with delays for iOS Chrome
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              await this.audioContext.resume()
              if (this.audioContext.state === 'running') {
                console.log('🎵 Audio Service - AudioContext resumed successfully on attempt', attempt + 1)
                return true
              }
              await new Promise(resolve => setTimeout(resolve, 100))
            } catch (resumeError) {
              console.warn(`🎵 Audio Service - Resume attempt ${attempt + 1} failed:`, resumeError)
            }
          }
        } else {
          // Standard resumption for other browsers
          await this.audioContext.resume()
        }
        
        console.log('🎵 Audio Service - AudioContext final state:', this.audioContext.state)
        return this.audioContext.state === 'running'
      } catch (error) {
        console.error('🎵 Audio Service - Failed to resume AudioContext:', error)
        return false
      }
    }
    
    return this.audioContext.state === 'running'
  }
  
  // Initialize audio analysis for an audio element
  async setupAudioAnalysis(audioElement: HTMLAudioElement): Promise<boolean> {
    try {
      if (!this.audioContext || !this.isInitialized) {
        console.log('🎵 Audio Service - AudioContext not ready, skipping analysis setup')
        return false
      }
      
      // Clean up existing connections
      this.cleanupAnalysis()
      
      // Create analyser
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 256
      this.analyser.smoothingTimeConstant = 0.8
      
      console.log('🎵 Audio Service - Creating MediaElementSource...')
      
      try {
        this.mediaSource = this.audioContext.createMediaElementSource(audioElement)
        console.log('🎵 Audio Service - MediaElementSource created successfully')
      } catch (sourceError) {
        console.error('🎵 Audio Service - Failed to create MediaElementSource:', sourceError)
        
        // On mobile browsers, especially iOS Chrome, this can fail
        // Provide graceful degradation
        if (this.deviceInfo.isMobile) {
          console.log('🎵 Audio Service - Mobile browser - gracefully degrading without visualization')
        }
        return false
      }
      
      console.log('🎵 Audio Service - Connecting audio graph: source -> analyser -> destination')
      
      try {
        this.mediaSource.connect(this.analyser)
        this.analyser.connect(this.audioContext.destination)
        
        console.log('🎵 Audio Service - Audio analysis initialized successfully')
        return true
      } catch (connectionError) {
        console.error('🎵 Audio Service - Failed to connect audio graph:', connectionError)
        
        // On some mobile browsers, connection might fail
        // Still allow audio to play without visualization
        try {
          this.mediaSource?.connect(this.audioContext.destination) // Direct connection for audio playback
          console.log('🎵 Audio Service - Using direct audio connection without analysis')
        } catch (directConnectionError) {
          console.error('🎵 Audio Service - Even direct connection failed:', directConnectionError)
        }
        return false
      }
    } catch (error) {
      console.error('🎵 Audio Service - Failed to initialize audio analysis:', error)
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
        console.log('🎵 AudioService - Using REAL frequency data:', data.slice(0, 3))
      } else {
        // No analyser available - return zeros instead of mock data
        console.log('🎵 AudioService - No analyser available, analyser:', !!this.analyser, 'type:', type)
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
      console.warn('🎵 Audio Service - Error during analysis cleanup:', error)
    }
  }
  
  // Complete cleanup
  cleanup(): void {
    console.log('🎵 Audio Service - Cleaning up all resources')
    
    this.stopVisualizationLoop()
    this.cleanupAnalysis()
    
    if (this.audioContext) {
      try {
        this.audioContext.close()
        this.audioContext = null
      } catch (error) {
        console.warn('🎵 Audio Service - Error closing AudioContext:', error)
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