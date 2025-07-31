# Contextual News Enrichment System

## Overview
The Contextual Enrichment System transforms high-frequency Hong Kong news headlines into data-driven, context-rich articles by searching for historical data and creating meaningful comparisons. This approach is specifically designed for live news signals that require immediate context and relevance.

## Key Features

### 1. Historical Context Search
- **Automated Research**: Searches for relevant historical data, statistics, and past events
- **5-Year Lookback**: Focuses on data from the past 5 years for relevance
- **Category-Specific**: Tailored searches based on news category (business, tech, health, etc.)
- **Source Citations**: All historical data comes with verifiable sources

### 2. Three-Bullet Contextual Structure

Each article is enriched with exactly 3 contextual bullets:

#### Bullet 1: Historical Perspective
- **Historical**: Past data/figures with specific dates
- **Current**: Key fact about the current situation
- **Insight**: Why this comparison matters

#### Bullet 2: Data Comparison
- **Historical**: Relevant historical trend or pattern
- **Current**: Related current development
- **Insight**: Significance for Hong Kong's future

#### Bullet 3: Broader Impact
- **Historical**: Past similar events and outcomes
- **Current**: Current broader implications
- **Insight**: Inspiring conclusion about potential

### 3. Data Points & Metrics
- Concrete numbers with comparisons
- Trend indicators (up/down/stable)
- Year-over-year or period comparisons
- Percentage changes and growth rates

## Implementation Details

### API Flow

```
1. Headline Received
   ↓
2. Historical Context Search
   - Query: "Hong Kong [category] historical data statistics trends [keywords]"
   - Temperature: 0.3 (factual focus)
   - Returns: Historical data + citations
   ↓
3. Contextual Enrichment Generation
   - Combines current headline with historical data
   - Temperature: 0.4 (balanced creativity)
   - Structured output format enforced
   ↓
4. Content Parsing & Validation
   - Extracts bullets, data points, citations
   - Ensures 3 complete bullets
   - Validates data format
   ↓
5. Format Conversion
   - Converts to standard ArticleEnrichment
   - Maintains backward compatibility
   - Stores both formats
```

### Data Structure

```typescript
interface ContextualBulletPoint {
  historical_context: string  // "2019年同期增長2.3%，2020年下跌15%"
  key_fact: string           // "Current quarter shows 5% growth"
  significance: string       // "Strongest recovery since pre-pandemic"
}

interface ContextualEnrichment {
  enhanced_title: string
  contextual_bullets: ContextualBulletPoint[]
  historical_references: string[]
  data_points: {
    metric: string      // "GDP Growth"
    value: string       // "3.5%"
    comparison?: string // "vs 2.1% last year"
  }[]
  image_prompt: string
  citations: string[]
  sources: SourceCitation[]
}
```

### Database Storage

The contextual data is stored in a JSONB column:

```sql
ALTER TABLE perplexity_news 
ADD COLUMN contextual_data JSONB;
```

Example stored data:
```json
{
  "contextual_bullets": [
    {
      "historical_context": "2019 saw 2.3% growth, 2020 declined 15%",
      "key_fact": "Q3 2025 posts 5.2% growth",
      "significance": "Marks full recovery to pre-pandemic levels"
    }
  ],
  "data_points": [
    {
      "metric": "Quarterly Growth",
      "value": "5.2%",
      "comparison": "vs 2.1% Q3 2024"
    }
  ],
  "historical_references": ["url1", "url2"],
  "enrichment_version": "contextual_v1"
}
```

## Content Examples

### Business Category Example

**Headline**: "Hong Kong property prices rise 3.2% in October"

**Contextual Bullets**:

1. **Historical Perspective**
   - Historical: "2019年同期僅升1.5%，2020年因疫情跌8.3%"
   - Current: "10月份升3.2%，為今年最大單月升幅"
   - Insight: "市場復甦跡象明顯，預示房地產重拾動力"

2. **Data Comparison**
   - Historical: "過去五年平均月升幅0.8%，最高為2018年4.1%"
   - Current: "本月3.2%升幅超越五年平均四倍"
   - Insight: "強勁增長反映市場信心恢復，帶來新機遇"

3. **Broader Impact**
   - Historical: "2017年類似升幅後，帶動經濟增長2.3%"
   - Current: "預計刺激建築、裝修及金融服務業"
   - Insight: "經濟復甦勢頭增強，為未來發展奠定基礎"

### Tech Category Example

**Headline**: "Hong Kong launches HK$5 billion AI innovation fund"

**Contextual Bullets**:

1. **Historical Perspective**
   - Historical: "2018年創科基金僅10億，2021年增至30億"
   - Current: "新AI基金達50億，為歷來最大規模"
   - Insight: "顯示政府對AI發展前所未有的承諾"

2. **Data Comparison**
   - Historical: "過去5年創科投資年均增長45%"
   - Current: "本次撥款較去年增加67%"
   - Insight: "香港加速轉型為亞洲AI創新中心"

3. **Broader Impact**
   - Historical: "新加坡2019年類似計劃創造8,000職位"
   - Current: "預計本地創造12,000個AI相關職位"
   - Insight: "鞏固香港在大灣區科技領導地位"

## Benefits

### For Readers
- **Instant Context**: Understand significance without research
- **Data-Driven**: Concrete numbers replace vague statements
- **Forward-Looking**: Inspiring insights about implications
- **Mobile-Friendly**: Concise bullets perfect for scanning

### For Publishers
- **Automated Research**: No manual historical lookup
- **Consistent Quality**: Structured format ensures completeness
- **SEO Optimized**: Rich data improves search rankings
- **Engagement**: Context increases time-on-page

### For Analysis
- **Trend Tracking**: Historical comparisons reveal patterns
- **Market Intelligence**: Data points provide insights
- **Citation Network**: Build knowledge graph over time
- **Performance Metrics**: Track prediction accuracy

## Configuration

### Environment Variables
```env
PERPLEXITY_API_KEY=your_api_key
```

### Prompts Tuning
- **Historical Search**: Temperature 0.3 (factual)
- **Content Generation**: Temperature 0.4 (balanced)
- **Model**: sonar-pro (best for research)

### Rate Limiting
- 1 second delay between enrichments
- Maximum 10 articles per batch
- Automatic retry with exponential backoff

## Testing

### Run Test Script
```bash
node test-contextual-enrichment.js
```

### Sample Test Output
```
📰 Testing: "Hong Kong property prices rise 3.2% in October"
   Category: business
   ---
   1️⃣ Searching for historical context...
   ✅ Found 1 historical references
   ✅ Found 3 citations

   2️⃣ Creating contextual enrichment...
   ✅ Enhanced title: "港樓價10月升3.2%"
   ✅ Generated 3 contextual bullets
   ✅ Found 3 data points

   📊 Contextual Bullets:
   [Detailed bullet points with historical/current/insight]

   📈 Data Points:
   • Average Price: HK$180,000/sq ft (vs HK$165,000 last year)
   • Transaction Volume: 5,823 units (up 15%)
   • Mortgage Rate: 3.5% (trend: stable)
```

## Migration Guide

### 1. Apply Database Migration
```bash
psql $DATABASE_URL -f scripts/add-contextual-enrichment-fields.sql
```

### 2. Update Environment
Ensure PERPLEXITY_API_KEY is set

### 3. Deploy Code Updates
The enrichment process will automatically use contextual enrichment

### 4. Monitor Results
Check enriched articles for contextual bullets

## Future Enhancements

### Short Term
1. **Multi-language Bullets**: Support English/Chinese mixed content
2. **Visual Charts**: Generate data visualization prompts
3. **Sector Comparisons**: Cross-category insights
4. **Sentiment Tracking**: Historical sentiment analysis

### Long Term
1. **Predictive Insights**: ML-based trend forecasting
2. **Real-time Updates**: Live data integration
3. **Custom Metrics**: Industry-specific KPIs
4. **Interactive Timelines**: Historical event visualization

## Best Practices

### Content Quality
- Always verify historical data has sources
- Ensure dates are specific (not "recently")
- Use exact percentages and figures
- Keep insights forward-looking and positive

### Performance
- Cache historical searches by category
- Batch similar articles together
- Monitor API costs per enrichment
- Set up alerts for failed enrichments

### User Experience
- Test mobile rendering of bullets
- Ensure bullets are scannable
- Highlight key numbers visually
- Link to source articles when possible