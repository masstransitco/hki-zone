# AI Article Enhancement Pipeline Architecture

**Last Updated:** October 6, 2025
**Version:** 1.0

## Overview

The AI Enhancement Pipeline is a fully automated system that transforms raw scraped news articles into high-quality, trilingual (English, Traditional Chinese, Simplified Chinese) enhanced articles. The pipeline consists of two main phases:

1. **Selection Phase**: AI intelligently selects the best articles from scraped sources
2. **Enhancement Phase**: Selected articles are enhanced with AI-powered research, context, and multilingual translations

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    SCRAPED ARTICLES DATABASE                     │
│                  (Raw articles from 10+ sources)                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       SELECTION PHASE                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 1. Fetch Candidates (last 6 hours)                        │  │
│  │    - Source diversity quotas (premium/mainstream/local)   │  │
│  │    - Quality filtering (min content length)               │  │
│  │    - Title deduplication                                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                             │                                    │
│                             ▼                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 2. Cross-Source Story Deduplication                       │  │
│  │    - Embeddings + NLP similarity detection                │  │
│  │    - Cluster duplicate stories from different outlets     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                             │                                    │
│                             ▼                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 3. Topic Similarity Filtering                             │  │
│  │    - Compare against recently enhanced articles           │  │
│  │    - Jaccard similarity + keyword overlap                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                             │                                    │
│                             ▼                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 4. AI Selection (Perplexity Sonar Pro)                    │  │
│  │    - Scoring rubric: Impact, Novelty, Depth, Source div   │  │
│  │    - Select top 3 articles (score ≥80)                    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                             │                                    │
│                             ▼                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 5. AI Category Assignment (OpenAI GPT-4o-mini)            │  │
│  │    - Categorize selected articles                         │  │
│  │    - 10 categories: Top Stories, Tech, Finance, etc.      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                             │                                    │
│                             ▼                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 6. Mark as Selected in Database                           │  │
│  │    - Set selected_for_enhancement = true                  │  │
│  │    - Store selection metadata (reason, score, session)    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ENHANCEMENT PHASE                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 1. Fetch Selected Articles (up to 3)                      │  │
│  │    - Query: selected_for_enhancement=true                 │  │
│  │    - Order: priority_score DESC, selected_at ASC          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                             │                                    │
│                             ▼                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 2. For Each Article:                                      │  │
│  │    ┌─────────────────────────────────────────────────┐    │  │
│  │    │ a) Contextual Enrichment (Perplexity)           │    │  │
│  │    │    - Enhanced title, lede, body                 │    │  │
│  │    │    - Key points, why it matters                 │    │  │
│  │    │    - Citations and sources                      │    │  │
│  │    └─────────────────────────────────────────────────┘    │  │
│  │                          │                                 │  │
│  │                          ▼                                 │  │
│  │    ┌─────────────────────────────────────────────────┐    │  │
│  │    │ b) Image Search (Perplexity)                    │    │  │
│  │    │    - If no image exists                         │    │  │
│  │    │    - Find relevant, licensed image              │    │  │
│  │    └─────────────────────────────────────────────────┘    │  │
│  │                          │                                 │  │
│  │                          ▼                                 │  │
│  │    ┌─────────────────────────────────────────────────┐    │  │
│  │    │ c) Trilingual Enhancement (Perplexity V4)       │    │  │
│  │    │    - Two-phase: Search + Generation             │    │  │
│  │    │    - Output: 3 versions (EN, zh-TW, zh-CN)      │    │  │
│  │    │    - Structured content with citations          │    │  │
│  │    └─────────────────────────────────────────────────┘    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                             │                                    │
│                             ▼                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 3. Save Enhanced Articles (3 per source article)          │  │
│  │    - Insert trilingual versions into database             │  │
│  │    - Link to source article via source_article_id         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                             │                                    │
│                             ▼                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 4. Mark Source Articles as Processed                      │  │
│  │    - Set selected_for_enhancement = false                 │  │
│  │    - Store enhancement metadata                           │  │
│  │    - Store enhanced_article_ids for tracking              │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  ENHANCED ARTICLES DATABASE                      │
│             (3 language versions per source article)             │
└─────────────────────────────────────────────────────────────────┘
```

## Cron Job Schedule

All cron jobs are configured in `vercel.json`:

| Cron Job | Path | Schedule | Description |
|----------|------|----------|-------------|
| **Select Articles** | `/api/cron/select-article` | Every 15 min (0,15,30,45) | AI selects top 3 articles for enhancement |
| **Enhance Selected** | `/api/cron/enhance-selected` | Every 15 min (5,20,35,50) | Enhances selected articles into trilingual versions |
| **Cleanup Stuck** | `/api/cron/cleanup-stuck-selections` | Every 30 min (10,40) | Resets articles selected >4h ago but not enhanced |

**Note:** Enhancement runs 5 minutes after selection to ensure selected articles are available.

## AI API Agents

### 1. **Perplexity Sonar Pro** (Primary AI)
- **Purpose**: Article selection, trilingual enhancement, contextual enrichment
- **Model**: `sonar-pro`
- **Cost**: ~$0.025 per source article (trilingual output)
- **Features**:
  - Search-augmented generation
  - Real-time web search capabilities
  - Citation extraction
  - Multilingual support

### 2. **OpenAI GPT-4o-mini** (Category Assignment)
- **Purpose**: Intelligent article categorization
- **Model**: `gpt-4o-mini`
- **Cost**: Minimal (~$0.001 per article)
- **Categories**: Top Stories, Tech & Science, Finance, Arts & Culture, Sports, Entertainment, Politics, Local, International, General

### 3. **Perplexity Image Search** (Optional)
- **Purpose**: Find relevant, licensed images for articles without images
- **Model**: Perplexity search API
- **Cost**: Minimal (search only)

## File Structure

### Core Pipeline Files

#### Selection Phase
| File | Purpose | Status |
|------|---------|--------|
| `app/api/cron/select-article/route.ts` | Selection cron endpoint | ✅ Active |
| `lib/perplexity-article-selector.ts` | Main selection logic with AI scoring | ✅ Active |
| `lib/story-deduplicator.ts` | Cross-source deduplication using embeddings | ✅ Active |

#### Enhancement Phase
| File | Purpose | Status |
|------|---------|--------|
| `app/api/cron/enhance-selected/route.ts` | Enhancement cron endpoint | ✅ Active |
| `lib/perplexity-trilingual-enhancer.ts` | Orchestrates trilingual enhancement | ✅ Active |
| `lib/perplexity-enhancer-v4.ts` | Two-phase enhancement (search + generation) | ✅ Active |
| `lib/perplexity-enhancer-v2.ts` | One-shot trilingual generation (fallback) | ✅ Active |
| `lib/perplexity-hk-news.ts` | Contextual enrichment utilities | ✅ Active |
| `lib/perplexity-image-search.ts` | Image discovery and licensing | ✅ Active |
| `lib/article-saver.ts` | Saves enhanced articles to database | ✅ Active |
| `lib/enhancement-helpers.ts` | Shared utilities (retry, dedup, ranking) | ✅ Active |

#### Utilities
| File | Purpose | Status |
|------|---------|--------|
| `lib/perplexity-utils.ts` | Shared Perplexity API utilities | ✅ Active |
| `app/api/cron/cleanup-stuck-selections/route.ts` | Cleanup stale selections | ✅ Active |

### Legacy/Redundant Files (Can Be Deleted)

⚠️ **IMPORTANT**: Before deleting, validate these files are not imported in production code.

The following files are no longer used in production and can be safely deleted:

#### Deprecated Enhancement Libraries

| File | Reason for Redundancy | Replaced By | Last Modified |
|------|----------------------|-------------|---------------|
| `lib/perplexity-enhancer.ts` | Original enhancer, superseded by V2 | `perplexity-enhancer-v2.ts` | Jul 15, 2024 |
| `lib/perplexity-enhancer-v3.ts` | Experimental version, never used in production | `perplexity-enhancer-v4.ts` | Jul 29, 2024 |
| `lib/perplexity-hk-news-improved.ts` | Improved version never integrated | `perplexity-hk-news.ts` | Jul 15, 2024 |
| `lib/perplexity-headline-generator.ts` | Standalone headline generation, not used | Built into enhancers | Jul 15, 2024 |

#### Development/Testing Files

| File | Purpose | Status |
|------|---------|--------|
| `test-enhanced-token-limit.ts` | Token limit testing | Dev only |
| `test-search-enhancement.ts` | Search enhancement testing | Dev only |
| `test-oneshot-api.ts` | One-shot API testing | Dev only |
| `test-oneshot-direct.ts` | Direct one-shot testing | Dev only |
| `test-enhance-direct.js` | Direct enhancement testing | Dev only |
| `test-api-endpoint.sh` | API endpoint testing script | Dev only |
| `app/api/test-oneshot/route.ts` | Development testing endpoint | Dev only |

#### Deprecated Admin Endpoints

| File | Reason | Status |
|------|--------|--------|
| `app/api/admin/articles/clone-with-ai/route.ts` | Old manual cloning endpoint | Replaced by automated pipeline |
| `app/api/admin/articles/bulk-clone/route.ts` | Old bulk cloning endpoint | Replaced by automated pipeline |

#### Validation Checklist

Before deleting any file, verify:

1. ✅ File is not imported in any `/app` route
2. ✅ File is not imported in any active `/lib` module
3. ✅ File is not referenced in `vercel.json` or deployment config
4. ✅ File is not used in any production npm scripts

**Quick Validation Commands:**

```bash
# Check if a file is imported anywhere in production code
rg "perplexity-enhancer\.ts" app/ lib/ --type ts
rg "perplexity-enhancer-v3" app/ lib/ --type ts
rg "perplexity-hk-news-improved" app/ lib/ --type ts
rg "perplexity-headline-generator" app/ lib/ --type ts
rg "clone-with-ai" app/ lib/ --type ts
rg "bulk-clone" app/ lib/ --type ts

# List all test files
ls -lah test-*.{ts,js} 2>/dev/null
```

**Deletion Commands (run after validation):**

```bash
# Remove deprecated libraries
rm lib/perplexity-enhancer.ts
rm lib/perplexity-enhancer-v3.ts
rm lib/perplexity-hk-news-improved.ts
rm lib/perplexity-headline-generator.ts

# Remove test files (optional - can keep for reference)
rm test-enhanced-token-limit.ts
rm test-search-enhancement.ts
rm test-oneshot-api.ts
rm test-oneshot-direct.ts
rm test-enhance-direct.js
rm test-api-endpoint.sh

# Remove deprecated admin endpoints
rm app/api/test-oneshot/route.ts
rm app/api/admin/articles/clone-with-ai/route.ts
rm app/api/admin/articles/bulk-clone/route.ts
```

**Total Space Saved**: ~150KB (code) + improved codebase clarity

## Database Schema

### Articles Table (Relevant Fields)

```sql
CREATE TABLE articles (
  id UUID PRIMARY KEY,
  title TEXT,
  content TEXT,
  summary TEXT,
  url TEXT,
  source TEXT,
  category TEXT,
  language TEXT DEFAULT 'en',

  -- Selection tracking
  selected_for_enhancement BOOLEAN DEFAULT false,
  selection_metadata JSONB,

  -- Enhancement tracking
  is_ai_enhanced BOOLEAN DEFAULT false,
  enhancement_metadata JSONB,

  -- Trilingual linking
  source_article_id UUID,
  trilingual_batch_id TEXT,
  language_variant TEXT,
  language_order INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ
);

-- Critical indexes for performance
CREATE INDEX idx_articles_selection_enhancement
  ON articles(selected_for_enhancement, is_ai_enhanced)
  WHERE selected_for_enhancement = true AND is_ai_enhanced = false;

CREATE INDEX idx_articles_priority_score
  ON articles(((selection_metadata->>'priority_score')::int))
  WHERE selected_for_enhancement = true;

CREATE INDEX idx_articles_selected_at
  ON articles((selection_metadata->>'selected_at'))
  WHERE selected_for_enhancement = true;
```

### Selection Metadata Structure

```json
{
  "selected_at": "2025-10-06T10:15:00Z",
  "selection_reason": "Selected with score 86 (I:5 N:4 D:3 S:4 U:5) - High impact for HK readers",
  "priority_score": 86,
  "perplexity_selection_id": "01",
  "selection_session": "selection_1728209700000_abc123",
  "selection_method": "perplexity_ai",
  "ai_category_assigned": "Tech & Science",
  "category_confidence": 9,
  "deduplication_stats": {
    "original_count": 45,
    "unique_stories": 38,
    "duplicates_removed": 7,
    "cluster_info": {
      "cluster_id": "cluster_001",
      "cluster_size": 3,
      "sources_in_cluster": ["SCMP", "HKFP", "RTHK"],
      "average_similarity": 0.78
    }
  }
}
```

### Enhancement Metadata Structure

```json
{
  "enhanced_at": "2025-10-06T10:20:00Z",
  "trilingual_versions_created": 3,
  "batch_id": "enhance_selected_1728209700000_xyz789",
  "processing_time_ms": 12500,
  "estimated_cost": 0.025,
  "enhancement_method": "cron_trilingual",
  "enhanced_article_ids": ["uuid1", "uuid2", "uuid3"],
  "source_article_status": "enhanced_children_created",
  "language": "en",
  "enhancedTitle": "Hong Kong's Tech Hub Initiative Secures $500M Funding",
  "enhancedSummary": "The Hong Kong government announces...",
  "keyPoints": ["Point 1", "Point 2", "Point 3"],
  "whyItMatters": "This development signals...",
  "sources": [
    {
      "url": "https://news.gov.hk/...",
      "title": "Official Government Announcement",
      "domain": "news.gov.hk",
      "snippet": "The Financial Secretary announced...",
      "accessedAt": "2025-10-06T10:20:00Z"
    }
  ]
}
```

## Selection Algorithm

### Source Diversity Quotas

The system maintains balanced representation across 3 source tiers:

| Tier | Sources | Quota | Max Age | Min Quality | Weight |
|------|---------|-------|---------|-------------|--------|
| **Premium** | HKFP, SCMP, Bloomberg, TheStandard | 15 | 12h | 200 chars | 100 |
| **Mainstream** | RTHK, SingTao, on.cc | 25 | 6h | 100 chars | 80 |
| **Local** | HK01, am730, BastillePost | 12 | 3h | 50 chars | 60 |

### Scoring Rubric (Perplexity AI)

Each candidate article is scored using the INDSU rubric:

```
Score = (I × 4) + (N × 3) + (D × 2) + (S × 1) + (U × 5)

Where:
- I (Impact): 1-5, How directly this affects HK residents/economy/policy
- N (Novelty): 1-5, How fresh/unique vs recent coverage
- D (Depth): 1-5, Word count & content richness
- S (Source diversity): 1-5, Variety across final selection
- U (Under-served topic): 1-5, Fills gap in recent coverage

Minimum score: 80/100 (only high-quality articles selected)
```

### Deduplication Strategy

1. **Title-based deduplication**: Normalize and compare first 50 chars
2. **Cross-source story clustering**: Embeddings + NLP similarity detection
3. **Topic similarity filtering**: Compare against recently enhanced articles (7 days)
   - Jaccard similarity on normalized titles
   - Keyword overlap detection
   - Combined score threshold: 50%

## Enhancement Process

### Phase 1: Contextual Enrichment

Uses `perplexity-hk-news.ts` to add context:
- Enhanced title and lede
- Key points extraction
- Why it matters analysis
- Citations and sources

### Phase 2: Trilingual Enhancement

Uses `perplexity-enhancer-v4.ts` with two-phase approach:

1. **Search Phase**:
   - Generate 5 diverse search queries
   - Perform parallel searches with retry
   - Deduplicate and rank results
   - Extract top 10 sources

2. **Generation Phase**:
   - Build augmented prompt with search context
   - Generate trilingual content in one API call
   - Parse structured response (EN, zh-TW, zh-CN)
   - Validate and enrich with citations

**Fallback**: If V4 fails, falls back to `perplexity-enhancer-v2.ts` (one-shot generation)

### Content Formatting

Enhanced articles include:
- **Summary** section with citation
- **Key Points** (max 5) with bold formatting
- **Why It Matters** section
- **Sources** section (numbered citations)

Example output structure:
```markdown
**Summary**
Hong Kong's innovation sector receives major boost with $500M government funding...[1]

**Key Points**
• **$500M investment**: Largest tech funding in HK history, targeting AI startups
• **Timeline**: Funding available from Q1 2025, applications open December
• **Focus areas**: AI, biotech, fintech, and green technology sectors
• **Expected impact**: 5,000 new jobs, 200+ startups supported over 3 years[2]

**Why It Matters**
This development positions Hong Kong as a regional innovation hub...[3]

## Sources
1. [Government Announcement](https://news.gov.hk/...) - news.gov.hk
2. [SCMP Analysis](https://scmp.com/...) - scmp.com
```

## Cost Breakdown

### Per Article Enhancement

- **Selection (3 articles)**: ~$0.003 (Perplexity Sonar Pro)
- **Category Assignment (3 articles)**: ~$0.003 (OpenAI GPT-4o-mini)
- **Contextual Enrichment**: ~$0.015 per article (Perplexity)
- **Image Search** (if needed): ~$0.002 per article (Perplexity)
- **Trilingual Enhancement**: ~$0.025 per article (Perplexity V4, 3 languages)

**Total per source article**: ~$0.045 (generates 3 enhanced versions)
**Effective cost per enhanced article**: ~$0.015

### Daily Estimates

- **Selections**: 96 cron runs/day × 3 articles = ~$0.288/day
- **Enhancements**: ~288 source articles × $0.045 = ~$12.96/day
- **Total**: ~$13.25/day = ~$397/month

**Note**: Actual costs are lower due to:
- Not all selections result in enhancements
- Deduplication reduces duplicate processing
- Stale selection cleanup prevents redundant work

## Monitoring and Health Checks

### Critical Metrics

1. **Selection Health**:
   - Candidate pool size (should be >20 articles)
   - Deduplication effectiveness (% filtered)
   - AI selection success rate
   - Source diversity in selections

2. **Enhancement Health**:
   - Processing time per article (<20s target)
   - Enhancement success rate (should be >95%)
   - API error rates
   - Cost per article

3. **Database Health**:
   - Stuck selections count (selected >4h ago)
   - Enhancement backlog (selected but not enhanced)
   - Query performance on indexed fields

### Logging

All cron jobs log extensively:
- Start/end timestamps (UTC + HKT)
- Article counts at each stage
- AI decision reasoning
- Error details with stack traces
- Performance metrics

View logs in Vercel dashboard or via `vercel logs` CLI.

## Troubleshooting

### Common Issues

**Issue**: No articles being selected
- **Check**: Candidate pool size in logs
- **Fix**: Review source diversity quotas, adjust time windows

**Issue**: Enhancement fails with timeout
- **Check**: Processing time in logs
- **Fix**: Increase Vercel function timeout (currently 60s)

**Issue**: Duplicate stories appearing
- **Check**: Deduplication stats in logs
- **Fix**: Adjust similarity threshold, review clustering algorithm

**Issue**: High API costs
- **Check**: Cost estimates in logs
- **Fix**: Reduce selection frequency, adjust max articles per run

**Issue**: Stuck selections piling up
- **Check**: Enhancement success rate
- **Fix**: Review cleanup cron logs, check for API failures

## Future Improvements

1. **Dynamic Selection Frequency**: Adjust based on candidate pool size
2. **Multi-tier Enhancement**: Fast-track breaking news with higher priority
3. **Quality Feedback Loop**: Track user engagement to refine selection scoring
4. **Cost Optimization**: Batch API calls, use cheaper models for simple tasks
5. **Advanced Deduplication**: Implement semantic similarity with vector embeddings

---

## Quick Reference

### Key Commands

```bash
# View selection logs
vercel logs --follow --filter="select-article"

# View enhancement logs
vercel logs --follow --filter="enhance-selected"

# Check database for stuck selections
PGPASSWORD=xxx psql "postgres://..." -c "SELECT COUNT(*) FROM articles WHERE selected_for_enhancement=true AND is_ai_enhanced=false"

# Monitor enhancement backlog
PGPASSWORD=xxx psql "postgres://..." -c "SELECT source, COUNT(*) FROM articles WHERE selected_for_enhancement=true GROUP BY source"
```

### Environment Variables Required

```env
PERPLEXITY_API_KEY=pplx-xxx
OPENAI_API_KEY=sk-xxx
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
CRON_SECRET=xxx (optional, for manual testing)
ENABLE_STORY_DEDUP=true (default)
```

### File Import Paths

```typescript
// Selection
import { selectArticlesWithPerplexity } from '@/lib/perplexity-article-selector'

// Enhancement
import { batchEnhanceTrilingualArticles } from '@/lib/perplexity-trilingual-enhancer'
import { saveEnhancedArticles } from '@/lib/article-saver'
import { perplexityHKNews } from '@/lib/perplexity-hk-news'
import { perplexityImageSearch } from '@/lib/perplexity-image-search'
```

---

**Document Status**: Complete
**Next Review**: When pipeline architecture changes
