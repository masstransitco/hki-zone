# Text-to-Speech (TTS) Implementation

## Overview

The TTS system provides ultra-realistic audio narration for news articles with multi-language support, real-time audio visualization, and a premium user experience. Built using Redux architecture with exclusive Google Text-to-Speech Studio voice integration and advanced Web Audio API processing.

## Architecture

### Redux-Based State Management
- **Primary Pattern**: Redux store with middleware for side effects
- **Studio Voice Focus**: Exclusive Studio voice integration for highest quality
- **Real-time Features**: Web Audio API visualization with DSP processing
- **Language Change Optimization**: AudioContext preservation during language switching

## Core Files and Responsibilities

### 🔧 State Management

#### `store/ttsSlice.ts`
**Role**: Central state management for all TTS functionality
- Manages playback states (playing, paused, loading)
- Handles progress tracking and real-time audio visualization data
- Coordinates service instances with AudioContext preservation during language changes
- Provides optimized selectors for component consumption
- **Key Features**: Streamlined language switching without audio disruption

#### `store/middleware/ttsMiddleware.ts`
**Role**: Side effects coordination between TTS actions and services
- Manages audio playbook lifecycle with user gesture AudioContext initialization
- Coordinates real-time visualization updates with Web Audio API
- Handles service initialization and cleanup with graceful degradation
- **Key Features**: Emergency audio fallback and enhanced error handling

### 🛠️ Services Layer

#### `services/ttsService.ts`
**Role**: Google Text-to-Speech API integration with Studio voice focus
- **Voice Selection**: Studio voices for ultra-realistic quality
  - English: `en-US-Studio-Q` (Male authoritative radio news anchor)
  - Cantonese: `yue-HK-Standard-B` (Best available for Hong Kong)
  - Mandarin: `cmn-CN-Wavenet-C` (Optimized for news delivery)
- **Ultra-Realistic SSML Processing**: Advanced preprocessing for broadcast-quality delivery
  - Removes section headers (`**Summary**`, `**Key Points**`, `**Why It Matters**`)
  - Strips citation numbers (`[1]`, `[2]`, etc.)
  - Hong Kong pronunciation lexicon with IPA notation
  - Natural speech rhythm with subtle jitter for human-like delivery
  - Content-aware pace adjustments (faster for breaking news, slower for data-heavy content)
- **Studio-Optimized Features**: Simplified processing chain for Studio voice compatibility
- **Professional Audio Settings**: Broadcast-quality sample rates and pitch optimization

#### `services/speechService.ts`
**Role**: Browser Speech Synthesis API fallback
- Native browser TTS when Google API unavailable
- Voice selection and mobile-optimized settings
- Graceful degradation for offline scenarios

#### `services/audioService.ts`
**Role**: Advanced Web Audio API processing and visualization
- **AudioContext Management**: User gesture initialization with mobile browser compatibility
- **DSP Processing Chain**: 
  - De-esser filter (6-8 kHz, -2dB) for smooth sibilants
  - Soft limiter/compressor (-6dB threshold, 4:1 ratio)
  - Fade in/out gain control for seamless chunk transitions
- **Speech-Optimized Analysis**: 6-band frequency analysis targeting human speech ranges
- **Real-time Visualization**: High-performance frequency data generation
- **Mobile Optimization**: Enhanced iOS Chrome support with retry logic

### 🎨 UI Components

#### `components/global-tts-hud.tsx`
**Role**: Main TTS interface with real-time audio visualization
- **Design**: Clean, professional interface with neutral color scheme
- **Visualization**: 6-bar frequency spectrum with real Web Audio API data
- **Theme Support**: Automatic light/dark theme adaptation using CSS custom properties
- **Features**:
  - Real-time frequency analysis visualization (0-8kHz speech range)
  - Progress tracking with smooth animations
  - Play/pause/stop controls with immediate response
  - Article title display with truncation
  - Responsive design for mobile/tablet/desktop
  - **Color System**: Green waveform bars with neutral UI elements

#### `components/tts-initializer.tsx`
**Role**: System initialization and language management
- Deferred TTS initialization on app startup (AudioContext initialized during playback)
- Handles seamless language changes with service preservation
- Manages API key configuration from environment variables
- Redux store rehydration with initialization state tracking

### 🔗 Integration Points

#### `components/article-bottom-sheet.tsx`
**Role**: Article reader TTS integration
- Provides TTS controls within article viewer
- Triggers article playback with cleaned content

#### `app/layout.tsx`
**Role**: Global TTS integration
- Includes `<GlobalTTSHUD />` for app-wide access
- Includes `<TTSInitializer />` for system setup

### 🎣 Hooks and Utilities

#### `hooks/use-tts-redux.ts`
**Role**: Primary hook for TTS functionality
- **Main Hook**: `useTTS()` - Complete TTS functionality
- **Specialized Hooks**:
  - `useTTSPlayback()` - Playback control only
  - `useTTSVisualization()` - Audio visualization data
  - `useTTSConfig()` - Configuration and settings
  - `useTTSQueue()` - Queue management
  - `useTTSStatus()` - System status and capabilities

## Technical Features

### 🎵 Ultra-Realistic Audio Processing
- **DSP Chain**: Professional audio processing (de-esser → compressor → limiter)
- **Frequency Analysis**: Speech-optimized 6-band analysis (85Hz-8kHz)
- **Real-time Visualization**: True Web Audio API frequency data
- **AudioContext Lifecycle**: User gesture initialization with language change preservation
- **Mobile Compatibility**: Enhanced iOS Chrome support with retry mechanisms

### 🌍 Multi-language Support
- **English**: Studio Q voice - authoritative male radio news anchor
- **Traditional Chinese (Cantonese)**: Hong Kong-optimized with pronunciation lexicon
- **Simplified Chinese (Mandarin)**: Wavenet voice for natural news delivery
- **Dynamic Language Switching**: Seamless transitions with AudioContext preservation
- **Content-Aware Pacing**: Adaptive speaking rates based on content type

### 🎨 Visual Design
- **Theme Integration**: CSS custom properties for seamless light/dark theme support
- **Clean Professional Interface**: Neutral color scheme with green accent waveform
- **Color System**:
  - **Waveform**: Green bars for frequency visualization
  - **UI Elements**: Neutral theme-aware colors for controls and borders
  - **Typography**: System font stack for optimal readability

### 📱 Mobile Optimization
- **AudioContext Handling**: Special iOS Chrome support with multiple resume attempts
- **User Gesture Integration**: AudioContext initialization during user interaction
- **Responsive Design**: Adaptive layout for mobile/tablet/desktop
- **Performance**: Efficient animation loops with RAF and hardware acceleration
- **Graceful Degradation**: Audio playback prioritized over visualization on mobile

## Configuration

### Environment Variables
```bash
NEXT_PUBLIC_GOOGLE_TEXT_TO_SPEECH_API_KEY=your_api_key_here
```

### Voice Configuration
The system uses Studio voices exclusively for optimal quality:
- **Studio Focus**: Premium Studio voices for ultra-realistic delivery
- **Language-Optimized**: Best available voice per language
- **Browser Fallback**: Native synthesis as emergency fallback only

## Content Processing

### Ultra-Realistic SSML Preprocessing
The system applies broadcast-quality content processing:

1. **Section Header Removal**: Strips `**Summary**`, `**Key Points**`, `**Why It Matters**`
2. **Citation Cleanup**: Removes `[1]`, `[2]`, etc.
3. **Hong Kong Pronunciation Lexicon**: IPA-annotated proper nouns and local terms
4. **Natural Speech Rhythm**: Subtle jitter for human-like timing
5. **Content-Aware Pacing**: Dynamic rate adjustment based on content type
6. **Studio Voice Optimization**: Simplified SSML compatible with Studio voices
7. **Financial Term Handling**: Smart HK$ and percentage normalization

### Content Flow
```
Article Title + Content → Ultra-Realistic SSML Processing → Studio Voice API → 
DSP Audio Processing → Real-time Frequency Analysis → Visualization
```

## Performance Considerations

### Memory Management
- Automatic cleanup of audio resources and URL object URLs
- AudioContext preservation during language changes
- Efficient animation loops with requestAnimationFrame
- Service instance reuse optimization

### Network Optimization
- Text chunking for Studio voices (4.5KB limit)
- Single API call per article with chunking as needed
- Streamlined error handling with minimal fallback overhead

### Mobile Performance
- AudioContext initialization only during user interaction
- Enhanced iOS Chrome compatibility with retry logic
- Real-time frequency analysis with hardware acceleration
- Graceful degradation: audio playback prioritized over visualization

## Integration Examples

### Basic Usage
```typescript
import { useTTS } from '@/hooks/use-tts-redux'

const MyComponent = () => {
  const { play, isPlaying, currentArticle } = useTTS()
  
  const handlePlay = () => {
    play({
      id: 'article-123',
      title: 'Article Title',
      content: 'Article content...'
    })
  }
  
  return (
    <button onClick={handlePlay}>
      {isPlaying ? 'Playing...' : 'Play Article'}
    </button>
  )
}
```

### Real-time Audio Visualization
```typescript
import { useTTSVisualization } from '@/hooks/use-tts-redux'

const AudioVisualizer = () => {
  const { audioData, isPlaying } = useTTSVisualization()
  
  return (
    <div className="flex gap-1">
      {audioData.map((intensity, i) => (
        <div 
          key={i}
          className="bg-green-500 transition-all duration-75"
          style={{ 
            height: `${Math.max(intensity * 100, 2)}%`,
            opacity: isPlaying ? 1 : 0.3
          }}
        />
      ))}
    </div>
  )
}
```

## Key Technical Achievements

### ✅ Ultra-Realistic Audio Quality
- **Studio Voice Integration**: Exclusive use of Google's highest-quality Studio voices
- **Broadcast-Quality Processing**: Professional DSP chain with de-esser and soft limiter
- **Content-Aware Optimization**: Dynamic pacing based on article content type

### ✅ Seamless Language Switching
- **AudioContext Preservation**: No audio disruption during language changes
- **Service Instance Reuse**: Optimized state management for smooth transitions
- **Real-time Configuration**: Instant voice and processing updates

### ✅ Advanced Mobile Support
- **iOS Chrome Optimization**: Enhanced compatibility with retry mechanisms
- **User Gesture Integration**: Proper AudioContext initialization timing
- **Graceful Degradation**: Audio prioritized over visualization on mobile

### ✅ Real-time Audio Visualization
- **True Web Audio API**: Live frequency analysis from audio stream
- **Speech-Optimized Bands**: 6-band analysis targeting human speech (85Hz-8kHz)
- **Performance Optimized**: Hardware-accelerated rendering with minimal overhead

## Future Enhancements

- **Playback Speed Control**: Variable rate adjustment (0.5x - 2x)
- **Voice Preference Settings**: User-configurable voice selection per language
- **Audio Enhancement Options**: User-controllable EQ and processing settings
- **Multi-article Queue**: Playlist functionality for continuous listening

---

*Last Updated: February 2025*
*Architecture: Redux-based with Studio Voice TTS and Web Audio API*