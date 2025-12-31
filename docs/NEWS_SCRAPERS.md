# News Scrapers Development Plan

> Last updated: 2026-01-01

## Overview

This document tracks the development progress of news scrapers for HKI Zone, including current sources, planned additions, and technical implementation details.

---

## Current Sources (10 Active)

| Source | Language | Type | Status | Notes |
|--------|----------|------|--------|-------|
| HK01 | ZH | Local | ✅ Active | Using JSON API |
| AM730 | ZH | Local | ✅ Active | HTML scraping, improved extraction |
| SCMP | EN | Local | ✅ Active | South China Morning Post |
| RTHK | EN/ZH | Local | ✅ Active | Public broadcaster |
| Sing Tao | ZH | Local | ✅ Active | Traditional media |
| HKFP | EN | Local | ✅ Active | Hong Kong Free Press |
| The Standard | EN | Local | ✅ Active | English daily |
| ONCC | ZH | Local | ✅ Active | Oriental Daily |
| Bastille Post | ZH | Local | ✅ Active | Digital media |
| Bloomberg | EN | International | ✅ Active | Business/Finance |

---

## Planned Additions

### Phase 1: International Wire Services (High Priority)

| Source | Language | Priority | Status | Scraping Method |
|--------|----------|----------|--------|-----------------|
| Reuters | EN | 🔴 High | ⬜ Planned | RSS Feed |
| AP News | EN | 🔴 High | ⬜ Planned | RSS Feed |
| AFP | EN/ZH | 🟡 Medium | ⬜ Planned | RSS Feed |

### Phase 2: Western Media with Asia Focus

| Source | Language | Priority | Status | Scraping Method |
|--------|----------|----------|--------|-----------------|
| BBC News Asia | EN | 🔴 High | ⬜ Planned | RSS Feed |
| The Guardian Asia | EN | 🟡 Medium | ⬜ Planned | RSS Feed |
| Nikkei Asia | EN | 🟡 Medium | ⬜ Planned | HTML/API |
| CNN Asia | EN | 🟢 Low | ⬜ Planned | RSS Feed |
| Financial Times | EN | 🟢 Low | ⬜ Planned | Paywall issues |

### Phase 3: Mainland China Outlets

| Source | Language | Priority | Status | Scraping Method |
|--------|----------|----------|--------|-----------------|
| CGTN | EN/ZH | 🔴 High | ⬜ Planned | RSS Feed |
| Xinhua (新华社) | EN/ZH | 🔴 High | ⬜ Planned | RSS/HTML |
| Global Times (环球时报) | EN | 🟡 Medium | ⬜ Planned | RSS Feed |
| Caixin (财新) | EN/ZH | 🟡 Medium | ⬜ Planned | HTML/API |
| The Paper (澎湃新闻) | ZH | 🟡 Medium | ⬜ Planned | HTML/API |
| Phoenix/ifeng (凤凰网) | ZH | 🟢 Low | ⬜ Planned | HTML |

### Phase 4: Regional Asia

| Source | Language | Priority | Status | Scraping Method |
|--------|----------|----------|--------|-----------------|
| Channel News Asia | EN | 🟡 Medium | ⬜ Planned | RSS Feed |
| Taiwan News | EN/ZH | 🟢 Low | ⬜ Planned | RSS Feed |
| Macau Daily Times | EN | 🟢 Low | ⬜ Planned | HTML |

---

## Implementation Progress

### Completed

- [x] HK01 - Migrated to JSON API (2026-01-01)
- [x] AM730 - Improved content extraction with `isValidContent()` filter (2026-01-01)
- [x] Perplexity selector - Added markdown code block handling (2026-01-01)
- [x] Language filtering - Fixed with `language_variant` column (2025-12-31)
- [x] Article sorting - Using `published_at` with NULL handling (2025-12-31)

### In Progress

- [ ] Reuters scraper
- [ ] BBC News Asia scraper
- [ ] CGTN scraper

### Backlog

- [ ] Caixin scraper
- [ ] Channel News Asia scraper
- [ ] Xinhua scraper

---

## Technical Architecture

### Scraper Structure

Each scraper follows this standard pattern:

```
lib/scrapers/{source}.js
├── Constants (HDRS, BASE_URL)
├── fromRSS() / fromSitemap() / fromAPI()
├── extractArticleContent(url)
├── scrape{Source}WithContent()
└── module.exports
```

### Data Schema

```javascript
{
  source: 'string',      // Source identifier
  url: 'string',         // Article URL
  headline: 'string',    // Article title
  date: 'string',        // ISO date string
  body: 'string',        // Full article content
  coverImg: 'string',    // Image URL
  author: 'string',      // Author name(s)
}
```

### Best Practices

1. **Prefer APIs over HTML scraping** - More reliable, faster
2. **Use RSS feeds when available** - Structured data, less brittle
3. **Implement rate limiting** - Respect source servers
4. **Add content validation** - Filter ads, navigation, junk
5. **Handle timeouts gracefully** - 15s default timeout
6. **Log extraction failures** - For debugging

---

## RSS Feed Reference

### Confirmed Working RSS Feeds

| Source | RSS URL | Notes |
|--------|---------|-------|
| BBC Asia | `https://feeds.bbci.co.uk/news/world/asia/rss.xml` | General Asia |
| Reuters | `https://www.reutersagency.com/feed/` | Check current feeds |
| CGTN | `https://www.cgtn.com/subscribe/rss/section/world.xml` | Multiple sections |
| Guardian | `https://www.theguardian.com/world/asia-pacific/rss` | Asia Pacific |
| CNA | `https://www.channelnewsasia.com/rssfeeds/8395986` | Asia |

### To Research

- [ ] Xinhua RSS endpoints
- [ ] Caixin RSS/API
- [ ] Global Times RSS

---

## Selection Algorithm

Articles go through a multi-stage selection process:

1. **Scraping** - Collect articles from all sources
2. **Deduplication** - Remove similar/duplicate stories
3. **Language Detection** - Categorize EN/ZH/Both
4. **Category Assignment** - News, Business, Tech, etc.
5. **Relevance Scoring** - Perplexity AI selection
6. **Final Selection** - Top articles per category/language

### Perplexity Selection Criteria

- **Immediacy (I)**: Breaking news value
- **Novelty (N)**: New information/angles
- **Depth (D)**: Analysis quality
- **Significance (S)**: Impact on HK/readers
- **Uniqueness (U)**: Not covered elsewhere

---

## Known Issues

| Issue | Status | Notes |
|-------|--------|-------|
| Perplexity markdown responses | ✅ Fixed | Strip ```json blocks |
| HK01 HTML parsing unreliable | ✅ Fixed | Switched to JSON API |
| AM730 ad content leaking | ✅ Fixed | Added content filters |
| Language filter .in() bug | ✅ Fixed | Use language_variant column |

---

## Changelog

### 2026-01-01
- Improved HK01 scraper with JSON API
- Enhanced AM730 content extraction
- Extended Perplexity markdown handling
- Created this documentation

### 2025-12-31
- Fixed language filtering with `language_variant` column
- Fixed article sorting with `published_at`
- Fixed Top Stories category merging

---

## Next Steps

1. **Immediate**: Build Reuters + BBC + CGTN scrapers
2. **Short-term**: Add Caixin for mainland financial perspective
3. **Medium-term**: Implement Channel News Asia for regional balance
4. **Long-term**: Evaluate paywall sources (FT, Nikkei)

---

## Contact

For questions about scraper development, check the codebase at:
- Scrapers: `/lib/scrapers/`
- Selection: `/lib/perplexity-article-selector.ts`
- API routes: `/app/api/cron/`
