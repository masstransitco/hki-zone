# Trilingual AI Article Enhancement System

## Overview

The Trilingual AI Enhancement feature is a streamlined automated content processing system that uses Perplexity AI to intelligently select the most newsworthy articles and enhance them into three languages: English, Traditional Chinese (繁體中文), and Simplified Chinese (简体中文). 

**Updated Pipeline (January 2025)**: The system now processes 1 article per hour with topic deduplication, creating 3 enhanced versions through a two-stage process that runs every hour.

> **📋 Current Status**: This system has been streamlined from bulk processing (10→30 articles) to focused hourly processing (1→3 articles) with intelligent topic deduplication. See [Streamlined Pipeline Update](./25-streamlined-article-pipeline-update.md) for complete migration details.

## Features

### 🤖 Intelligent Article Selection
- **AI-Powered Curation**: Perplexity AI analyzes candidate articles (typically 15-25 after filtering) and selects the most newsworthy
- **Quality Scoring**: Advanced scoring algorithm based on:
  - Newsworthiness and timeliness
  - Public interest and impact
  - Content quality and completeness (minimum 100 characters)
  - Enhancement potential
- **Source Diversity**: Ensures representation across different Hong Kong news sources
- **Anti-Hallucination Safeguards**: Strict content filtering and prompt engineering to prevent AI from referencing external knowledge

### 🌐 Trilingual Processing
- **Sequential Enhancement**: Each selected article is enhanced in order (EN → zh-TW → zh-CN)
- **Language-Specific Optimization**: Content tailored for each language's audience and cultural context
- **Unique URL Generation**: Each language version gets a unique URL to avoid database constraints
- **Structured Content**: Consistent format with enhanced titles, summaries, key points, and significance analysis

### 📊 Batch Management
- **Batch Tracking**: All articles in a trilingual batch are linked with `trilingual_batch_id`
- **Relationship Management**: Easy querying of related articles across languages
- **Processing Metrics**: Real-time tracking of enhancement progress and costs
- **Error Handling**: Robust error recovery and partial batch processing

## System Architecture

### Processing Pipeline

```
1. Article Candidate Selection
   ├── Fetch 50 recent articles where is_ai_enhanced = false AND selected_for_enhancement = false
   ├── Apply quality filters:
   │   ├── Content length ≥ 100 characters (prevents AI hallucination)
   │   ├── Title validation and test content filtering
   │   └── Source and metadata validation
   └── AI-powered topic deduplication (filters 50 → ~20 unique articles)

2. Perplexity AI Selection
   ├── Send deduplicated articles with sequential IDs (1, 2, 3...) to Perplexity
   ├── Anti-hallucination prompt engineering (restricts to provided content only)
   ├── AI analyzes newsworthiness based solely on article titles and previews
   ├── Returns ranked list with sequential IDs and reasoning
   └── Mark selected articles as selected_for_enhancement = true with metadata

3. Trilingual Enhancement
   ├── For each selected article:
   │   ├── English Enhancement (Perplexity API)
   │   ├── Traditional Chinese Enhancement (1.5s delay)
   │   └── Simplified Chinese Enhancement (1.5s delay)
   └── Rate limiting: 2s between articles

4. Database Storage
   ├── Generate unique URLs for each language version
   ├── Store trilingual metadata in enhancement_metadata
   ├── Link articles with trilingual_batch_id
   └── Track processing metrics and costs
```

### Data Flow

```
Source Articles (DB) → Quality Filter → Deduplication → AI Selection → Enhancement → Storage
       ↓                    ↓              ↓             ↓             ↓          ↓
    50 articles         25 qualified    20 unique     1 selected    3 enhanced  3 saved
```

## Implementation Details

### Core Components

#### 1. Article Selector (`/lib/perplexity-article-selector.ts`)
- **Purpose**: Intelligent article selection using Perplexity AI with selection tracking and anti-hallucination safeguards
- **Key Functions**:
  - `selectArticlesWithPerplexity(count)`: Main selection function with tracking
  - `getCandidateArticles()`: Retrieves and filters candidate articles (excludes previously selected)
  - `callPerplexityForSelection()`: AI evaluation and ranking using sequential IDs
  - `markArticlesAsSelected()`: Marks selected articles to prevent re-selection
  - `createArticleSelectionPrompt()`: Generates enhanced preview content (up to 400 chars)
- **Selection Tracking**: Prevents AI from repeatedly choosing the same articles by marking them as selected
- **Anti-Hallucination Features**:
  - Minimum content length filtering (≥100 chars) to ensure sufficient context
  - Enhanced article previews with better content extraction
  - Strict prompt engineering to prevent external knowledge usage
  - Validation warnings for reasoning mismatches

#### 2. Trilingual Enhancer (`/lib/perplexity-trilingual-enhancer.ts`)
- **Purpose**: Sequential enhancement of articles into three languages
- **Key Functions**:
  - `batchEnhanceTrilingualArticles()`: Main batch processing function
  - `enhanceArticleInAllLanguages()`: Individual article trilingual enhancement
- **Features**:
  - Rate limiting between languages and articles
  - Unique URL generation per language
  - Comprehensive metadata tracking

#### 3. Article Saver (`/lib/article-saver.ts`)
- **Purpose**: Database storage with trilingual support
- **Key Functions**:
  - `saveEnhancedArticles()`: Batch saving with error handling
  - Language column fallback mechanism
  - Duplicate prevention by URL

#### 4. API Endpoint (`/app/api/admin/auto-select-headlines/route.ts`)
- **Purpose**: HTTP interface for trilingual enhancement
- **Endpoints**:
  - `POST`: Trigger trilingual enhancement process
  - `GET`: Check configuration and candidate statistics

### Database Schema

#### Enhanced Articles Storage
Articles are stored in the main `articles` table with trilingual metadata:

```sql
-- Core article fields
id, title, content, summary, url, source, category, is_ai_enhanced, published_at

-- Selection tracking fields (prevents re-selection)
selected_for_enhancement -- BOOLEAN: true if article has been selected (AI or manual)
selection_metadata      -- JSONB: selection details (reason, score, timestamp, session, type)

-- Trilingual tracking (stored in enhancement_metadata JSON)
trilingual_batch_id      -- Links related language versions
source_article_id        -- ID of original source article
language_variant         -- 'en', 'zh-TW', 'zh-CN'
language_order          -- 1, 2, 3 (processing sequence)
quality_score           -- Selection quality score (0-100)
language                -- Article language
enhancedAt              -- Enhancement timestamp

-- Enhanced content fields (stored in enhancement_metadata JSON)
key_points              -- Array of key insights
why_it_matters          -- Significance analysis
structured_sources      -- Source citations
structuredContent       -- Enhanced title, summary, etc.
```

#### URL Structure
Each language version has a unique URL to prevent database conflicts:
- English: `{original_url}#enhanced-en-{timestamp}`
- Traditional Chinese: `{original_url}#enhanced-zh-TW-{timestamp}`
- Simplified Chinese: `{original_url}#enhanced-zh-CN-{timestamp}`

## API Reference

### Trigger Trilingual Enhancement
```http
POST /api/admin/auto-select-headlines
Content-Type: application/json

{} // No body required
```

**Response:**
```json
{
  "success": true,
  "batchId": "batch_1752484233132_jqk3ul",
  "sourceArticles": 10,
  "totalEnhanced": 30,
  "totalSaved": 30,
  "articlesByLanguage": {
    "english": 10,
    "traditionalChinese": 10,
    "simplifiedChinese": 10
  },
  "processingTime": 117000,
  "processingTimeMinutes": 2,
  "estimatedCost": "0.7500",
  "articles": [
    {
      "id": "uuid",
      "title": "Enhanced Article Title",
      "language": "en",
      "url": "https://source.com/article#enhanced-en-1752484233132",
      "source": "HKFP",
      "qualityScore": 85
    }
  ]
}
```

### Check Configuration
```http
GET /api/admin/auto-select-headlines
```

**Response:**
```json
{
  "configured": true,
  "message": "Trilingual auto-enhancement is ready",
  "candidateStats": {
    "totalCandidates": 50,
    "qualityArticles": 23,
    "sourcesRepresented": ["HKFP", "SingTao", "HK01"],
    "averageQuality": 72
  }
}
```

## User Interface

### Admin Panel Integration
The trilingual enhancement feature is integrated into the admin articles page with multiple enhancement options:

#### AI Auto-Selection Buttons
- **Location**: Admin articles page (`/admin/articles`)
- **AI Select & Enhance (1→3)**: Single article auto-selection and trilingual enhancement
  - **Visual Design**: Emerald to teal gradient styling
  - **Function**: Uses new pipeline - AI selects 1 best article with topic deduplication and creates 3 language versions
  - **Processing Time**: ~3-5 minutes
  - **Cost**: ~$0.075 per operation
  - **Updated**: Now uses `/api/admin/articles/select-article` + `/api/admin/articles/enhance-selected`
- **States**: Loading state with spinner during processing

> **⚠️ Removed**: "AI Batch (10→30)" button has been removed as part of the streamlined pipeline update. Bulk processing is now handled through manual selection + "Enhance to 3 Languages".

#### Manual Enhancement Functionality
- **Location**: Article selection controls in admin articles page
- **Button Text**: "Enhance to 3 Languages" (updated from "Clone to 3 Languages")
- **Visual Design**: Emerald/blue gradient with copy icon
- **Function**: Enhance manually selected articles into all 3 languages using new pipeline
- **Selection Method**: Manual checkbox selection of specific articles
- **Limits**: Maximum 10 articles per batch operation (reduced from 20)
- **Updated Process**: Uses mark-for-enhancement + enhancement pipeline instead of bulk-clone API
- **Features**:
  - Appears when articles are selected via checkboxes
  - Comprehensive confirmation dialog with breakdown
  - Detailed success reporting with language breakdown
  - Cost calculation and processing time estimates

#### Batch Operations Interface
- **Selection Controls**: Checkbox-based multi-selection of articles
- **Select All/Clear**: Quick selection management
- **Selection Indicator**: Visual feedback showing selected article count
- **Batch Actions**: Delete and Clone buttons appear when articles are selected

#### Enhanced Article Management
- **Deleted Article Indicators**: Visual indicators for soft-deleted articles
- **Selected Article Indicators**: Visual indicators for articles marked for enhancement
- **Modern UI Design**: Clean, minimal design with improved visual hierarchy
- **Efficient Workflow**: Streamlined operations without navigation between pages

#### Progress Modal (`/components/admin/trilingual-auto-select-modal.tsx`)
- **Real-time Progress**: Shows current article and language being processed
- **Language Counters**: Individual progress tracking for each language
- **Time Estimation**: Remaining processing time
- **Cost Tracking**: Real-time cost estimation
- **Success Summary**: Final results with article counts per language

### Progress Tracking
```typescript
interface TrilingualProgress {
  step: 'headlines' | 'filtering' | 'enhancing' | 'saving' | 'complete'
  currentArticle: number
  totalArticles: number
  currentLanguage: 'en' | 'zh-TW' | 'zh-CN'
  completedByLanguage: {
    english: number
    traditionalChinese: number
    simplifiedChinese: number
  }
  estimatedTimeRemaining: number
  totalCost: number
}
```

## Performance Characteristics

### Processing Times
- **Article Selection**: ~8-12 seconds (with deduplication and filtering)
- **Single Article Enhancement**: ~15-20 seconds per language
- **Complete Trilingual Enhancement**: ~3-5 minutes for 1 article (3 languages)
- **Database Storage**: ~1-2 seconds for 3 enhanced articles
- **Selection Marking**: ~1-2 seconds to mark articles as selected

### API Rate Limits
- **Between Languages**: 1.5 seconds delay
- **Between Selection Calls**: 2 seconds delay
- **Total API Calls**: ~5 calls per selection cycle (1 selection + 1 deduplication + 3 enhancements)

### Cost Estimation (Updated)
- **Per Article Enhancement**: ~$0.075
- **Complete Trilingual Enhancement**: ~$0.225 (1 article × 3 languages × $0.075)
- **Daily Cost**: ~$5.40 (24 hourly selections)
- **Actual Cost**: Varies based on content length and API usage

### Content Quality Impact
- **Filtering Effectiveness**: 50 candidates → ~20 after deduplication → ~15 after content filtering
- **Content Length Distribution**: 92% of candidates now have ≥100 characters
- **Selection Quality**: Improved reasoning accuracy with anti-hallucination measures

## Error Handling

### Robust Error Recovery
1. **Article-Level Errors**: Continue processing remaining articles
2. **Language-Level Errors**: Skip failed language, continue with others
3. **Batch Errors**: Partial batch completion with detailed error reporting
4. **Database Errors**: Comprehensive logging with fallback mechanisms

### Error Types
- **API Errors**: Perplexity API failures or rate limits
- **Database Errors**: Connection issues or constraint violations
- **Content Errors**: Invalid article content or missing fields
- **Configuration Errors**: Missing API keys or environment variables

### Error Response Format
```json
{
  "success": false,
  "error": "Error message",
  "errors": [
    "Failed to save article 'Title' (zh-TW): Constraint violation",
    "API timeout for article 'Title' (zh-CN)"
  ],
  "partialResults": {
    "savedCount": 25,
    "failedCount": 5
  }
}
```

## Language-Specific Features

### English Enhancement
- **Target Audience**: International readers and Hong Kong English speakers
- **Content Style**: Professional journalism with international context
- **Key Features**: 
  - Clear, engaging headlines
  - Executive summaries
  - Bullet-pointed key insights
  - International significance analysis

### Traditional Chinese Enhancement (繁體中文)
- **Target Audience**: Hong Kong, Taiwan, and overseas Chinese communities
- **Content Style**: Traditional Chinese journalism style
- **Key Features**:
  - Culturally relevant headlines
  - Local context and implications
  - Traditional Chinese terminology
  - Regional significance emphasis

### Simplified Chinese Enhancement (简体中文)
- **Target Audience**: Mainland China and international Chinese readers
- **Content Style**: Simplified Chinese with mainland perspective
- **Key Features**:
  - Mainland Chinese terminology
  - Cross-border implications
  - Simplified character set
  - Regional relevance analysis

## Quality Assurance

### Content Quality Metrics
- **Source Verification**: All enhancements include source citations
- **Factual Accuracy**: AI enhancement preserves original facts
- **Language Quality**: Native-level language processing for each variant
- **Cultural Sensitivity**: Appropriate tone and context for each audience

### Quality Control Process
1. **Pre-Selection Filtering**: Content length (≥100 chars), metadata completeness, test content removal
2. **AI Quality Scoring**: Perplexity evaluation of enhancement potential based solely on provided content
3. **Selection Validation**: Real-time monitoring for reasoning-content mismatches
4. **Post-Enhancement Validation**: Structure and content verification
5. **Batch Quality Review**: Overall batch statistics and success rates

### Anti-Hallucination Safeguards

#### Problem Identification
The system previously experienced AI hallucination issues where Perplexity would:
- Reference external news knowledge not present in the provided articles
- Provide selection reasons that didn't match the selected article content
- Generate reasons based on training data rather than the actual article previews

#### Solutions Implemented
1. **Enhanced Content Filtering**:
   - Minimum content length requirement (100+ characters)
   - Empty/minimal content articles are filtered out before selection
   - Better preview generation with up to 400 characters of context

2. **Prompt Engineering**:
   ```
   CRITICAL INSTRUCTION TO PREVENT HALLUCINATION:
   - Base your selection reasoning SOLELY on the article information provided below
   - Do NOT use external knowledge about Hong Kong news or current events
   - Do NOT reference news stories that are not in the list below
   - If an article has minimal preview content, state that clearly in your reasoning
   ```

3. **Validation Systems**:
   - Real-time detection of common hallucination indicators (financial keywords, weather terms)
   - Logging of full Perplexity responses for debugging
   - Warning systems for potential reasoning mismatches
   - Content-based validation before article enhancement

#### Validation Indicators
The system monitors for these hallucination patterns:
- **Financial Keywords**: References to "Hang Seng Index", "stock market", "bank loans" when article isn't financial
- **Weather Keywords**: References to "typhoon", "weather alerts" when article isn't weather-related
- **Generic Reasoning**: Templated phrases like "addresses gap in business coverage"
- **External References**: Mentions of news stories not in the candidate list

## Monitoring and Analytics

### Processing Metrics
- **Success Rates**: Article-level and batch-level success tracking
- **Processing Times**: Per-language and per-article timing
- **Cost Tracking**: Real-time API usage and cost calculation
- **Error Rates**: Categorized error tracking and analysis

### Batch Analytics
```typescript
interface BatchStatistics {
  batchId: string
  totalSaved: number
  languageBreakdown: {
    english: number
    traditionalChinese: number
    simplifiedChinese: number
  }
  processingTime: number
  totalCost: number
  errorCount: number
  successRate: number
}
```

## Best Practices

### Development
1. **Environment Setup**: Ensure PERPLEXITY_API_KEY is configured
2. **Database Migrations**: Apply trilingual tracking schema updates
3. **Error Handling**: Always implement try-catch blocks with detailed logging
4. **Rate Limiting**: Respect API rate limits to avoid service interruptions

### Production Deployment
1. **API Key Security**: Use environment variables for API keys
2. **Monitoring**: Set up alerts for processing failures
3. **Cost Controls**: Monitor API usage and implement usage limits
4. **Database Performance**: Ensure indexes are in place for trilingual queries

### Usage Guidelines
1. **Batch Size**: Stick to 10 articles per batch for optimal performance
2. **Timing**: Run during low-traffic periods to minimize user impact
3. **Frequency**: Avoid running multiple batches simultaneously
4. **Quality Review**: Periodically review enhanced content quality

## Troubleshooting

### Common Issues

#### Processing Failures
**Symptom**: Trilingual enhancement fails to complete
**Solutions**:
1. Check PERPLEXITY_API_KEY configuration
2. Verify database connectivity
3. Review API rate limits and quotas
4. Check for sufficient candidate articles

#### Database Constraint Errors
**Symptom**: "URL already exists" errors during saving
**Solution**: URLs are automatically made unique with timestamps; if this fails, check for duplicate URL generation logic

#### Partial Batch Completion
**Symptom**: Some articles save successfully, others fail
**Expected Behavior**: System continues processing and reports partial success
**Action**: Review error logs for specific failure reasons

#### No Articles Available for Selection
**Symptom**: "No articles available for selection" error
**Cause**: All recent articles have been selected or enhanced, or filtered out due to insufficient content
**Solutions**:
1. Wait for new articles to be scraped
2. Reset selection tracking: `UPDATE articles SET selected_for_enhancement = false WHERE selected_for_enhancement = true;`
3. Increase date range in candidate selection (modify `getDateDaysAgo(7)` to larger value)
4. Check if too many articles are being filtered for low content (review filtering logs)

#### AI Selection Hallucination
**Symptom**: Perplexity provides selection reasons that don't match the selected article content
**Cause**: AI drawing from training data rather than provided article context
**Detection**: Look for validation warnings in logs:
```
⚠️ REASONING VALIDATION WARNING: Selection 3 reasoning mentions financial/stock market topics
⚠️ POSSIBLE HALLUCINATION: Selection reasoning appears to be generic/templated
```
**Solutions**:
1. Check if articles have sufficient content (≥100 characters)
2. Review article previews sent to Perplexity for clarity
3. Verify no external knowledge is being referenced in reasoning
4. Consider manually enhancing articles with better content

#### Empty or Insufficient Article Content
**Symptom**: Articles selected but have minimal or no content
**Cause**: Scraping issues or incomplete article ingestion
**Detection**: Content length warnings in selection logs
**Solutions**:
1. Investigate scraping pipeline for the affected source
2. Check database for articles with content_length < 100
3. Review content extraction logic for specific news sources
4. Consider increasing minimum content threshold

### Debug Commands
```bash
# Check configuration
curl -X GET /api/admin/auto-select-headlines

# Test single article enhancement
node test-single-trilingual.js

# Check database schema
node check-database-fields.js

# Monitor API usage
grep "PERPLEXITY" /var/log/application.log

# Debug article selection issues
node debug-article-selection.js

# Check for hallucination patterns
grep "REASONING VALIDATION WARNING" /var/log/application.log

# Find articles with insufficient content
psql -c "SELECT COUNT(*), AVG(content_length) FROM articles WHERE content_length < 100;"

# Check recent selection sessions
psql -c "SELECT title, selection_metadata->>'selection_reason', selection_metadata->>'priority_score' FROM articles WHERE selected_for_enhancement = true ORDER BY created_at DESC LIMIT 10;"
```

## Future Enhancements

### Planned Features
1. **Scheduled Processing**: Automatic trilingual enhancement on a schedule
2. **Custom Article Selection**: Allow manual article selection for enhancement
3. **Quality Feedback Loop**: User feedback integration for quality improvement
4. **Performance Optimization**: Parallel processing for faster batch completion

### Scalability Considerations
1. **Database Optimization**: Dedicated trilingual article indexes
2. **API Management**: Multiple API key rotation for higher throughput
3. **Caching**: Content caching for frequently accessed trilingual articles
4. **Queue System**: Background job processing for better user experience

This comprehensive trilingual enhancement system provides a robust foundation for automated multilingual content creation, enabling the HKI News App to serve diverse language communities with high-quality, AI-enhanced news content.