# Government Signals Feed Implementation

## Overview

The Government Signals Feed is a comprehensive system that monitors and processes real-time government incident feeds, replacing the previous Perplexity news management system. This system provides automated incident monitoring with manual enrichment capabilities, delivering authoritative government information to users.

## 🎯 **Key Features**

### 1. **Real-Time Government Monitoring**
- **7 Official Government Feeds** from Transport Department, MTR, Hong Kong Observatory, and EMSD
- **Automated processing** every 2 minutes via cron jobs
- **Content-based relevance scoring** for incident prioritization
- **Geographic context** with PostGIS location data

### 2. **Manual Enrichment Control**
- **Admin-driven enrichment** instead of automatic processing
- **Selective enhancement** using Perplexity API for research
- **Cost control** through manual selection
- **Quality assurance** through human review

### 3. **Enhanced Research Capabilities**
- **Additional source discovery** during enrichment
- **Key facts extraction** (2-3 verified facts per incident)
- **Reporting score** (1-10) for newsworthiness assessment
- **Comprehensive fact-checking** with source verification

## 📊 **System Architecture**

### Database Schema

The system is built around two main tables:

#### `gov_feeds` Table
```sql
CREATE TABLE gov_feeds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE NOT NULL,        -- Feed identifier
    url TEXT NOT NULL,                -- RSS/XML feed URL
    active BOOLEAN DEFAULT true,      -- Enable/disable feed
    last_seen_pubdate TIMESTAMPTZ,    -- Last processing timestamp
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `incidents` Table
```sql
CREATE TABLE incidents (
    id TEXT PRIMARY KEY,              -- Format: source_YYYYMMDD_HHMMSS_hash
    source_slug TEXT NOT NULL,       -- References gov_feeds.slug
    title TEXT NOT NULL,
    body TEXT,
    category incident_category NOT NULL,  -- 'road', 'rail', 'weather', 'utility', 'top_signals', 'environment'
    severity INTEGER DEFAULT 0,      -- 0-10 severity scale
    relevance_score INTEGER DEFAULT 0, -- Content-based relevance (0-100)
    location GEOMETRY(Point, 4326),  -- PostGIS location data
    starts_at TIMESTAMPTZ,
    source_updated_at TIMESTAMPTZ NOT NULL,
    
    -- Enrichment fields
    enrichment_status enrichment_status DEFAULT 'pending',
    enriched_title TEXT,
    enriched_summary TEXT,
    enriched_content TEXT,
    key_points JSONB,
    why_it_matters TEXT,
    
    -- New enhanced enrichment fields
    key_facts JSONB,                  -- 2-3 key verified facts
    reporting_score INTEGER,          -- Newsworthiness score (1-10)
    additional_sources JSONB,         -- Additional sources from research
    
    -- Metadata
    sources JSONB,
    enrichment_metadata JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Feed Processing Pipeline

```
Government RSS/XML Feeds → Feed Processor → Duplicate Prevention → Database Storage → Materialized View → API Serving
                           ↓                      ↓
                    Incident Parsing & Scoring   Content-based ID Generation
                           ↓                      ↓
                    Manual Enrichment Selection  Incremental Processing
                           ↓
                    Perplexity Research & Analysis
                           ↓
                    Enhanced Incident Storage
```

## 🔧 **Technical Implementation**

### 1. Government Feeds Processing (`/lib/government-feeds.ts`)

**Core Functionality:**
- RSS/XML parsing for different government feed formats
- **Content-based duplicate prevention** using SHA256 hashing
- **Incremental processing** to avoid reprocessing existing items
- Content-based relevance scoring algorithm
- Automatic severity calculation based on keywords
- PostGIS integration for geographic data
- Error handling and retry logic

**Supported Feed Types:**
- **Standard RSS feeds** (most government sources)
- **Transport Department custom XML** (special traffic data)
- **Weather alerts** (Hong Kong Observatory)
- **MTR service alerts** (rail disruptions)

**Key Methods:**
```typescript
class GovernmentFeeds {
  async processAllFeeds(): Promise<ProcessingResult>
  private async processFeed(feed: GovFeed): Promise<FeedResult>
  private parseRssFeed(xml: string, feed: GovFeed): Promise<ParsedIncident[]>
  private parseTransportDeptXml(xml: string, feed: GovFeed): ParsedIncident[]
  private generateIncidentId(slug: string, title: string, content?: string): string
  private filterNewItems(items: ParsedIncident[], feed: GovFeed): Promise<ParsedIncident[]>
  private calculateRelevanceScore(title: string, description: string, slug: string): number
  private calculateSeverity(title: string, description?: string): number
}
```

### 2. Duplicate Prevention System

**Problem Solved:**
The original system created duplicates because it used time-based IDs that changed when feeds were republished, and processed all feed items every 2 minutes without filtering.

**Content-Based ID Generation:**
```typescript
private generateIncidentId(slug: string, title: string, content?: string): string {
  // Create hash from normalized content to prevent duplicates
  const normalizedTitle = title.trim().toLowerCase().replace(/\s+/g, ' ')
  const normalizedContent = content ? content.trim().toLowerCase().replace(/\s+/g, ' ') : ''
  const contentHash = crypto.createHash('sha256')
    .update(`${slug}:${normalizedTitle}:${normalizedContent}`)
    .digest('hex')
    .slice(0, 12)
  
  return `${slug}_${contentHash}`
}
```

**Incremental Processing:**
```typescript
private async filterNewItems(items: ParsedIncident[], feed: GovFeed): Promise<ParsedIncident[]> {
  if (!feed.last_seen_pubdate) {
    return items // First run, process all items
  }
  
  const lastSeen = new Date(feed.last_seen_pubdate)
  return items.filter(item => {
    const itemDate = new Date(item.source_updated_at)
    return itemDate > lastSeen
  })
}
```

**Benefits:**
- **Eliminates duplicates**: Same content = same ID, regardless of republishing
- **Reduces processing**: Only processes new items since last run
- **Improves reliability**: Fixed broken feed URLs and disabled non-working feeds
- **Maintains performance**: Efficient incremental processing reduces database load

### 3. Cron Job Implementation (`/app/api/cron/fetch-gov-feeds/route.ts`)

**Schedule:** Every 2 minutes (`*/2 * * * *`)

**Features:**
- Automated feed processing with rate limiting
- Comprehensive logging and error tracking
- Manual testing endpoint (POST method)
- Respectful API access with delays between feeds
- **Incremental processing** to avoid reprocessing existing incidents

**Usage:**
```bash
# Automatic processing (cron)
# Runs every 2 minutes automatically

# Manual testing
curl -X POST http://localhost:3000/api/cron/fetch-gov-feeds
```

### 3. Enhanced Enrichment API (`/app/api/admin/signals/enrich-incident/route.ts`)

**New Research-Focused Enrichment:**
```typescript
// Enhanced prompt for research and analysis
const prompt = `
You are an expert Hong Kong news analyst. Research this government incident and provide structured enrichment with additional sources:

INCIDENT DETAILS:
- Title: ${incident.title}
- Category: ${incident.category}
- Source: ${incident.source_slug}
- Content: ${incident.body}
- Severity: ${incident.severity}/10
- Location: ${incident.latitude}, ${incident.longitude}
- Time: ${incident.source_updated_at}

Please research this incident and provide a structured analysis in the following format:

ENHANCED_TITLE: [Clear, concise headline]
SUMMARY: [2-3 sentence summary]
KEY_FACTS:
• [First key verified fact]
• [Second key verified fact]
• [Third key verified fact]
WHY_IT_MATTERS: [Impact explanation]
REPORTING_SCORE: [1-10 newsworthiness score]
ADDITIONAL_SOURCES: [Title | URL | Brief description]
IMAGE_PROMPT: [Image description]
`;
```

**Enhanced Data Structure:**
```typescript
interface EnrichmentResult {
  enriched_title: string;
  enriched_summary: string;
  enriched_content: string;
  key_facts: string[];              // New: 2-3 key verified facts
  reporting_score: number;          // New: 1-10 newsworthiness score
  additional_sources: Source[];     // New: Additional research sources
  why_it_matters: string;
  image_prompt: string;
  sources: SourceMetadata;
  enrichment_metadata: EnrichmentMetadata;
}
```

## 🎨 **User Interface**

### 1. Public Signals Feed (`/app/signals/page.tsx`)

**Features:**
- **Category filtering** (Top Signals, Road, Weather, Environment, A&E)
- **Default Top Signals view** highlighting priority government communications
- **Real-time updates** (auto-refresh every 2 minutes)
- **Both direct and enriched content** display
- **Infinite scroll** for large datasets
- **Responsive design** with mobile optimization
- **Streamlined navigation** with optimized category selection

**Content Display Logic:**
```typescript
// Smart content rendering based on enrichment status
const title = isEnriched ? (article.enhanced_title || article.title) : article.title;
const content = isEnriched && article.summary ? article.summary : article.lede;

// Enhanced content indicators
{(article.enrichment_status === 'enriched' || article.enrichment_status === 'ready') && (
  <div className="flex items-center gap-2 mt-2">
    {article.key_points && article.key_points.length > 0 && (
      <span className="text-xs text-blue-600">• {article.key_points.length} key points</span>
    )}
    {article.why_it_matters && (
      <span className="text-xs text-green-600">• Impact analysis</span>
    )}
  </div>
)}
```

### 2. Admin Signals Management (`/app/admin/signals/page.tsx`)

**Enhanced Admin Interface:**
- **Manual feed processing** controls for individual or all feeds
- **Batch incident selection** with multi-select checkboxes
- **Two-step enrichment process**:
  1. **Mark for Enrichment** - Prepares incidents for processing
  2. **AI Enrich Now** - Triggers Perplexity API research
- **Enhanced content display** with key facts and additional sources
- **Reporting score visualization** (1-10 scale)

**Feed Processing Controls:**
```typescript
// Manual feed processing
const handleProcessAllFeeds = async () => {
  const response = await fetch('/api/cron/fetch-gov-feeds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  // Handle response and refresh UI
};

// Individual feed processing
const handleProcessSingleFeed = async (feedSlug: string) => {
  // Process specific government feed
};
```

**Enhanced Enrichment UI:**
```typescript
// Display enriched content with new fields
{incident.enrichment_status === 'enriched' && (
  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
    {/* Key Facts Display */}
    {incident.key_facts && incident.key_facts.length > 0 && (
      <div className="mb-2">
        <div className="text-xs font-medium text-blue-800 mb-1">Key Facts:</div>
        <ul className="text-xs text-blue-700 space-y-1">
          {incident.key_facts.map((fact, index) => (
            <li key={index} className="flex items-start gap-1">
              <span className="text-blue-600">•</span>
              <span>{fact}</span>
            </li>
          ))}
        </ul>
      </div>
    )}
    
    {/* Additional Sources Display */}
    {incident.additional_sources && incident.additional_sources.length > 0 && (
      <div className="mb-2">
        <div className="text-xs font-medium text-blue-800 mb-1">
          Additional Sources ({incident.additional_sources.length}):
        </div>
        <div className="space-y-1">
          {incident.additional_sources.slice(0, 2).map((source, index) => (
            <div key={index} className="flex items-center gap-1 text-xs">
              <ExternalLink className="h-3 w-3 text-blue-600" />
              <a href={source.url} target="_blank" rel="noopener noreferrer"
                 className="text-blue-600 hover:underline truncate">
                {source.title}
              </a>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
)}
```

## 🔗 **API Endpoints**

### 1. Public Signals API (`/app/api/signals/route.ts`)

**Endpoint:** `GET /api/signals`

**Query Parameters:**
- `category`: Filter by incident category (road, rail, weather, utility)
- `page`: Pagination (default: 0)
- `limit`: Results per page (default: 20)
- `search`: Text search in title and body
- `severity`: Minimum severity level

**Response Format:**
```json
{
  "articles": [
    {
      "id": "td_20250715_143052_abc123",
      "title": "Original Government Title",
      "enhanced_title": "AI-Enhanced Title",
      "category": "road",
      "severity": 5,
      "relevance_score": 75,
      "reporting_score": 8,
      "enrichment_status": "enriched",
      "key_facts": [
        "Key verified fact 1",
        "Key verified fact 2"
      ],
      "additional_sources": [
        {
          "title": "Source Title",
          "url": "https://example.com",
          "description": "Source description"
        }
      ],
      "longitude": 114.1694,
      "latitude": 22.3193,
      "source_updated_at": "2025-07-15T14:30:52Z"
    }
  ],
  "total": 245,
  "hasMore": true,
  "page": 0,
  "limit": 20
}
```

### 2. Admin Signals API (`/app/api/admin/signals/route.ts`)

**Endpoint:** `GET /api/admin/signals`

**Additional Admin Features:**
- Access to all incident fields including metadata
- Batch operations support
- Enhanced filtering options

**Batch Operations:**
```typescript
// POST /api/admin/signals
{
  "action": "batch_enrich",
  "incidentIds": ["id1", "id2", "id3"]
}

// Supported actions:
// - batch_enrich: Mark incidents for enrichment
// - batch_delete: Delete multiple incidents
// - batch_update_status: Update enrichment status
```

### 3. Enrichment API (`/app/api/admin/signals/enrich-incident/route.ts`)

**Endpoint:** `POST /api/admin/signals/enrich-incident`

**Request Body:**
```json
{
  "incidentIds": ["id1", "id2", "id3"]  // Support for batch processing
}
```

**Response:**
```json
{
  "success": true,
  "processed": 3,
  "errors": 0,
  "results": [
    {
      "id": "incident_id",
      "title": "Original Title",
      "enriched_title": "Enhanced Title",
      "enrichment_cost": "0.002400"
    }
  ],
  "totalCost": "0.007200"
}
```

## 🏗️ **Government Feed Sources**

### Currently Supported Feeds (15+ Sources)

1. **Transport Department Feeds**
   - **Traffic Notices**: `https://www.td.gov.hk/filemanager/rss/en/traffic_notices.xml` ✅
   - **Press Releases**: `https://www.td.gov.hk/filemanager/rss/en/press_release.xml` ✅

2. **Hong Kong Observatory**
   - **Weather Warnings**: `https://rss.weather.gov.hk/rss/WeatherWarningSummaryv2.xml` ✅
   - **Earthquake Messages**: `https://rss.weather.gov.hk/rss/QuickEarthquakeMessage.xml` ✅
   - **Felt Earthquakes**: `https://rss.weather.gov.hk/rss/FeltEarthquake.xml` ✅

3. **Centre for Health Protection (CHP)**
   - **Press Releases**: `https://www.chp.gov.hk/rss/pressreleases_en_RSS.xml` ✅
   - **Disease Watch**: `https://www.chp.gov.hk/rss/cdwatch_en_RSS.xml` ✅
   - **Non-Communicable Disease Watch**: `https://www.chp.gov.hk/rss/ncdaware_en_RSS.xml` ✅
   - **Guidelines**: `https://www.chp.gov.hk/rss/guidelines_en_RSS.xml` ✅

4. **Hong Kong Monetary Authority (HKMA)**
   - **Press Releases**: `https://www.hkma.gov.hk/eng/other-information/rss/rss_press-release.xml` ✅
   - **Speeches**: `https://www.hkma.gov.hk/eng/other-information/rss/rss_speeches.xml` ✅
   - **Guidelines**: `https://www.hkma.gov.hk/eng/other-information/rss/rss_guidelines.xml` ✅
   - **Circulars**: `https://www.hkma.gov.hk/eng/other-information/rss/rss_circulars.xml` ✅

5. **Government News**
   - **Top Stories**: `https://www.news.gov.hk/rss/news/topstories_en.xml` ✅

6. **Hospital Authority**
   - **A&E Waiting Times**: `https://www.ha.org.hk/opendata/aed/aedwtdata-en.json` ✅

### Feed Status Monitoring

**Active Feeds (Working):**
- ✅ TD Traffic Notices (RSS format, ~20 items)
- ✅ TD Press Releases (RSS format, ~20 items)
- ✅ HKO Weather Warnings (RSS format, variable items)
- ✅ HKO Earthquake Messages (RSS format, variable items)
- ✅ HKO Felt Earthquakes (RSS format, variable items)

**Disabled Feeds (Broken URLs):**
- ❌ TD Special Traffic (403 Access Denied) - URL no longer accessible
- ❌ MTR Rail Alerts (Connection failed) - URL appears invalid
- ❌ EMSD Utility (404 Not Found) - No specific electricity incident feed exists

**Feed URL Updates Applied:**
- Fixed HKO earthquake feed URL from `QuickEarthquake.xml` to `QuickEarthquakeMessage.xml`
- Added new HKO felt earthquake feed
- Disabled non-working feeds until correct URLs are found

## 🎯 **Scoring and Prioritization**

### 1. Relevance Score (0-100)

**Content-Based Scoring Algorithm:**
```typescript
private calculateRelevanceScore(title: string, description: string, slug: string): number {
  const text = `${title} ${description}`.toLowerCase();
  let score = 50; // Base score
  
  // High-impact keywords
  if (text.includes('emergency') || text.includes('critical')) score += 30;
  if (text.includes('accident') || text.includes('incident')) score += 20;
  if (text.includes('delayed') || text.includes('disrupted')) score += 15;
  if (text.includes('warning') || text.includes('alert')) score += 10;
  
  // Source priority boosts
  if (slug === 'mtr_rail') score += 10;
  if (slug.startsWith('hko_')) score += 5;
  
  // Penalty for routine content
  if (text.includes('routine') || text.includes('scheduled')) score -= 10;
  if (text.includes('maintenance')) score -= 5;
  
  return Math.max(0, Math.min(100, score));
}
```

### 2. Severity Score (0-10)

**Keyword-Based Severity Assessment:**
```typescript
private calculateSeverity(title: string, description?: string): number {
  const text = `${title} ${description || ''}`.toLowerCase();
  
  // High severity (8)
  if (text.includes('emergency') || text.includes('urgent') || 
      text.includes('critical') || text.includes('closed') || 
      text.includes('suspended') || text.includes('cancelled')) {
    return 8;
  }
  
  // Medium severity (5)
  if (text.includes('delayed') || text.includes('disrupted') || 
      text.includes('warning') || text.includes('accident') || 
      text.includes('incident')) {
    return 5;
  }
  
  // Low severity (2)
  if (text.includes('notice') || text.includes('update') || 
      text.includes('maintenance')) {
    return 2;
  }
  
  return 3; // Default severity
}
```

### 3. Reporting Score (1-10)

**AI-Generated Newsworthiness Assessment:**
- **1-3**: Routine maintenance, minor updates
- **4-6**: Standard traffic incidents, service disruptions
- **7-8**: Significant incidents affecting many people
- **9-10**: Major emergencies, critical infrastructure issues

## 🚀 **Deployment and Configuration**

### Environment Variables

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional (for enrichment)
PERPLEXITY_API_KEY=your-perplexity-api-key
CRON_SECRET=your-cron-secret
```

### Database Setup

1. **Run Primary Migration:**
```bash
# Apply the main government incidents schema
psql $DATABASE_URL -f supabase/migrations/20250715_government_incidents_schema.sql
```

2. **Run Enhancement Migration:**
```bash
# Add new enrichment fields
psql $DATABASE_URL -f supabase/migrations/20250715_add_new_enrichment_fields.sql
```

3. **Verify Schema:**
```bash
# Check that all tables and functions exist
psql $DATABASE_URL -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%incident%';"
```

### Cron Job Configuration

**Vercel Configuration (`vercel.json`):**
```json
{
  "crons": [
    {
      "path": "/api/cron/fetch-gov-feeds",
      "schedule": "*/2 * * * *"
    }
  ]
}
```

## 📊 **Performance Monitoring**

### Key Metrics to Monitor

1. **Feed Processing Success Rate**
   - Target: >95% success rate for active feeds
   - Monitor: Failed feed processing attempts

2. **Incident Processing Speed**
   - Target: <2 seconds per incident
   - Monitor: Processing time and throughput

3. **Enrichment Costs**
   - Target: <$0.01 per incident enrichment
   - Monitor: Perplexity API usage and costs

4. **Database Performance**
   - Target: <100ms query response times
   - Monitor: Slow queries and index usage

### Health Check Endpoints

```bash
# Check feed processing status
curl /api/admin/signals/stats

# Test individual feed
curl -X POST /api/cron/fetch-gov-feeds

# Check enrichment configuration
curl /api/admin/signals/enrich-incident
```

## 🔧 **Maintenance and Operations**

### Regular Tasks

1. **Daily:**
   - Monitor feed processing success rates
   - Check for failed enrichment attempts
   - Review reporting scores and incident quality

2. **Weekly:**
   - Analyze incident trends and patterns
   - Update feed URLs if sources change
   - Review enrichment costs and budget

3. **Monthly:**
   - Optimize database queries and indexes
   - Update relevance scoring algorithms
   - Review and update government feed sources

### Troubleshooting Common Issues

**Feed Processing Failures:**
```bash
# Check specific feed
curl -X POST /api/cron/fetch-gov-feeds

# Check database connectivity
curl /api/debug/database

# Review logs
vercel logs --tail
```

**Duplicate Prevention Issues:**
```bash
# Check if incidents are being processed incrementally
SELECT slug, last_seen_pubdate FROM gov_feeds WHERE active = true;

# Check for potential duplicates (should be minimal)
SELECT title, COUNT(*) as count 
FROM incidents 
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY title 
HAVING COUNT(*) > 1;

# Test content-based ID generation
node test_duplicate_prevention.js
```

**Enrichment Issues:**
```bash
# Check Perplexity API key
curl /api/admin/signals/enrich-incident

# Test with single incident
curl -X POST /api/admin/signals/enrich-incident -d '{"incidentIds": ["incident_id"]}'
```

**Database Migration Issues:**
```sql
-- Run in Supabase SQL Editor to fix feed URLs
-- See fix_feed_urls.sql for complete script
UPDATE gov_feeds SET 
  url = 'https://rss.weather.gov.hk/rss/QuickEarthquakeMessage.xml',
  active = true 
WHERE slug = 'hko_eq';
```

## 🔄 **Migration from Perplexity News**

### Key Changes

1. **Admin Navigation:**
   - **Old:** `/admin/perplexity` → **New:** `/admin/signals`
   - **Old:** "Perplexity News" → **New:** "Government Signals"

2. **Data Source:**
   - **Old:** AI-generated news headlines
   - **New:** Real-time government incident feeds

3. **Content Processing:**
   - **Old:** Automatic AI enhancement
   - **New:** Manual enrichment with research capabilities

4. **Scoring System:**
   - **Old:** AI Score (misleading terminology)
   - **New:** Relevance Score (content-based) + Reporting Score (newsworthiness)

### Backward Compatibility

- All existing API endpoints maintain compatibility
- Database migrations handle data transformation
- UI components gracefully handle missing fields
- Fallback mechanisms for renamed columns

## 🎯 **Future Enhancements**

### Planned Features

1. **Additional Government Sources**
   - Fire Services Department alerts
   - Hospital Authority service updates
   - Airport Authority notifications

2. **Enhanced Analytics**
   - Incident trend analysis
   - Geographic clustering
   - Impact assessment metrics

3. **Automated Categorization**
   - Machine learning-based categorization
   - Improved relevance scoring
   - Duplicate incident detection

4. **Real-Time Notifications**
   - Push notifications for critical incidents
   - Email alerts for specific categories
   - SMS integration for emergencies

## 📝 **Usage Examples**

### Basic Feed Monitoring
```bash
# Check current incidents
curl "http://localhost:3000/api/signals?limit=5"

# Filter by category
curl "http://localhost:3000/api/signals?category=road&limit=10"

# Search for specific incidents
curl "http://localhost:3000/api/signals?search=traffic&limit=5"
```

### Admin Operations
```bash
# Process all feeds manually
curl -X POST "http://localhost:3000/api/cron/fetch-gov-feeds"

# Get admin incident data
curl "http://localhost:3000/api/admin/signals?limit=10"

# Enrich selected incidents
curl -X POST "http://localhost:3000/api/admin/signals/enrich-incident" \
  -H "Content-Type: application/json" \
  -d '{"incidentIds": ["incident_id_1", "incident_id_2"]}'
```

### Frontend Integration
```typescript
// React component example
const SignalsFeed = () => {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/signals?limit=20')
      .then(res => res.json())
      .then(data => {
        setSignals(data.articles);
        setLoading(false);
      });
  }, []);

  return (
    <div>
      {loading ? (
        <div>Loading signals...</div>
      ) : (
        signals.map(signal => (
          <div key={signal.id} className="signal-card">
            <h3>{signal.enhanced_title || signal.title}</h3>
            <p>{signal.summary || signal.lede}</p>
            <div className="metadata">
              <span>Category: {signal.category}</span>
              <span>Severity: {signal.severity}</span>
              <span>Relevance: {signal.relevance_score}</span>
              {signal.reporting_score && (
                <span>Reporting: {signal.reporting_score}/10</span>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
};
```

This comprehensive implementation provides a robust, scalable system for monitoring government incidents and delivering timely, accurate information to Hong Kong residents through both direct government content and AI-enhanced analysis.