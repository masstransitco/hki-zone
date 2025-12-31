# HKI Zone Data Pipeline Assessment

**Assessment Date:** 2025-12-29
**Database:** Supabase (egyuetfeubznhcvmtary)
**Projects:** hki-zone (web), hki-zone-mobile

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Data Pipeline Workflow](#data-pipeline-workflow)
4. [Database Schema](#database-schema)
5. [Quality Metrics](#quality-metrics)
6. [Pipeline Performance](#pipeline-performance)
7. [AI Enhancement Rate Analysis](#ai-enhancement-rate-analysis)
8. [Issues & Recommendations](#issues--recommendations)

---

## Executive Summary

| Metric | Value | Status |
|--------|-------|--------|
| Total Articles | 210,176 | ✅ Healthy |
| AI Enhanced | 31,930 (15.2%) | ⚠️ Low |
| Image Coverage | 99.8% | ✅ Excellent |
| Quality Scored | 0% | ❌ Not Implemented |
| Gov Signals Complete | 12% | ❌ Pipeline Stuck |
| Perplexity News | 0 | ❌ Not Running |
| Daily Ingestion | ~1,000 articles | ✅ Consistent |
| Deduplication Rate | 7.4% | ✅ Effective |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                                  │
├─────────────────────────────────────────────────────────────────────┤
│  RSS Feeds          │  Government APIs    │  Perplexity AI          │
│  - SingTao          │  - Transport Dept   │  - sonar-pro model      │
│  - HK01             │  - HKMA             │  - HK news headlines    │
│  - am730            │  - Police           │  - Article enrichment   │
│  - on.cc            │  - HKO Weather      │                         │
│  - SCMP             │  - Immigration      │                         │
│  - RTHK             │                     │                         │
│  - bastillepost     │                     │                         │
│  - bloomberg        │                     │                         │
│  - HKFP             │                     │                         │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      INGESTION LAYER                                 │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐   │
│  │  RSS Scraper    │   │  Gov Feed       │   │  Perplexity     │   │
│  │  (Cron Job)     │   │  Scraper        │   │  HK News        │   │
│  │                 │   │                 │   │                 │   │
│  │  /api/cron/     │   │  Government     │   │  perplexity-    │   │
│  │  scrape-news    │   │  Feed Sources   │   │  hk-news.ts     │   │
│  └────────┬────────┘   └────────┬────────┘   └────────┬────────┘   │
│           │                     │                     │             │
│           ▼                     ▼                     ▼             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              DEDUPLICATION ENGINE                            │   │
│  │  - Embedding-based similarity detection                      │   │
│  │  - NLP verification for borderline cases                     │   │
│  │  - Clustering algorithm                                      │   │
│  │  - Avg 7.4% duplicate removal rate                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      STORAGE LAYER                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────┐  ┌──────────────────────┐                 │
│  │     articles         │  │  articles_unified    │                 │
│  │     (210,176)        │  │     (53,518)         │                 │
│  │                      │  │                      │                 │
│  │  - Legacy table      │  │  - Unified schema    │                 │
│  │  - Multiple sources  │  │  - Type: scraped,    │                 │
│  │  - AI enhancement    │  │    ai_generated,     │                 │
│  │    metadata          │  │    ai_enhanced       │                 │
│  └──────────────────────┘  └──────────────────────┘                 │
│                                                                      │
│  ┌──────────────────────┐  ┌──────────────────────┐                 │
│  │  government_signals  │  │  perplexity_news     │                 │
│  │     (4,310)          │  │     (0) ❌            │                 │
│  │                      │  │                      │                 │
│  │  - Transport notices │  │  - AI headlines      │                 │
│  │  - Police reports    │  │  - Enriched content  │                 │
│  │  - Weather warnings  │  │  - Image prompts     │                 │
│  │  - HKMA circulars    │  │                      │                 │
│  └──────────────────────┘  └──────────────────────┘                 │
│                                                                      │
│  ┌──────────────────────┐  ┌──────────────────────┐                 │
│  │  data_feed_sources   │  │  deduplication_      │                 │
│  │     (114,788)        │  │  metrics (205)       │                 │
│  │                      │  │                      │                 │
│  │  - Raw feed items    │  │  - Session logs      │                 │
│  │  - Processing queue  │  │  - Performance data  │                 │
│  └──────────────────────┘  └──────────────────────┘                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ENRICHMENT LAYER                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐   │
│  │  AI Summarizer  │   │  Headline       │   │  Image          │   │
│  │                 │   │  Quality Scorer │   │  Processing     │   │
│  │  - OpenAI       │   │                 │   │                 │   │
│  │  - Perplexity   │   │  - Mobile-first │   │  - Compression  │   │
│  │                 │   │  - ≤12 chars    │   │  - Optimization │   │
│  └─────────────────┘   └─────────────────┘   └─────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              TRILINGUAL PROCESSING                           │   │
│  │  - English (en)                                              │   │
│  │  - Traditional Chinese (zh-TW)                               │   │
│  │  - Simplified Chinese (zh-CN)                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      OUTPUT LAYER                                    │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐   │
│  │  Web App        │   │  Mobile App     │   │  News Briefs    │   │
│  │  (hki-zone)     │   │  (hki-zone-     │   │  (TTS Audio)    │   │
│  │                 │   │   mobile)       │   │                 │   │
│  └─────────────────┘   └─────────────────┘   └─────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Pipeline Workflow

### 1. News Scraping Pipeline

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Cron Job   │────▶│  Fetch RSS  │────▶│  Parse &    │────▶│  Store in   │
│  (15 min)   │     │  Feeds      │     │  Validate   │     │  data_feed_ │
│             │     │             │     │             │     │  sources    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                   │
                                                                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Mark as    │◀────│  Store in   │◀────│  Deduplicate│◀────│  Process    │
│  processed  │     │  articles   │     │  Content    │     │  Feed Items │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

**Endpoint:** `/api/cron/scrape-news`
**Schedule:** Every 15 minutes
**Sources:** 16 unique news sources

### 2. Government Signals Pipeline

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Gov Feed   │────▶│  Discover   │────▶│  Scrape     │────▶│  Extract    │
│  Sources    │     │  New Items  │     │  Content    │     │  Multilingual│
│  (36 feeds) │     │             │     │  (EN/ZH)    │     │  Content    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                   │
                          ┌────────────────────────────────────────┘
                          ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  government │────▶│  government │────▶│  Enrich &   │
│  _signals   │     │  _signals_  │     │  Categorize │
│             │     │  content    │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
```

**Processing Status Flow:**
```
discovered → content_partial → content_complete → enriched
```

**Current Issue:** 88% stuck at `content_partial`

### 3. AI Enhancement Pipeline

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Select     │────▶│  Quality    │────▶│  AI         │────▶│  Generate   │
│  Articles   │     │  Score      │     │  Summarize  │     │  Trilingual │
│  for Enhance│     │  Headlines  │     │  Content    │     │  Variants   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                   │
                                                                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────────────────────────┐
│  Update     │◀────│  Process    │◀────│  Store Enhanced Metadata:       │
│  articles   │     │  Images     │     │  - enhanced_title               │
│  table      │     │             │     │  - summary, key_points          │
└─────────────┘     └─────────────┘     │  - why_it_matters               │
                                        │  - image_metadata               │
                                        └─────────────────────────────────┘
```

### 4. Perplexity News Pipeline (NOT RUNNING)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Perplexity │────▶│  Generate   │────▶│  Enrich     │────▶│  Store in   │
│  API        │     │  Headlines  │     │  Articles   │     │  perplexity │
│  sonar-pro  │     │  (6/batch)  │     │             │     │  _news      │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

**Endpoint:** `/api/admin/perplexity/trigger-headlines`
**Status:** Table exists but empty (0 records)

---

## Database Schema

### Core Tables

#### `articles` (210,176 rows)
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| title | text | Article headline |
| content | text | Full article text |
| summary | text | Brief summary |
| ai_summary | text | AI-generated summary |
| url | text | Source URL (unique) |
| source | text | News source name |
| category | text | Article category |
| image_url | text | Featured image |
| is_ai_enhanced | boolean | Enhancement flag |
| quality_score | integer | Headline quality (0-100) |
| language_variant | varchar | en, zh-TW, zh-CN |
| created_at | timestamptz | Creation timestamp |

#### `articles_unified` (53,518 rows)
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| article_type | enum | scraped, ai_generated, ai_enhanced |
| processing_status | enum | pending, processing, ready, failed |
| status | enum | draft, published, archived |
| content | text | Article content |
| summary | text | Summary |
| key_points | jsonb | Array of key points |
| why_it_matters | text | Significance explanation |
| generation_cost | numeric | AI generation cost |

#### `government_signals` (4,310 rows)
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| source_identifier | text | Unique per notice |
| feed_group | text | Source feed group |
| category | enum | transport_notice, police, weather, etc. |
| priority_score | integer | 0-100 |
| processing_status | enum | discovered → content_complete → enriched |

#### `perplexity_news` (0 rows)
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| category | text | News category |
| title | text | Headline |
| article_status | text | pending, enriched, ready |
| article_html | text | Enriched HTML content |
| image_prompt | text | AI image generation prompt |
| generation_cost | numeric | API cost tracking |

---

## Quality Metrics

### Content Length Distribution

| Category | Count | Percentage | Assessment |
|----------|-------|------------|------------|
| Medium (200-500 chars) | 70,069 | 33.8% | ✅ Acceptable |
| Short (50-200 chars) | 62,570 | 30.2% | ⚠️ Brief |
| Long (1000+ chars) | 37,065 | 17.9% | ✅ Good depth |
| Very Short (<50 chars) | 26,259 | 12.7% | ❌ Stub content |
| Good (500-1000 chars) | 11,537 | 5.6% | ✅ Good |

### AI Content Quality

| Type | Avg Content Length | Assessment |
|------|-------------------|------------|
| Scraped | 233 chars | ⚠️ Brief snippets |
| AI Generated | 1,922 chars | ✅ Comprehensive |
| AI Enhanced | 1,683 chars | ✅ Good depth |

**Finding:** AI-generated content is **8x longer** than scraped content on average.

### Source Performance

| Source | Total | AI Enhanced | Enhancement Rate |
|--------|-------|-------------|------------------|
| SingTao | 58,133 | 8,378 | 14.4% |
| HK01 | 48,134 | 412 | 0.9% |
| am730 | 26,673 | 54 | 0.2% |
| on.cc | 22,483 | 6,150 | 27.4% |
| SCMP | 18,254 | 7,107 | 38.9% |
| bastillepost | 15,743 | 3,209 | 20.4% |
| RTHK | 14,243 | 3,780 | 26.5% |

### Category Distribution

| Category | Count | AI Enhanced |
|----------|-------|-------------|
| General | 114,845 | 3,059 (2.7%) |
| Local | 46,480 | 5,625 (12.1%) |
| International | 18,042 | 5,559 (30.8%) |
| Top Stories | 9,028 | 8,413 (93.2%) |
| News | 8,163 | 48 (0.6%) |
| Finance | 4,075 | 2,938 (72.1%) |
| Politics | 3,891 | 2,199 (56.5%) |

---

## Pipeline Performance

### Daily Ingestion (Last 7 Days)

| Date | Articles | AI Enhanced | Images |
|------|----------|-------------|--------|
| Dec 29 | 1,325 | 369 (28%) | 1,325 (100%) |
| Dec 28 | 1,171 | 492 (42%) | 1,171 (100%) |
| Dec 27 | 1,005 | 336 (33%) | 1,004 (100%) |
| Dec 26 | 780 | 0 (0%) | 778 (100%) |
| Dec 25 | 723 | 0 (0%) | 722 (100%) |
| Dec 24 | 906 | 0 (0%) | 906 (100%) |
| Dec 23 | 1,093 | 0 (0%) | 1,089 (100%) |

**Note:** AI enhancement was inactive Dec 23-26 (holiday period).

### Deduplication Performance (14-Day Average)

| Metric | Value |
|--------|-------|
| Daily sessions | ~90 |
| Original articles/day | ~4,400 |
| Unique stories/day | ~4,100 |
| Duplicates removed/day | ~300 |
| Reduction rate | 7.4% |
| Processing time | 3.4 seconds |
| Daily cost | $0.13 |

### Government Signals Status

| Category | Total | Complete | Partial | Completion Rate |
|----------|-------|----------|---------|-----------------|
| transport_notice | 2,427 | 91 | 2,336 | 3.7% |
| monetary_press | 1,081 | 0 | 1,081 | 0% |
| police | 274 | 272 | 2 | 99.3% |
| transport_press | 226 | 0 | 226 | 0% |
| weather_earthquake | 132 | 132 | 0 | 100% |
| weather_warning | 7 | 7 | 0 | 100% |

---

## AI Enhancement Rate Analysis

### Why Only 15.2% of Articles Are AI Enhanced

The 15.2% enhancement rate (31,930 of 210,176 articles) is **by design**, not a bug. The selection system in `lib/perplexity-article-selector.ts` implements multiple intentional constraints.

### Root Causes

| Limiting Factor | Configuration | Impact |
|-----------------|---------------|--------|
| **Time Windows** | 6h general, 3h local, 12h premium | Only recent articles are candidates |
| **Selection Count** | 3-10 articles per cron run | ~50-150 articles/day maximum |
| **Quality Threshold** | Score ≥80 required | Low-quality articles filtered out |
| **Source Quotas** | Premium: 15, Mainstream: 25, Local: 12 | Hard caps per source tier |
| **Topic Deduplication** | 4-day window | Similar stories not re-enhanced |

### Source Tier Configuration

The selector uses a tiered quota system:

```typescript
const SOURCE_TIERS = {
  premium:    { sources: ['HKFP', 'scmp', 'bloomberg', 'TheStandard'], quota: 15, maxAgeHours: 12 },
  mainstream: { sources: ['RTHK', 'SingTao', 'on.cc'], quota: 25, maxAgeHours: 6 },
  local:      { sources: ['HK01', 'am730', 'bastillepost'], quota: 12, maxAgeHours: 3 }
};
```

### Enhancement by Category

| Category | Total | Enhanced | Rate | Reason |
|----------|-------|----------|------|--------|
| Top Stories | 9,028 | 8,413 | **93.2%** | Highest scoring category |
| Finance | 4,075 | 2,938 | **72.1%** | Strong relevance signals |
| Politics | 3,891 | 2,199 | **56.5%** | High news value |
| International | 18,042 | 5,559 | **30.8%** | Moderate priority |
| Local | 46,480 | 5,625 | **12.1%** | Strict 3h time window |
| General | 114,845 | 3,059 | **2.7%** | Low scoring in rubric |
| News | 8,163 | 48 | **0.6%** | Generic category penalty |

### Enhancement by Source

| Source | Total | Enhanced | Rate | Tier |
|--------|-------|----------|------|------|
| SCMP | 18,254 | 7,107 | **38.9%** | Premium |
| RTHK | 14,243 | 3,780 | **26.5%** | Mainstream |
| on.cc | 22,483 | 6,150 | **27.4%** | Mainstream |
| bastillepost | 15,743 | 3,209 | **20.4%** | Local |
| SingTao | 58,133 | 8,378 | **14.4%** | Mainstream |
| HK01 | 48,134 | 412 | **0.9%** | Local (3h window) |
| am730 | 26,673 | 54 | **0.2%** | Local (3h window) |

**Key insight:** Local sources (HK01, am730) have a strict 3-hour time window, which drastically limits the pool of eligible articles.

### Scoring Rubric

Articles must score ≥80 to be selected. The scoring considers:

1. **Category weight** - Top Stories (+30), Politics (+25), Finance (+20)
2. **Source quality** - Premium sources score higher
3. **Recency** - Newer articles preferred
4. **Content signals** - Specific Hong Kong relevance terms
5. **Deduplication** - Topics enhanced in last 4 days penalized

### Options to Increase Enhancement Rate

| Option | Change | Expected Rate | Trade-off |
|--------|--------|---------------|-----------|
| Lower threshold | Score ≥60 | ~25% | Lower quality articles |
| Expand time windows | 12h all sources | ~30% | Less timely content |
| Increase selection count | 20 per run | ~25% | Higher API costs |
| Remove topic dedup | Disable 4-day window | ~20% | Redundant enhancements |

### Recommendation

The current 15% rate is a **reasonable balance** between quality, cost, and coverage. If higher coverage is desired:

1. **Quick win:** Increase selection count from 10 to 15 per run
2. **Medium effort:** Extend local source time window from 3h to 6h
3. **Consider carefully:** Lowering quality threshold below 80

---

## Issues & Recommendations

### Critical Issues

#### 1. Perplexity News Pipeline Not Running
**Status:** ❌ Critical
**Impact:** No AI-generated Hong Kong news headlines
**Table:** `perplexity_news` has 0 records
**Fix:**
- Verify PERPLEXITY_API_KEY is configured
- Check cron job at `/api/cron/scrape-news` or `/api/admin/perplexity/trigger-headlines`
- Review logs for API errors

#### 2. Government Signals Pipeline Stuck
**Status:** ❌ Critical
**Impact:** 88% of signals stuck at `content_partial`
**Affected:** 3,808 signals
**Fix:**
- Review scraping logic for multilingual content extraction
- Check for rate limiting or blocked requests
- Implement retry logic for failed scrapes

#### 3. Quality Scoring Not Implemented
**Status:** ⚠️ Medium
**Impact:** Cannot filter/rank articles by quality
**Finding:** `quality_score` is NULL for all 210K articles
**Fix:**
- Implement `headline-quality-scorer.ts` in the enrichment pipeline
- Run batch job to score existing articles

### Medium Priority Issues

#### 4. Very Short Content (12.7%)
**Impact:** 26,259 articles have <50 characters
**Sources most affected:** am730, HK01
**Fix:**
- Implement content completion pipeline using AI
- Add minimum content length validation
- Flag stub articles for manual review

#### 5. Inconsistent AI Enhancement Rates
**Observation:**
- TheStandard: 64% enhanced
- SCMP/Bloomberg: ~39% enhanced
- HK01: 0.9% enhanced
- am730: 0.2% enhanced

**Fix:**
- Review selection criteria for enhancement
- Prioritize high-traffic sources
- Balance enhancement across categories

#### 6. AI Enhancement Gap (Dec 23-26)
**Impact:** 4 days without AI processing
**Fix:**
- Implement monitoring/alerting for pipeline health
- Add fallback processing during holidays
- Create dashboard for pipeline status

### Low Priority Improvements

#### 7. Database Optimization
- Add indexes on frequently queried columns
- Implement table partitioning for `articles` (210K+ rows)
- Archive old articles (>6 months)

#### 8. Cost Tracking
- Current dedup cost: ~$0.13/day
- AI generation cost tracked in `generation_cost` column
- Implement cost alerting thresholds

---

## API Endpoints Reference

### News Scraping
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/cron/scrape-news` | GET | Trigger news scraping |
| `/api/headlines` | GET | Fetch headlines |
| `/api/articles/[id]` | GET | Get article by ID |

### Admin Operations
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/perplexity/trigger-headlines` | POST | Generate AI headlines |
| `/api/admin/perplexity/trigger-enrichment` | POST | Enrich pending articles |
| `/api/admin/articles/clone-with-ai` | POST | Create AI-enhanced clone |
| `/api/admin/auto-select-headlines` | POST | Auto-select for enhancement |

### Government Signals
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/signals/[id]` | GET | Get signal by ID |
| `/api/admin/signals` | GET | List all signals |
| `/api/admin/signals/enrich-incident` | POST | Enrich signal |

---

## Environment Configuration

### Required Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://egyuetfeubznhcvmtary.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
POSTGRES_URL=<pooler_url>

# AI Services
PERPLEXITY_API_KEY=<perplexity_key>
OPENAI_API_KEY=<openai_key>

# Image Services
GOOGLE_API_KEY=<google_key>
GOOGLE_CSE_ID=<custom_search_id>
UNSPLASH_ACCESS_KEY=<unsplash_key>
GETIMG_API_KEY=<getimg_key>

# Feature Flags
USE_RPC_ARTICLES=true
USE_RPC_ARTICLES_STATS=true
```

---

## Monitoring Checklist

### Daily Checks
- [ ] Articles ingested (target: 800-1,500/day)
- [ ] AI enhancement running (target: >20% of new articles)
- [ ] Deduplication rate (normal: 5-15%)
- [ ] No failed processing status

### Weekly Checks
- [ ] Government signals pipeline progress
- [ ] Perplexity news generation
- [ ] Content quality distribution
- [ ] Source coverage balance

### Monthly Checks
- [ ] Total article growth
- [ ] AI cost tracking
- [ ] Storage utilization
- [ ] Archive old content

---

*Document generated: 2025-12-29*
*Next review: 2026-01-05*
