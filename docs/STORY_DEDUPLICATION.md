# Story Deduplication System

## Overview

The Story Deduplication System prevents the same news story from being enhanced multiple times when it appears across different sources. It uses a sophisticated hybrid approach combining OpenAI embeddings and NLP verification to identify duplicate stories even when they have different titles or are in different languages.

## Problem Solved

Previously, the same news story would be enhanced multiple times if it appeared in different sources:
- "港深警方聯手破跨境假飛集團拘12人" (bastillepost)
- "HK-Shenzhen Police Bust Cross-Border Fake Ticket Syndicate" (RTHK)  
- "假演唱會飛｜港深拘12人檢490張G-Dragon等高仿票" (HK01)

These are all the same story but would be treated as different articles, leading to:
- Redundant API calls and costs
- Repetitive content in the feed
- Poor user experience

## Architecture

```
Candidate Articles (50)
    ↓
[1] Generate Embeddings (OpenAI text-embedding-3-small)
    ↓
[2] Cluster by Similarity (cosine similarity > 0.85)
    ↓
[3] NLP Verification for borderline cases (0.70-0.85)
    ↓
[4] Select best article from each cluster
    ↓
Selected Unique Articles (10-15)
    ↓
Send to Perplexity for final selection (3)
```

## Components

### 1. Embeddings Service (`/lib/embeddings-service.ts`)
- Generates vector embeddings using OpenAI's text-embedding-3-small model
- Calculates cosine similarity between article pairs
- Clusters articles with >85% similarity
- Identifies borderline cases (70-85% similarity) for NLP verification

### 2. Story Deduplicator (`/lib/story-deduplicator.ts`)
- Main deduplication pipeline
- Selects best article from each cluster based on:
  - Content length
  - Source reliability score
  - Recency
  - Image availability
- Verifies borderline cases using GPT-4o-mini

### 3. Article Selector Integration (`/lib/perplexity-article-selector.ts`)
- Runs deduplication before sending to Perplexity
- Stores deduplication metadata for monitoring
- Feature flag for enabling/disabling: `ENABLE_STORY_DEDUP`

## Source Reliability Scoring

Articles are ranked by source reliability when selecting the best version:

```typescript
const SOURCE_RELIABILITY_SCORES = {
  'scmp': 9,
  'bloomberg': 9,
  'HKFP': 8,
  'RTHK': 8,
  'TheStandard': 7,
  'SingTao': 6,
  'HK01': 6,
  'on.cc': 5,
  'am730': 5,
  'bastillepost': 4
}
```

## Configuration

### Environment Variables

```env
# Required for deduplication
OPENAI_API_KEY=your-openai-api-key

# Optional - disable deduplication
ENABLE_STORY_DEDUP=false  # Set to false to disable
```

### Cost Analysis

Per selection cycle (50 articles):
- **Embeddings:** 50 articles × $0.00002 = $0.001
- **NLP Verification:** ~5 borderline cases × $0.00015 = $0.00075
- **Total:** ~$0.00175 per selection

Daily cost (96 selections/day):
- $0.00175 × 96 = **$0.168/day**
- Monthly: ~**$5.04**

## Monitoring

The system tracks deduplication effectiveness in the database:

```json
{
  "deduplication_stats": {
    "original_count": 50,
    "unique_stories": 15,
    "duplicates_removed": 35,
    "cluster_info": {
      "cluster_id": "cluster_1_abc123",
      "cluster_size": 4,
      "sources_in_cluster": ["bastillepost", "RTHK", "HK01", "am730"],
      "average_similarity": 0.92
    }
  }
}
```

## Expected Results

### Before (Without Deduplication)
- 50 candidate articles → 3 selected
- Same story enhanced 4-5 times from different sources
- ~87 duplicate enhancements per day

### After (With Deduplication)
- 50 candidate articles → 15-20 unique stories → 3 selected
- Each story enhanced only once (best source chosen)
- 70-80% reduction in duplicate enhancements
- More diverse content in feed

## Logging

The system provides detailed logging:

```
🧬 Cross-Source Story Deduplication:
   • Running advanced deduplication using embeddings + NLP...
   ✅ Deduplication successful:
      • Original articles: 50
      • Unique stories: 15
      • Duplicates removed: 35
      • Average cluster size: 2.3
      • Largest cluster: 4 articles
```

## Rollback

If issues arise, disable deduplication without code changes:

```bash
# Set in .env.local
ENABLE_STORY_DEDUP=false
```

## Testing

Test the deduplication system:

```bash
# Call the selection API with deduplication enabled
curl -X POST http://localhost:3000/api/cron/select-article \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json"
```

Check logs for deduplication statistics.

## Future Improvements

1. **Caching:** Cache embeddings for recently seen articles
2. **Batch Processing:** Process multiple selection cycles together
3. **Language-Aware:** Better handling of Traditional/Simplified Chinese
4. **Entity Extraction:** Use named entity recognition for better matching
5. **Feedback Loop:** Learn from user engagement to improve selection

## Troubleshooting

### "OpenAI API key not configured"
Ensure `OPENAI_API_KEY` is set in `.env.local`

### Deduplication not running
Check that:
1. `ENABLE_STORY_DEDUP` is not set to `false`
2. There are more than 5 candidate articles
3. OpenAI API key is valid

### High similarity but not clustered
Adjust the similarity threshold in `/lib/story-deduplicator.ts`:
```typescript
clusterBySimilarity(articles, embeddings, 0.85) // Lower to 0.80 for more aggressive clustering
```

## Implementation Date

- **Created:** August 10, 2025
- **Author:** Claude (with human guidance)
- **Status:** Production Ready