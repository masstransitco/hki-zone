# Trilingual AI Article Enhancement System

## Overview

The Trilingual AI Enhancement feature is an automated content processing system that uses Perplexity AI to intelligently select the most newsworthy articles and enhance them into three languages: English, Traditional Chinese (繁體中文), and Simplified Chinese (简体中文). This system transforms 10 source articles into 30 enhanced articles through AI-powered selection, quality scoring, and multilingual enhancement.

## Features

### 🤖 Intelligent Article Selection
- **AI-Powered Curation**: Perplexity AI analyzes 50 candidate articles and selects the top 10 most newsworthy
- **Quality Scoring**: Advanced scoring algorithm based on:
  - Newsworthiness and timeliness
  - Public interest and impact
  - Content quality and completeness
  - Enhancement potential
- **Source Diversity**: Ensures representation across different Hong Kong news sources

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
   ├── Fetch 50 recent non-enhanced articles
   ├── Apply quality filters (length, metadata, sources)
   └── Score articles for enhancement potential

2. Perplexity AI Selection
   ├── Send candidate articles to Perplexity for evaluation
   ├── AI analyzes newsworthiness, impact, and relevance
   └── Returns ranked list of top 10 articles

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
Source Articles (DB) → Quality Filter → AI Selection → Enhancement → Storage
       ↓                    ↓              ↓             ↓          ↓
    50 articles         23 qualified    10 selected   30 enhanced  30 saved
```

## Implementation Details

### Core Components

#### 1. Article Selector (`/lib/perplexity-article-selector.ts`)
- **Purpose**: Intelligent article selection using Perplexity AI
- **Key Functions**:
  - `selectArticlesWithPerplexity(count)`: Main selection function
  - `getCandidateArticles()`: Retrieves and filters candidate articles
  - `callPerplexityForSelection()`: AI evaluation and ranking

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
The trilingual enhancement feature is integrated into the admin articles page with:

#### Enhancement Button
- **Location**: Admin articles page (`/admin/articles`)
- **Button Text**: "AI Select & Enhance (10 → 30)"
- **Visual Design**: Gradient styling with language indicators (EN | 繁 | 简)
- **States**: Loading state with spinner during processing

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
- **Article Selection**: ~10-15 seconds
- **Single Article Enhancement**: ~15-20 seconds per language
- **Complete Trilingual Batch**: ~15-20 minutes for 10 articles
- **Database Storage**: ~1-2 seconds for 30 articles

### API Rate Limits
- **Between Languages**: 1.5 seconds delay
- **Between Articles**: 2 seconds delay
- **Total API Calls**: ~40 calls per batch (4 per article × 10 articles)

### Cost Estimation
- **Per Article Enhancement**: ~$0.075
- **Complete Trilingual Batch**: ~$2.25 (30 articles × $0.075)
- **Actual Cost**: Varies based on content length and API usage

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
1. **Pre-Selection Filtering**: Content length, metadata completeness
2. **AI Quality Scoring**: Perplexity evaluation of enhancement potential
3. **Post-Enhancement Validation**: Structure and content verification
4. **Batch Quality Review**: Overall batch statistics and success rates

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