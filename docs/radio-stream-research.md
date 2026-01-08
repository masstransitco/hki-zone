# Commercial Radio Hong Kong - Stream Proxy Implementation

## Overview

This document details the implementation of a server-side proxy system that enables direct browser playback of Commercial Radio Hong Kong (CRHK) live streams. The system bypasses CRHK's token-based authentication by extracting CloudFront signed cookies via headless browser automation.

**Status:** Working implementation for FM 881, FM 903, and AM 864
**Last Updated:** January 2026

---

## Radio Stations

| Station | Frequency | Chinese Name | Stream Quality | CDN Domain |
|---------|-----------|--------------|----------------|------------|
| FM 881 | 88.1 MHz | 雷霆881 | HD (AAC) | live.881903.com |
| FM 903 | 90.3 MHz | 叱咤903 | HD (AAC) | live.881903.com or live2.881903.com |
| AM 864 | 864 kHz | 豁達864 | SD (AAC) | live.881903.com or live2.881903.com |

**Official Website:** https://www.881903.com

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (Client)                             │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  /admin/radio page                                           │    │
│  │  ┌──────────────────┐                                        │    │
│  │  │ ProxyStreamPlayer │ ──── HLS.js ──── <audio> element      │    │
│  │  └────────┬─────────┘                                        │    │
│  └───────────┼──────────────────────────────────────────────────┘    │
└──────────────┼───────────────────────────────────────────────────────┘
               │
               │ 1. Initialize stream
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      Next.js Server                                   │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  /api/radio/stream                                              │  │
│  │  - Check cache for existing credentials                         │  │
│  │  - If not cached: launch Playwright browser                     │  │
│  │  - Navigate to 881903.com/live/{channel}                        │  │
│  │  - Extract CloudFront cookies from browser context              │  │
│  │  - Cache credentials for 45 minutes                             │  │
│  │  - Return proxy URL to client                                   │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  /api/radio/proxy                                               │  │
│  │  - Receive HLS requests from client                             │  │
│  │  - Attach CloudFront cookies to upstream requests               │  │
│  │  - Fetch from live.881903.com or live2.881903.com               │  │
│  │  - Rewrite m3u8 playlist URLs to route through proxy            │  │
│  │  - Return stream data to client                                 │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  In-Memory Cache (streamCache)                                  │  │
│  │  - Stores: streamUrl, cookies, cookieDomain, timestamp          │  │
│  │  - TTL: 45 minutes                                              │  │
│  │  - Prevents concurrent extractions via locks                    │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
               │
               │ 2. Proxy HLS requests
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Commercial Radio CDN                               │
│                                                                       │
│  live.881903.com / live2.881903.com (CloudFront)                     │
│  - Validates CloudFront-Policy, CloudFront-Signature,                │
│    CloudFront-Key-Pair-Id cookies                                    │
│  - Returns HLS playlist and audio segments                           │
│                                                                       │
│  Stream URLs:                                                         │
│  - https://live.881903.com/edge-aac/881hd/playlist.m3u8              │
│  - https://live.881903.com/edge-aac/903hd/playlist.m3u8              │
│  - https://live.881903.com/edge-aac/864sd/playlist.m3u8              │
└──────────────────────────────────────────────────────────────────────┘
```

---

## How It Works

### Step 1: Stream Initialization

When a user clicks play on a Commercial Radio station:

1. **Client** calls `GET /api/radio/stream?channel=903`
2. **Server** checks in-memory cache for valid credentials
3. If **cached** (< 45 min old): Return cached proxy URL immediately
4. If **not cached**: Proceed to cookie extraction

### Step 2: Cookie Extraction (First Play Only)

```typescript
// Simplified flow from /api/radio/stream/route.ts

1. Launch headless Chromium via Playwright
2. Navigate to https://www.881903.com/live/{channel}
3. Wait for page to load (domcontentloaded + 3s delay)
4. Attempt to click play button to trigger stream initialization
5. Extract all cookies from browser context
6. Filter for CloudFront-* cookies:
   - CloudFront-Policy
   - CloudFront-Signature
   - CloudFront-Key-Pair-Id
7. Detect cookie domain (live.881903.com vs live2.881903.com)
8. Cache credentials with timestamp
9. Close browser
10. Return proxy URL to client
```

### Step 3: HLS Playback via Proxy

1. **Client** receives proxy URL: `/api/radio/proxy?channel=903`
2. **HLS.js** requests the master playlist from proxy
3. **Proxy** fetches from CDN with CloudFront cookies attached
4. **Proxy** rewrites URLs in m3u8 to route through itself:
   ```
   Original:  chunks.m3u8
   Rewritten: /api/radio/proxy?channel=903&path=chunks.m3u8
   ```
5. **HLS.js** requests audio segments through proxy
6. **Proxy** fetches segments with authentication, returns raw audio data
7. **Audio element** plays the decoded stream

### Step 4: CDN Fallback Logic

The proxy handles CDN domain mismatches:

```typescript
// If primary CDN returns 404, try alternate
if (response.status === 404) {
  const altHost = currentHost === "live.881903.com"
    ? "live2.881903.com"
    : "live.881903.com"
  response = await fetchWithAuth(altUrl)

  // For 864, also try SD quality suffix
  if (response.status === 404 && channel === "864") {
    response = await fetchWithAuth(url.replace("864hd", "864sd"))
  }
}
```

---

## API Reference

### GET /api/radio/stream

Initialize a stream and get the proxy URL.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| channel | string | Yes | Channel ID: `881`, `903`, or `864` |

**Response:**
```json
{
  "success": true,
  "channel": "903",
  "proxyUrl": "/api/radio/proxy?channel=903",
  "streamUrl": "https://live2.881903.com/edge-aac/903hd/playlist.m3u8",
  "hasCookies": true,
  "cacheAge": 120,
  "cacheTTL": 2700
}
```

**Timing:**
- First request (no cache): 8-10 seconds
- Subsequent requests (cached): < 100ms

### GET /api/radio/proxy

Proxy HLS requests with authentication.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| channel | string | Yes | Channel ID: `881`, `903`, or `864` |
| path | string | No | Relative path for segment requests |

**Response:**
- For `.m3u8` files: Rewritten playlist with proxy URLs
- For `.aac` segments: Raw audio data

**Headers Set:**
```
Content-Type: application/vnd.apple.mpegurl (playlists)
Content-Type: audio/aac (segments)
Access-Control-Allow-Origin: *
Cache-Control: no-cache (playlists) / public, max-age=2 (segments)
```

---

## File Structure

```
/app/
├── admin/
│   └── radio/
│       └── page.tsx          # Radio player UI with HLS.js integration
└── api/
    └── radio/
        ├── stream/
        │   └── route.ts      # Cookie extraction endpoint
        └── proxy/
            └── route.ts      # HLS proxy endpoint
```

---

## Key Implementation Files

### /app/api/radio/stream/route.ts

Handles cookie extraction via Playwright:

```typescript
interface StreamCache {
  streamUrl: string
  cookies: Record<string, string>
  headers: Record<string, string>
  cookieDomain: string  // Track which CDN domain cookies are for
  timestamp: number
  channel: string
}

// Cache configuration
const CACHE_TTL_MS = 45 * 60 * 1000  // 45 minutes
const streamCache: Map<string, StreamCache> = new Map()

// Extraction uses Playwright with stealth settings
browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"]
})
```

### /app/api/radio/proxy/route.ts

Handles authenticated HLS proxying:

```typescript
// Build cookie header from cached credentials
const cookieHeader = Object.entries(credentials.cookies)
  .map(([name, value]) => `${name}=${value}`)
  .join("; ")

// Fetch with authentication
const response = await fetch(targetUrl, {
  headers: {
    "User-Agent": "Mozilla/5.0...",
    "Referer": `https://www.881903.com/live/${channel}`,
    "Origin": "https://www.881903.com",
    "Cookie": cookieHeader,
  },
})

// Rewrite playlist URLs to go through proxy
const rewrittenLines = lines.map((line) => {
  if (line.startsWith("#") || line === "") return line
  return `/api/radio/proxy?channel=${channel}&path=${encodeURIComponent(line)}`
})
```

### /app/admin/radio/page.tsx

Frontend player using HLS.js:

```typescript
import Hls from "hls.js"

function ProxyStreamPlayer({ station }) {
  const hlsRef = useRef<Hls | null>(null)

  const togglePlay = async () => {
    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true })
      hls.loadSource(proxyUrl)
      hls.attachMedia(audioRef.current)
      hls.on(Hls.Events.MANIFEST_PARSED, () => audioRef.current.play())
    }
  }
}
```

---

## Authentication Details

### CloudFront Signed Cookies

Commercial Radio uses AWS CloudFront with signed cookies for stream access:

| Cookie | Purpose |
|--------|---------|
| `CloudFront-Policy` | Base64-encoded access policy (resource patterns, expiry) |
| `CloudFront-Signature` | RSA signature validating the policy |
| `CloudFront-Key-Pair-Id` | Identifies the CloudFront key pair used |

Cookies are domain-scoped to either `live.881903.com` or `live2.881903.com`.

### Why Cookies Are Needed

```
Direct access without cookies:
GET https://live.881903.com/edge-aac/903hd/playlist.m3u8
→ 403 Forbidden

With valid CloudFront cookies:
GET https://live.881903.com/edge-aac/903hd/playlist.m3u8
Cookie: CloudFront-Policy=...; CloudFront-Signature=...; CloudFront-Key-Pair-Id=...
→ 200 OK (HLS playlist)
```

### Cookie Lifecycle

1. **Generation**: Cookies are set when the official player page loads
2. **Validity**: ~1 hour from generation
3. **Our cache TTL**: 45 minutes (conservative margin)
4. **Refresh**: Automatic on next play after cache expires

---

## Stream URL Patterns

| Channel | Quality | URL Pattern |
|---------|---------|-------------|
| FM 881 | HD | `https://{cdn}/edge-aac/881hd/playlist.m3u8` |
| FM 903 | HD | `https://{cdn}/edge-aac/903hd/playlist.m3u8` |
| AM 864 | SD | `https://{cdn}/edge-aac/864sd/playlist.m3u8` |

Where `{cdn}` is `live.881903.com` or `live2.881903.com`

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `playwright` | ^1.x | Headless browser for cookie extraction |
| `hls.js` | ^1.x | HLS playback in browsers without native support |

---

## Performance Characteristics

| Metric | Value |
|--------|-------|
| First play latency | 8-10 seconds |
| Cached play latency | < 1 second |
| Cache duration | 45 minutes |
| Memory per cached channel | ~2KB |
| Playwright browser launch | ~2-3 seconds |
| Page navigation | ~3-5 seconds |

---

## Limitations & Known Issues

### AM 864 Reliability

The 864 channel sometimes fails because:
- Uses SD quality (`864sd`) instead of HD
- May be served from different CDN domain than cookies are scoped to
- Fallback logic handles most cases but not all

### Single-Instance Caching

The current implementation uses in-memory caching:
- Cache is lost on server restart
- Not shared across multiple server instances
- **Production recommendation**: Use Redis for distributed caching

### Browser Resource Usage

Playwright browser launches are resource-intensive:
- Each extraction spawns a Chromium process
- Concurrent extractions are prevented via locks
- Consider rate limiting in high-traffic scenarios

---

## Comparison: RTHK vs CRHK

| Feature | RTHK | CRHK (with proxy) |
|---------|------|-------------------|
| Stream Access | Public HLS | Authenticated HLS |
| Direct Browser Play | Yes | Via proxy |
| First Play Latency | Instant | 8-10s |
| Subsequent Play | Instant | Instant (cached) |
| Server Resources | None | Playwright + proxy |

### RTHK Stream URLs (Public)

```
https://rthkaudio1-lh.akamaihd.net/i/radio1_1@355864/master.m3u8
https://rthkaudio2-lh.akamaihd.net/i/radio2_1@355865/master.m3u8
https://rthkaudio3-lh.akamaihd.net/i/radio3_1@355866/master.m3u8
https://rthkaudio4-lh.akamaihd.net/i/radio4_1@355867/master.m3u8
https://rthkaudio5-lh.akamaihd.net/i/radio5_1@355868/master.m3u8
```

---

## Troubleshooting

### No Sound Playing

1. Check browser console for HLS.js errors
2. Verify `/api/radio/stream` returns `hasCookies: true`
3. Check server logs for `[Radio]` and `[Proxy]` messages
4. Try clicking the refresh button to re-extract cookies

### 403 Forbidden Errors

- Cookies may have expired → Refresh stream
- Cookie domain mismatch → Proxy will auto-retry alternate CDN
- Server logs will show `[Proxy] Cleared expired cache`

### 404 Not Found Errors

- CDN domain mismatch → Proxy tries alternate domain
- For 864: Quality suffix mismatch (hd vs sd) → Auto-corrected

### Slow First Play

Normal behavior - cookie extraction takes 8-10 seconds. Subsequent plays within 45 minutes are instant.

---

## Security Considerations

- Cookies are stored server-side only, never exposed to client
- Proxy validates channel parameter against whitelist
- No user credentials are stored or transmitted
- Stream access is for internal/admin use only

---

## Future Improvements

1. **Redis caching** for multi-instance deployments
2. **Pre-warming** cookies on server start
3. **Health checks** to proactively refresh expiring cookies
4. **Metrics** for cache hit rates and extraction times
5. **Fallback** to external player if proxy fails

---

## Changelog

| Date | Update |
|------|--------|
| 2026-01-07 | Initial research - documented protection mechanisms |
| 2026-01-07 | Created /admin/radio page with external popup player |
| 2026-01-08 | Implemented Playwright-based cookie extraction |
| 2026-01-08 | Created HLS proxy with URL rewriting |
| 2026-01-08 | Added dynamic CDN domain detection |
| 2026-01-08 | Fixed 864 channel SD quality suffix |
| 2026-01-08 | Added HLS.js for cross-browser playback |
| 2026-01-08 | All three channels (881, 903, 864) working |

---

## References

- [HLS.js Documentation](https://github.com/video-dev/hls.js/)
- [Playwright Documentation](https://playwright.dev/)
- [AWS CloudFront Signed Cookies](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-signed-cookies.html)
- [Commercial Radio Hong Kong](https://en.wikipedia.org/wiki/Commercial_Radio_Hong_Kong)
