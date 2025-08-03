# News Briefs TTS Audio Pipeline Architecture

## Overview

The News Briefs TTS (Text-to-Speech) pipeline provides an automated system for generating professional-quality audio news broadcasts from AI-enhanced articles. The system produces 5-minute news briefs 3 times daily (morning, afternoon, evening) in multiple languages (English, Traditional Chinese, Simplified Chinese) using Google's Studio-quality TTS voices.

## Pipeline Flow

```
Articles Table → Article Selection → OpenAI Brief Generation → TTS Synthesis → Supabase Storage → Admin Playback
```

## Database Schema

### Core Tables

#### `news_briefs`
Primary table storing generated news brief scripts and metadata.

**Key Fields:**
- `id` (UUID) - Primary key
- `title` (string) - Brief title (e.g., "Morning News Brief - 8/3/2025")
- `content` (text) - Full TTS script content
- `language` (string) - Language code (en, zh-TW, zh-CN)
- `category` (string) - Brief type (morning, afternoon, evening)
- `estimated_duration_seconds` (integer) - Target duration for TTS
- `actual_word_count` (integer) - Word count for timing calculations
- `openai_model_used` (string) - AI model used for generation
- `generation_cost_usd` (decimal) - Cost of OpenAI generation
- `audio_url` (string) - Supabase storage URL for synthesized audio
- `audio_duration_seconds` (integer) - Actual audio duration
- `audio_file_path` (string) - Internal Supabase storage path
- `audio_file_size_bytes` (integer) - Audio file size
- `tts_synthesized_at` (timestamp) - When audio was generated
- `tts_synthesis_cost_usd` (decimal) - Cost of TTS synthesis
- `created_at` (timestamp) - Brief creation time

#### `news_brief_articles`
Junction table linking briefs to source articles.

**Key Fields:**
- `news_brief_id` (UUID) - Reference to news_briefs.id
- `article_id` (UUID) - Reference to articles.id
- `inclusion_reason` (string) - Why article was selected
- `article_weight` (decimal) - Importance score (0-1)

#### `articles` (Extended)
Existing articles table with TTS selection tracking.

**Added Fields:**
- `selected_for_tts_brief` (boolean) - Marked for TTS brief inclusion
- `tts_selection_metadata` (jsonb) - Selection scoring and metadata

## API Endpoints

### Core Generation APIs

#### `/api/news-briefs/generate` (POST)
**Purpose:** Generate new news brief scripts using OpenAI
**File:** `app/api/news-briefs/generate/route.ts`

**Features:**
- Smart article selection with category priorities
- OpenAI GPT-4o-mini integration for script generation
- Trilingual support with language-specific optimizations
- 5-minute target duration (750 words @ 150 WPM)
- Cost tracking and metadata storage

**Selection Algorithm:**
```typescript
const categoryPriorities = {
  morning: ['News', 'Politics', 'General', 'International', 'Local'],
  afternoon: ['General', 'International', 'News', 'Local', 'Politics'],
  evening: ['Local', 'General', 'News', 'International', 'Politics']
}
```

#### `/api/news-briefs/[id]/synthesize` (POST)
**Purpose:** Generate TTS audio from news brief text
**File:** `app/api/news-briefs/[id]/synthesize/route.ts`

**Features:**
- Google Text-to-Speech Studio voices for premium quality
- Language-optimized voice selection and settings
- Professional news anchor audio configuration
- Supabase Storage upload with public URLs
- Cost estimation and tracking
- Audio metadata storage

**Voice Configuration:**
- English: `en-US-Studio-Q` (Male Studio voice)
- Traditional Chinese: `yue-HK-Standard-B` (Cantonese)
- Simplified Chinese: `cmn-CN-Wavenet-C` (Mandarin)

#### `/api/news-briefs` (GET)
**Purpose:** Retrieve news briefs with filtering and statistics
**File:** `app/api/news-briefs/route.ts`

**Features:**
- Language and category filtering
- Date range queries
- Article relationship data
- Audio metadata inclusion
- Performance statistics

### Admin Management APIs

#### `/api/admin/news-briefs/select-articles` (GET/POST)
**Purpose:** Manage article selection for TTS briefs
**File:** `app/api/admin/news-briefs/select-articles/route.ts`

**Features:**
- AI-powered article scoring (0-100 scale)
- Manual and automatic selection modes
- Selection criteria filtering
- Bulk operations support

### Automation APIs

#### `/api/cron/generate-news-briefs` (POST)
**Purpose:** Automated generation for production scheduling
**File:** `app/api/cron/generate-news-briefs/route.ts`

**Features:**
- Multi-language batch generation
- Time-based brief type determination
- Error handling and reporting
- Production cron job integration

## TTS Service Architecture

### TTS Service Class
**File:** `services/ttsService.ts`

**Key Features:**
- Studio voice optimization for news broadcasting
- Language-specific audio configuration
- Content-aware speech rate adjustment
- Professional pitch and volume settings
- Efficient text chunking for API limits

**Audio Configuration:**
```typescript
audioConfig: {
  audioEncoding: 'MP3',
  sampleRateHertz: 24000,        // High quality for archival
  speakingRate: 1.1,             // News anchor pace
  pitch: -0.5,                   // Professional tone
  volumeGainDb: 2.0,             // Clear broadcast level
  effectsProfileId: ['large-home-entertainment-class-device']
}
```

### Audio Storage
**File:** `app/api/admin/database/setup-audio-storage/route.ts`

**Supabase Storage Setup:**
- Bucket: `audio-files`
- Path: `news-briefs/{brief-id}/audio-{language}-{timestamp}.mp3`
- Public access with CORS headers
- Storage policies for secure access

## Admin Interface

### News Briefs Admin Panel
**File:** `app/admin/news-briefs/page.tsx`

**Features:**
- 5-tab interface: Overview, Briefs, Articles, Generate, Settings
- Real-time audio playback with simplified state management
- TTS synthesis triggering and monitoring
- Article selection and scoring interface
- Performance metrics and cost tracking

**Simplified Audio Playback:**
```typescript
const playAudio = async (briefId: string, audioUrl: string) => {
  // Simple, direct approach - no complex state management
  const audio = new Audio(audioUrl)
  setCurrentAudio(audio)
  setPlayingBriefId(briefId)
  
  audio.onended = () => setPlayingBriefId(null)
  audio.onerror = () => toast.error('Audio playback failed')
  
  await audio.play()
}
```

## Content Processing

### Article Selection Algorithm
**Location:** `app/api/news-briefs/generate/route.ts`

**Selection Criteria:**
1. **Recency:** Articles from last 24 hours
2. **Language matching:** Exact language variant
3. **AI Enhancement:** Only AI-enhanced articles (summary available)
4. **Category scoring:** Priority-based selection by brief type
5. **Diversity:** Maximum 2 articles per source
6. **Quality threshold:** Minimum content length requirements

### OpenAI Integration
**Model:** GPT-4o-mini for cost-effective, high-quality generation

**Prompt Engineering:**
- Professional news anchor tone
- 5-minute target duration
- Language-specific optimizations
- Structured output with clear segments
- Citation and source attribution

## Data Flow

### 1. Article Enhancement Pipeline
```
Raw Articles → AI Enhancement → Summary Generation → TTS Selection Pool
```

### 2. Brief Generation Flow
```
Selection Criteria → Article Scoring → OpenAI Generation → Database Storage
```

### 3. TTS Synthesis Flow
```
Brief Content → Text Processing → Google TTS → Audio File → Supabase Storage
```

### 4. Admin Interface Flow
```
Admin Panel → Brief Management → TTS Trigger → Audio Playback
```

## Key Dependencies

### External Services
- **OpenAI GPT-4o-mini:** Script generation
- **Google Text-to-Speech:** Audio synthesis with Studio voices
- **Supabase Storage:** Audio file hosting with CDN

### Internal Services
- **Articles Pipeline:** Source of AI-enhanced content
- **Database:** PostgreSQL with Supabase
- **Authentication:** Supabase Auth for admin access

## Performance Considerations

### Cost Optimization
- **OpenAI:** ~$0.0015 per brief (optimized token usage)
- **Google TTS:** ~$0.016 per brief (Studio voices)
- **Storage:** Minimal cost with efficient audio encoding

### Scalability
- **Generation:** Supports 3x daily generation for 3 languages (9 briefs/day)
- **Storage:** Efficient MP3 encoding (~1.4MB per 5-minute brief)
- **Delivery:** CDN-backed Supabase Storage for global distribution

## Error Handling

### Robust Failure Management
- **Generation failures:** Graceful degradation with error reporting
- **TTS failures:** Retry logic and fallback options
- **Storage failures:** Cleanup and retry mechanisms
- **Playback failures:** Simplified error handling with user feedback

## Future Enhancements

### Planned Features
1. **Automated Scheduling:** Cron-based generation for production
2. **Advanced Audio Features:** Progress bars, playback speed control
3. **Multi-format Export:** Additional audio formats and download options
4. **Performance Analytics:** Detailed usage and engagement metrics
5. **Voice Customization:** Additional voice options and settings

This architecture provides a comprehensive, scalable solution for automated news brief generation and distribution with professional-quality audio output.