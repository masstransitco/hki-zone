# Unified Multilingual Government Feeds Architecture

## Overview

We've rebuilt the government feeds pipeline with a clean, unified architecture that ensures perfect content parity between English and Chinese languages. The new system automatically converts Traditional Chinese to Simplified Chinese when needed.

## Key Components

### 1. Database Schema (`/supabase/migrations/20240730_rebuild_multilingual_schema.sql`)

**Tables:**
- `gov_feeds_unified`: Stores feed configurations with URLs for all language variants
- `incidents_unified`: Stores content with unified multilingual structure

**Key Features:**
- Single record per incident with all language variants
- Content stored in JSONB format for flexibility
- Database function `get_incidents_with_language()` handles language fallback
- Automatic conversion tracking for Traditional to Simplified Chinese

### 2. Feed Processor (`/lib/government-feeds-unified.ts`)

**Features:**
- Fetches all language variants of each feed
- Merges multilingual content into single records
- Handles special Transport Department XML format
- Content deduplication using SHA256 hashing
- Automatic severity and relevance scoring

### 3. Chinese Converter (`/lib/chinese-converter.ts`)

**Features:**
- Uses OpenCC.js for accurate Traditional to Simplified Chinese conversion
- Converts titles, body text, and source names
- Preserves URLs without conversion
- Hong Kong variant support (hk → cn)

### 4. Unified API (`/app/api/signals-unified/route.ts`)

**Features:**
- Single endpoint for all languages
- Automatic Traditional to Simplified Chinese conversion
- Tracks conversion status in response
- Returns language coverage statistics
- Clean, predictable behavior

## Language Support

### Current Coverage:
- **English**: All feeds available
- **Traditional Chinese**: Most feeds available (some 404s need fixing)
- **Simplified Chinese**: Automatically converted from Traditional Chinese

### Automatic Conversion Flow:
1. User requests Simplified Chinese (`zh-CN`)
2. System checks for native Simplified Chinese content
3. If not available, fetches Traditional Chinese content
4. Converts using OpenCC.js with HK→CN rules
5. Returns converted content with `is_converted: true` flag

## API Usage

```typescript
// Fetch English content
GET /api/signals-unified?language=en

// Fetch Traditional Chinese content
GET /api/signals-unified?language=zh-TW

// Fetch Simplified Chinese (auto-converted if needed)
GET /api/signals-unified?language=zh-CN
```

### Response Format:
```json
{
  "signals": [{
    "id": "...",
    "title": "...",
    "source": "運輸署交通通告", // Proper Chinese department names
    "has_translation": true,
    "original_language": "zh-TW",
    "requested_language": "zh-CN",
    "is_converted": true // Indicates auto-conversion
  }],
  "metadata": {
    "language_coverage": [...] // Feed language availability
  }
}
```

## Benefits

1. **Content Parity**: All languages show the same content
2. **Simplified Storage**: One record per incident
3. **Automatic Conversion**: Simplified Chinese users get content automatically
4. **Clean API**: Single query with database-level language handling
5. **Proper Naming**: Chinese department names display correctly
6. **Future-Proof**: Easy to add more languages or feeds

## Feed Processing

Run the unified feed processor:
```bash
npx tsx scripts/process-unified-feeds.ts
```

Or via API:
```bash
curl -X POST http://localhost:3000/api/signals-unified \
  -H "Content-Type: application/json" \
  -d '{"action": "process_feeds"}'
```

## Next Steps

1. Fix remaining 404 Chinese feed URLs
2. Add proper error handling for malformed Transport Dept XML
3. Implement feed health monitoring
4. Add caching for converted content
5. Create admin UI for feed management