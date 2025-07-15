# Simple and Robust Duplicate Prevention Solution

## The Problem
Current system creates duplicate incidents because:
1. Time-based IDs change when feeds are republished 
2. Different `guid` formats across feeds
3. No content-based deduplication

## The Solution: Content-Based Hash ID

### 1. **Replace time-based ID with content-based hash**

```typescript
// OLD - Time-based ID (creates duplicates)
private generateIncidentId(slug: string, identifier: string, pubDate: string): string {
  const date = new Date(pubDate)
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
  const timeStr = date.toTimeString().slice(0, 8).replace(/:/g, '')
  const hash = crypto.createHash('md5').update(identifier).digest('hex').slice(0, 6)
  return `${slug}_${dateStr}_${timeStr}_${hash}`
}

// NEW - Content-based ID (prevents duplicates)
private generateIncidentId(slug: string, title: string, content?: string): string {
  // Create hash from normalized content
  const normalizedTitle = title.trim().toLowerCase().replace(/\s+/g, ' ')
  const normalizedContent = content ? content.trim().toLowerCase().replace(/\s+/g, ' ') : ''
  const contentHash = crypto.createHash('sha256')
    .update(`${slug}:${normalizedTitle}:${normalizedContent}`)
    .digest('hex')
    .slice(0, 12)
  
  return `${slug}_${contentHash}`
}
```

### 2. **Update parsing logic to use content-based IDs**

```typescript
// RSS Feed parsing
private async parseRssFeed(xml: string, feed: GovFeed): Promise<ParsedIncident[]> {
  try {
    const parsedFeed = await parser.parseString(xml)
    
    return parsedFeed.items.map((item: any) => {
      // Use content for ID generation instead of GUID/timestamp
      const incidentId = this.generateIncidentId(
        feed.slug, 
        item.title, 
        item.contentSnippet || item.description
      )
      
      return {
        id: incidentId,
        source_slug: feed.slug,
        title: this.cleanTitle(item.title),
        body: item.contentSnippet || item.description,
        category: this.mapCategory(feed.slug),
        severity: this.calculateSeverity(item.title, item.description),
        source_updated_at: new Date(item.isoDate || item.pubDate).toISOString(),
        relevance_score: this.calculateRelevanceScore(item.title, item.description, feed.slug)
      }
    })
  } catch (error) {
    console.error(`Error parsing RSS feed ${feed.slug}:`, error)
    return []
  }
}
```

### 3. **Add incremental processing using timestamps**

```typescript
// Only process items newer than last seen
private async filterNewItems(items: ParsedIncident[], feed: GovFeed): Promise<ParsedIncident[]> {
  if (!feed.last_seen_pubdate) {
    return items // First run, process all
  }
  
  const lastSeen = new Date(feed.last_seen_pubdate)
  return items.filter(item => {
    const itemDate = new Date(item.source_updated_at)
    return itemDate > lastSeen
  })
}

// Update processFeed method
private async processFeed(feed: GovFeed): Promise<{ feed: string, incidents: number, errors: string[] }> {
  const errors: string[] = []
  
  try {
    console.log(`Processing feed: ${feed.slug} (${feed.url})`)
    
    const content = await this.fetchWithTimeout(feed.url)
    
    let allIncidents: ParsedIncident[] = []
    
    if (feed.slug.startsWith('td_') && !content.includes('<rss')) {
      allIncidents = this.parseTransportDeptXml(content, feed)
    } else {
      allIncidents = await this.parseRssFeed(content, feed)
    }
    
    // Filter to only new items
    const newIncidents = await this.filterNewItems(allIncidents, feed)
    
    if (newIncidents.length === 0) {
      console.log(`✅ ${feed.slug}: No new incidents since last check`)
      return { feed: feed.slug, incidents: 0, errors: [] }
    }
    
    // Upsert new incidents
    const saved = await this.upsertIncidents(newIncidents)
    
    // Update feed timestamp to latest incident
    const latestIncident = allIncidents.reduce((latest, current) => 
      new Date(current.source_updated_at) > new Date(latest.source_updated_at) ? current : latest
    )
    await this.updateFeedLastSeen(feed.id, latestIncident.source_updated_at)
    
    console.log(`✅ ${feed.slug}: ${saved}/${newIncidents.length} new incidents processed`)
    
    return {
      feed: feed.slug,
      incidents: saved,
      errors: []
    }
    
  } catch (error) {
    const errorMsg = `Failed to process ${feed.slug}: ${error instanceof Error ? error.message : 'Unknown error'}`
    console.error(errorMsg)
    errors.push(errorMsg)
    
    return {
      feed: feed.slug,
      incidents: 0,
      errors: [errorMsg]
    }
  }
}
```

### 4. **Update database schema to track last processed timestamp**

```typescript
// Update the updateFeedLastSeen method
private async updateFeedLastSeen(feedId: string, lastSeenTimestamp: string): Promise<void> {
  const { error } = await supabase
    .from('gov_feeds')
    .update({ last_seen_pubdate: lastSeenTimestamp })
    .eq('id', feedId)
  
  if (error) {
    console.error('Error updating feed timestamp:', error)
  }
}
```

### 5. **Fix broken feed URLs**

```sql
-- Update migration to fix broken feed URLs
UPDATE gov_feeds SET 
  url = 'https://rss.weather.gov.hk/rss/QuickEarthquakeMessage.xml',
  active = true 
WHERE slug = 'hko_eq';

-- Add new working feeds
INSERT INTO gov_feeds (slug, url, active) VALUES
  ('hko_felt_earthquake', 'https://rss.weather.gov.hk/rss/FeltEarthquake.xml', true)
ON CONFLICT (slug) DO UPDATE SET 
  url = EXCLUDED.url,
  active = EXCLUDED.active;

-- Disable broken feeds
UPDATE gov_feeds SET active = false 
WHERE slug IN ('td_special', 'mtr_rail', 'emsd_util');
```

## Benefits of This Approach

1. **Content-Based Deduplication**: Same content = same ID, regardless of republishing
2. **Incremental Processing**: Only processes new items since last run
3. **Robust ID Generation**: Uses title + content hash instead of fragile timestamps
4. **Feed-Specific Logic**: Handles different feed formats appropriately
5. **Error Resilience**: Continues working even if some feeds fail

## Implementation Steps

1. Update `generateIncidentId` method to use content-based hashing
2. Update `parseRssFeed` and `parseTransportDeptXml` to use new ID generation
3. Add `filterNewItems` method for incremental processing
4. Update `processFeed` to use incremental processing
5. Update database with correct feed URLs
6. Test with a small batch first

This approach is simple, robust, and directly addresses the duplicate content issue without complex logic.