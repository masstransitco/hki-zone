# OpenAI Image Generation Architecture

## Overview

This document outlines the architecture of the OpenAI-powered editorial image generation system integrated into the news article management platform. The system uses a sophisticated two-step AI process to generate contextually relevant, photojournalistic-quality images for Hong Kong news articles.

## High-Level Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Article Editor │────▶│   GPT-4 API     │────▶│  DALL-E 3 API   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                        │
         │                       ▼                        ▼
         │              ┌─────────────────┐     ┌─────────────────┐
         │              │ Contextual      │     │ Editorial Image │
         │              │ Prompt          │     │ Generation      │
         │              └─────────────────┘     └─────────────────┘
         │                                               │
         ▼                                               ▼
┌─────────────────┐                            ┌─────────────────┐
│ Trilingual Sync │◀───────────────────────────│ Supabase Storage│
└─────────────────┘                            └─────────────────┘
```

## Core Components

### 1. Frontend Integration

**Location**: `/components/admin/article-detail-sheet.tsx`

- **Green Button**: "Generate Editorial Image" - distinctive green gradient styling
- **Loading States**: Per-article tracking via global context
- **Toast Notifications**: Single updating toast with unique ID
- **Real-time Updates**: Supabase subscription for live image updates

### 2. API Endpoint

**Location**: `/app/api/admin/generate-openai-image/route.ts`

**Key Features**:
- Two-step AI process (GPT-4 → DALL-E 3)
- Retry logic for transient failures
- Image preprocessing with Sharp
- Automatic Supabase storage upload

### 3. AI Processing Pipeline

#### Step 1: GPT-4 Context Analysis
- **Model**: `gpt-4o`
- **Role**: Senior photo editor at Hong Kong news agency
- **Input**: Article title, content, summary, category
- **Output**: Optimized DALL-E 3 prompt

#### Step 2: DALL-E 3 Image Generation
- **Model**: `dall-e-3`
- **Size**: 1792x1024 (16:9 aspect ratio)
- **Quality**: HD
- **Style**: Natural (photorealistic)

### 4. Prompt Engineering

**GPT-4 System Prompt Includes**:

- **Hong Kong Context**: Specific districts, MTR stations, local atmosphere
- **Technical Specifications**: 
  - Camera: Nikon D850 or Canon 5D Mark IV
  - Lenses: 24-70mm, 50mm, 85mm
  - Settings: f/5.6-f/8, 1/500-1/1000s, ISO 100-800
- **Editorial Standards**: Reuters/AP/AFP quality
- **Restrictions**: No public figures, logos, text overlays

### 5. Image Sync System

**Location**: `/app/api/admin/articles/[id]/sync-image/route.ts`

- **Trilingual Support**: Syncs across en, zh-CN, zh-TW versions
- **Smart Linking**: Uses `original_article_id` for accurate matching
- **Batch Updates**: Handles multiple language versions efficiently

### 6. State Management

**Location**: `/contexts/image-generation-context.tsx`

- **Global Context**: Tracks generation states across all articles
- **Concurrent Support**: Multiple articles can generate simultaneously
- **Type-safe**: Full TypeScript support

## Data Flow

1. **User Action**: Click "Generate Editorial Image"
2. **Article Fetch**: Retrieve article data from Supabase
3. **GPT-4 Analysis**: Generate contextual prompt
4. **DALL-E 3 Generation**: Create photorealistic image
5. **Storage Upload**: Save to Supabase storage
6. **Database Update**: Update article `image_url`
7. **Trilingual Sync**: Propagate to related language versions
8. **Real-time Update**: Notify all connected clients

## Key Features

### Concurrent Generation
- Multiple articles can generate images simultaneously
- Each article tracks its own generation state
- No UI blocking between different articles

### Hong Kong Specificity
- District-specific locations (Central, Mong Kok, Tsim Sha Tsui)
- Local context (MTR, wet markets, tong lau buildings)
- Diverse representation of Hong Kong residents

### Editorial Quality
- Professional photojournalistic standards
- Neutral documentary tone
- Minimal post-processing aesthetic
- No sensationalism or propaganda

### Error Handling
- Retry logic for API timeouts
- Graceful fallbacks for prompt generation
- User-friendly error messages
- Silent fail for non-critical sync operations

## Environment Variables

```env
OPENAI_API_KEY=sk-proj-...
NEXT_PUBLIC_SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## Performance Considerations

- **Timeout**: 300 seconds for long-running generations
- **Image Preprocessing**: Max 2048px to reduce processing time
- **Retry Strategy**: 2 attempts with exponential backoff
- **Toast Management**: Single toast ID prevents overlap

## Security

- Service role key for server-side operations
- No public figure generation (privacy protection)
- No trademark/logo generation (copyright protection)
- Sanitized file names with UUIDs

## Future Enhancements

1. **Batch Generation**: Generate images for multiple articles at once
2. **Style Presets**: Different photographic styles per category
3. **Image Variations**: Generate multiple options per article
4. **Quality Metrics**: Track generation success rates
5. **Cost Optimization**: Monitor and optimize API usage

## Troubleshooting

### Common Issues

1. **Timeout Errors**: Increase `OPENAI_TIMEOUT_MS`
2. **Sync Failures**: Check `original_article_id` relationships
3. **Storage Errors**: Verify Supabase bucket permissions
4. **Prompt Issues**: Review GPT-4 system prompt for edge cases

### Debug Points

- API logs: Check console for prompt generation
- Network tab: Monitor API response times
- Supabase dashboard: Verify storage uploads
- React Query: Check cache updates

## Conclusion

The OpenAI image generation system provides a sophisticated, production-ready solution for generating editorial-quality images for Hong Kong news articles. By combining GPT-4's contextual understanding with DALL-E 3's photorealistic capabilities, the system delivers professional results suitable for modern digital journalism.