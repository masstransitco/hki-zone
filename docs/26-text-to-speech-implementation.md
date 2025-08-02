# Text-to-Speech (TTS) Implementation

## Overview

The TTS system provides professional-grade audio narration for news articles with multi-language support, real-time visualization, and a premium user experience. Built using Redux architecture with Google Text-to-Speech API integration and browser fallback capabilities.

## Architecture

### Redux-Based State Management
- **Primary Pattern**: Redux store with middleware for side effects
- **Fallback Support**: Browser Speech Synthesis API
- **Real-time Features**: Audio visualization and progress tracking

## Core Files and Responsibilities

### 🔧 State Management

#### `store/ttsSlice.ts`
**Role**: Central state management for all TTS functionality
- Manages playback states (playing, paused, loading)
- Handles progress tracking and audio data
- Coordinates service instances (TTS, Speech, Audio)
- Provides selectors for component consumption

#### `store/middleware/ttsMiddleware.ts`
**Role**: Side effects coordination between TTS actions and services
- Manages audio playback lifecycle
- Coordinates visualization updates
- Handles service initialization and cleanup

### 🛠️ Services Layer

#### `services/ttsService.ts`
**Role**: Google Text-to-Speech API integration
- **Voice Selection**: Professional broadcast voices
  - English: `en-US-Studio-O` (Studio tier)
  - Cantonese: `yue-HK-Standard-B`
  - Mandarin: `cmn-CN-Neural2-A`
- **SSML Processing**: Enhanced preprocessing for news content
  - Removes section headers (`**Summary**`, `**Key Points**`, `**Why It Matters**`)
  - Strips citation numbers (`[1]`, `[2]`, etc.)
  - Optimizes pronunciation for Hong Kong terms (LegCo, CE, HK, HKD)
- **Fallback System**: 3-tier voice fallback (Studio → News → Standard)
- **Mobile Optimization**: Adjusted sample rates and pitch for mobile speakers

#### `services/speechService.ts`
**Role**: Browser Speech Synthesis API fallback
- Native browser TTS when Google API unavailable
- Voice selection and mobile-optimized settings
- Graceful degradation for offline scenarios

#### `services/audioService.ts`
**Role**: Audio analysis and real-time visualization
- Web Audio API integration
- Speech-optimized frequency band analysis
- Real-time waveform data generation
- Mobile compatibility handling

### 🎨 UI Components

#### `components/global-tts-hud.tsx`
**Role**: Main TTS interface (Primary HUD)
- **Design**: Apple-inspired glassmorphic interface
- **Visualization**: 16-bar waveform with speech-optimized frequency mapping
- **Theme Support**: Automatic light/dark theme adaptation
- **Features**:
  - Real-time audio visualization with enhanced motion
  - Progress tracking via sweep effect
  - Play/pause/stop controls
  - Article title display
  - Time progress indicator
  - Mobile-optimized touch targets (44px minimum)

#### `components/tts-initializer.tsx`
**Role**: System initialization and language management
- Initializes TTS on app startup
- Handles language changes and reinitializer
- Manages API key configuration
- Redux store rehydration handling

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

### 🎵 Audio Processing
- **Frequency Analysis**: Speech-optimized 6-band analysis
- **Real-time Visualization**: 16-bar waveform with complex wave patterns
- **Mobile Support**: Graceful degradation for iOS/Android limitations
- **AudioContext Management**: Proper user gesture handling

### 🌍 Multi-language Support
- **English**: Professional news voice with broadcast optimization
- **Traditional Chinese (Cantonese)**: Hong Kong-optimized pronunciation
- **Simplified Chinese (Mandarin)**: Neural2 voice for natural prosody
- **Dynamic Language Switching**: Automatic voice reselection

### 🎨 Visual Design
- **Theme Integration**: Uses CSS custom properties for light/dark themes
- **Apple Design Language**: Professional glassmorphic interface
- **Color System**:
  - **Waveform**: Green accent (`--tts-accent`) for audio visualization
  - **UI Elements**: Neutral theme colors for borders and controls
  - **Glassmorphism**: Backdrop blur with subtle transparency

### 📱 Mobile Optimization
- **Touch Targets**: 44px minimum (iOS recommendation)
- **Audio Handling**: Enhanced mobile browser compatibility
- **Responsive Design**: Progressive enhancement (mobile → tablet → desktop)
- **Performance**: Hardware acceleration and efficient animations

## Configuration

### Environment Variables
```bash
NEXT_PUBLIC_GOOGLE_TEXT_TO_SPEECH_API_KEY=your_api_key_here
```

### Voice Configuration
The system automatically selects optimal voices based on language:
- **Production**: Studio/Neural2 voices for premium quality
- **Fallback**: Standard voices when premium unavailable
- **Browser**: Native synthesis when Google API fails

## Content Processing

### SSML Preprocessing
The system cleans article content for optimal speech delivery:

1. **Section Header Removal**: Strips `**Summary**`, `**Key Points**`, `**Why It Matters**`
2. **Citation Cleanup**: Removes `[1]`, `[2]`, etc.
3. **Markdown Processing**: Converts bold/italic to speech emphasis
4. **Pronunciation Fixes**: Hong Kong-specific terms (LegCo → Legislative Council)
5. **Whitespace Normalization**: Optimal sentence breaks for speech flow

### Content Flow
```
Article Title + Content → SSML Processing → Google TTS API → Audio Playback → Visualization
```

## Performance Considerations

### Memory Management
- Automatic cleanup of audio resources
- Portal-based rendering to avoid layout thrashing
- Efficient animation loops with requestAnimationFrame

### Network Optimization
- Text chunking for Studio voices (5KB limit)
- Progressive audio loading
- Graceful fallback to browser TTS

### Mobile Performance
- Reduced animation complexity on mobile
- Optimized sample rates (44.1kHz mobile, 48kHz desktop)
- Hardware acceleration for smooth rendering

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

### Visualization Only
```typescript
import { useTTSVisualization } from '@/hooks/use-tts-redux'

const AudioVisualizer = () => {
  const { audioData, isPlaying } = useTTSVisualization()
  
  return (
    <div className="flex gap-1">
      {audioData.map((intensity, i) => (
        <div 
          key={i}
          className="bg-green-500"
          style={{ height: `${intensity * 100}%` }}
        />
      ))}
    </div>
  )
}
```

## Future Enhancements

- **Queue Management**: Multi-article playlist functionality
- **Speed Control**: Playback rate adjustment
- **Voice Selection**: User-configurable voice preferences
- **Offline Mode**: Enhanced browser TTS capabilities
- **Audio Effects**: EQ and audio enhancement options

---

*Last Updated: January 2025*
*Architecture: Redux-based with Google TTS integration*