# Hong Kong Radio - Stream Proxy Implementation

## Overview

This document details the implementation of an edge-distributed proxy system that enables instant browser playback of Hong Kong radio live streams. The system handles:
- **CRHK (Commercial Radio)** - Solves CloudFront's IP-restricted cookie authentication via GCE VM in Hong Kong
- **RTHK (Radio Television Hong Kong)** - Proxies public Akamai streams with edge caching and URL resilience
- **Metro Radio (新城電台)** - Proxies public CDN77 streams with edge caching

All streams are distributed globally via Cloudflare's edge network at `radio.air.zone`.

**Status:** Production - Instant playback for all 13 channels
**Last Updated:** January 2026

---

## Radio Stations

### CRHK (Commercial Radio Hong Kong)

| Station | Frequency | Chinese Name | Stream Quality | CDN Domain |
|---------|-----------|--------------|----------------|------------|
| FM 881 | 88.1 MHz | 雷霆881 | HD (AAC) | live.881903.com |
| FM 903 | 90.3 MHz | 叱咤903 | HD (AAC) | live.881903.com or live2.881903.com |
| AM 864 | 864 kHz | 豁達864 | SD (AAC) | live.881903.com or live2.881903.com |

**Official Website:** https://www.881903.com

### RTHK (Radio Television Hong Kong)

| Station | Frequency | Chinese Name | Stream Quality | CDN Domain |
|---------|-----------|--------------|----------------|------------|
| RTHK Radio 1 | 92.6-94.4 MHz | 香港電台第一台 | HD (AAC) | rthkradio1-live.akamaized.net |
| RTHK Radio 2 | 94.8-96.9 MHz | 香港電台第二台 | HD (AAC) | rthkradio2-live.akamaized.net |
| RTHK Radio 3 | 97.9-106.8 MHz | 香港電台第三台 | HD (AAC) | rthkradio3-live.akamaized.net |
| RTHK Radio 4 | 97.6-98.9 MHz | 香港電台第四台 | HD (AAC) | rthkradio4-live.akamaized.net |
| RTHK Radio 5 | 783 kHz | 香港電台第五台 | HD (AAC) | rthkradio5-live.akamaized.net |
| RTHK Putonghua | AM 621 / FM 100.9 | 香港電台普通話台 | HD (AAC) | rthkradiopth-live.akamaized.net |
| RTHK CNR/HK | AM 675 | 香港之聲 | HD (AAC) | rthkradiocnrhk-live.akamaized.net |

**Official Website:** https://www.rthk.hk

### Metro Radio (新城電台)

| Station | Frequency | Chinese Name | Stream Quality | CDN Domain |
|---------|-----------|--------------|----------------|------------|
| Metro Finance | FM 102.4-106.3 MHz | 新城財經台 | SD (TS) | 1716664847.rsc.cdn77.org |
| Metro Info | FM 99.7-102.1 MHz | 新城知訊台 | SD (TS) | 1603884249.rsc.cdn77.org |
| Metro Plus | AM 1044 kHz | 新城採訊台 | SD (TS) | 1946218710.rsc.cdn77.org |

**Official Website:** https://www.metroradio.com.hk

---

## System Architecture (Current)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client (iOS/Web)                             │
│  AVPlayer / HLS.js → https://radio.air.zone/{channel}/playlist.m3u8 │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │ ~50-100ms (edge latency)
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Cloudflare Worker (Edge Proxy)                    │
│  workers/radio-proxy/src/index.ts                                    │
│                                                                      │
│  Routes:                                                             │
│    /{channel}/playlist.m3u8  → master playlist (no-cache)           │
│    /{channel}/{path}         → chunklist or audio segments          │
│    /health                   → health check                          │
│                                                                      │
│  Responsibilities:                                                   │
│  - Edge caching of audio segments (60s TTL)                         │
│  - Rewrite m3u8 URLs to route through edge                          │
│  - Forward requests to GCE origin via Cloudflare Tunnel             │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   │ Cloudflare Tunnel (HTTPS)
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    GCE VM (Hong Kong) - Origin Server                │
│  IP: 34.92.40.84 (asia-east2-c)                                      │
│  Tunnel: origin-radio.air.zone                                       │
│                                                                      │
│  servers/radio-proxy/src/server.ts (Express + Playwright)            │
│                                                                      │
│  Endpoints:                                                          │
│    /health                       → health check                      │
│    /api/radio/stream?channel=X   → extract cookies (if needed)       │
│    /api/radio/proxy?channel=X    → proxy HLS with cookies            │
│    /api/radio/refresh/:channel   → force cookie refresh              │
│    /api/radio/prewarm            → refresh all channels              │
│                                                                      │
│  Key Features:                                                       │
│  - Playwright cookie extraction from same HK IP                      │
│  - In-memory credential cache (45 min TTL)                           │
│  - CDN fallback (live ↔ live2)                                      │
│  - Runs as systemd service with auto-restart                         │
│                                                                      │
│  Cron (keeps cookies warm):                                          │
│    */20 * * * * curl -s -X POST http://localhost:3001/api/radio/prewarm │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   │ Fetch with CloudFront cookies
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Commercial Radio CDN (CloudFront)                 │
│  live.881903.com / live2.881903.com                                  │
│                                                                      │
│  Stream URLs:                                                        │
│    https://live.881903.com/edge-aac/881hd/playlist.m3u8             │
│    https://live.881903.com/edge-aac/903hd/playlist.m3u8             │
│    https://live.881903.com/edge-aac/864sd/playlist.m3u8             │
│                                                                      │
│  Authentication:                                                     │
│    - CloudFront-Policy                                               │
│    - CloudFront-Signature                                            │
│    - CloudFront-Key-Pair-Id                                          │
│  + IP restriction (AWS:SourceIp condition)                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Why This Architecture?

### The IP Restriction Problem

CloudFront signed cookies for CRHK streams have an **IP address restriction** (`AWS:SourceIp` condition in the policy). This means:

1. Cookies extracted from **IP A** only work when requests come from **IP A**
2. Vercel's serverless functions have **dynamic IPs** - each invocation may use a different IP
3. Extracting cookies on Vercel → fetching CDN from Vercel = **different IPs = 403 Forbidden**

### The Solution

Run **both** cookie extraction **and** CDN fetching from the **same static IP**:

- **GCE VM in Hong Kong** (34.92.40.84) runs Playwright extraction
- **Same VM** fetches from CloudFront CDN
- **Same IP** for both operations = cookies work!
- **Cloudflare Worker** at the edge handles client requests and caches segments

---

## Performance Comparison

| Metric | Old (Vercel-only) | New (Edge + GCE) |
|--------|-------------------|------------------|
| First play latency | 8-10 seconds | **< 1 second** |
| Cached play latency | < 1 second | **< 500ms** |
| Cookie warmth | On-demand | **Always warm (cron)** |
| Global latency | Single region | **Edge-distributed** |
| Segment caching | None | **60s edge cache** |

---

## File Structure

```
/
├── workers/
│   └── radio-proxy/
│       ├── src/
│       │   └── index.ts          # Cloudflare Worker (edge proxy)
│       ├── wrangler.toml         # Worker configuration
│       └── package.json
│
├── servers/
│   └── radio-proxy/
│       └── src/
│           └── server.ts         # GCE origin server (Express + Playwright)
│
├── app/
│   ├── admin/
│   │   └── radio/
│   │       └── page.tsx          # Radio player UI
│   └── api/
│       └── radio/
│           ├── stream/
│           │   └── route.ts      # Legacy Vercel endpoint (fallback)
│           └── proxy/
│               └── route.ts      # Legacy Vercel proxy (fallback)
│
└── docs/
    └── radio-stream-research.md  # This file
```

---

## Component Details

### 1. Cloudflare Worker (Edge Proxy)

**Location:** `workers/radio-proxy/src/index.ts`
**Deployed to:** `radio.air.zone`

```typescript
// Key configuration
const VALID_CHANNELS = ["881", "903", "864"]
const PROXY_ORIGIN = "https://origin-radio.air.zone"  // GCE via tunnel

// URL routing
// https://radio.air.zone/903/playlist.m3u8 → master playlist
// https://radio.air.zone/903/chunks.m3u8   → chunklist
// https://radio.air.zone/903/seg123.aac    → audio segment

// Caching strategy
// - Playlists (.m3u8): no-cache (live content, always fresh)
// - Segments (.aac/.ts): Cache-Control: public, max-age=60

// URL rewriting for playlists
function rewritePlaylist(content: string, channel: string, origin: string): string {
  // Converts CDN URLs to edge proxy URLs
  // e.g., "chunks.m3u8" → "https://radio.air.zone/903/chunks.m3u8"
}
```

### 2. GCE Origin Server

**Location:** `servers/radio-proxy/src/server.ts`
**Runs on:** GCE VM in Hong Kong (34.92.40.84:3001)
**Exposed via:** Cloudflare Tunnel → `origin-radio.air.zone`

```typescript
// Express server with endpoints:
app.get("/health", ...)
app.get("/api/radio/stream", ...)   // Cookie extraction
app.get("/api/radio/proxy", ...)    // HLS proxy with cookies
app.post("/api/radio/refresh/:channel", ...)
app.post("/api/radio/prewarm", ...)

// Credential cache
interface CachedCredentials {
  streamUrl: string
  cookies: Record<string, string>
  cookieDomain: string
  timestamp: number
  channel: string
}

const CACHE_TTL_MS = 45 * 60 * 1000  // 45 minutes
const credentialCache: Map<string, CachedCredentials> = new Map()

// Cookie extraction via Playwright
async function extractStreamCredentials(channel: string) {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.goto(`https://www.881903.com/live/${channel}`)
  // Wait for CloudFront cookies to be set
  // Extract and cache cookies
}
```

### 3. Cloudflare Tunnel

**Tunnel ID:** `c8c45f8f-fd77-4825-a9b4-cf83af35bd89`
**Config:** `/etc/cloudflared/config.yml` on GCE

```yaml
tunnel: c8c45f8f-fd77-4825-a9b4-cf83af35bd89
credentials-file: /etc/cloudflared/c8c45f8f-fd77-4825-a9b4-cf83af35bd89.json

ingress:
  - hostname: origin-radio.air.zone
    service: http://localhost:3001
  - service: http_status:404
```

**Systemd service:** `/etc/systemd/system/cloudflared.service`

```ini
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/cloudflared tunnel run
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 4. Frontend Player

**Location:** `app/admin/radio/page.tsx`

```typescript
// Edge proxy URL
const EDGE_PROXY_URL = "https://radio.air.zone"

function ProxyStreamPlayer({ station }: { station: RadioStation }) {
  // Stream URL directly from edge
  const streamUrl = `${EDGE_PROXY_URL}/${station.channel}/playlist.m3u8`

  // HLS.js for playback
  const hls = new Hls({ enableWorker: true, lowLatencyMode: true })
  hls.loadSource(streamUrl)
  hls.attachMedia(audioRef.current)
}
```

---

## Cookie Prewarm System

To ensure instant playback, cookies are refreshed proactively:

### Cron Job (on GCE)

```bash
# /etc/cron.d/radio-prewarm
*/20 * * * * root curl -s -X POST http://localhost:3001/api/radio/prewarm
```

### Prewarm Endpoint

```typescript
app.post("/api/radio/prewarm", async (req, res) => {
  const channels = ["881", "903", "864"]
  const results = []

  for (const channel of channels) {
    try {
      await extractStreamCredentials(channel)
      results.push({ channel, status: "success" })
    } catch (error) {
      results.push({ channel, status: "failed", error: error.message })
    }
  }

  res.json({ prewarmed: results })
})
```

### Cookie Lifecycle

```
0:00  - Cron triggers prewarm
0:01  - Cookies extracted for 881, 903, 864
0:20  - Cron triggers prewarm (refresh)
0:40  - Cron triggers prewarm (refresh)
0:45  - Cache TTL would expire, but already refreshed at 0:40
...   - Continuous 20-minute refresh cycle
```

---

## DNS Configuration

| Domain | Type | Target | Purpose |
|--------|------|--------|---------|
| `radio.air.zone` | Worker Route | Cloudflare Worker | Client-facing edge proxy |
| `origin-radio.air.zone` | CNAME | Tunnel UUID.cfargotunnel.com | GCE origin via tunnel |

---

## Authentication Details

### CloudFront Signed Cookies

| Cookie | Purpose |
|--------|---------|
| `CloudFront-Policy` | Base64-encoded access policy with IP restriction |
| `CloudFront-Signature` | RSA signature validating the policy |
| `CloudFront-Key-Pair-Id` | Identifies the CloudFront key pair |

### IP Restriction in Policy

The decoded `CloudFront-Policy` contains:

```json
{
  "Statement": [{
    "Condition": {
      "IpAddress": {
        "AWS:SourceIp": "34.92.40.84/32"  // GCE VM IP
      },
      "DateLessThan": {
        "AWS:EpochTime": 1736456789
      }
    }
  }]
}
```

This is why extraction and fetching must happen from the same IP.

---

## Troubleshooting

### Stream Not Playing

1. **Check GCE server health:**
   ```bash
   curl https://origin-radio.air.zone/health
   ```

2. **Check Worker health:**
   ```bash
   curl https://radio.air.zone/health
   ```

3. **Check cookie freshness:**
   ```bash
   curl https://origin-radio.air.zone/api/radio/stream?channel=903
   # Look at cacheAge - should be < 2700 (45 min in seconds)
   ```

4. **Force cookie refresh:**
   ```bash
   curl -X POST https://origin-radio.air.zone/api/radio/refresh/903
   ```

### 403 Forbidden from CDN

- Cookies expired → Trigger prewarm
- IP mismatch → Should not happen with current architecture
- Check GCE VM hasn't changed IPs

### 404 Not Found

- CDN domain mismatch → Proxy auto-retries alternate domain
- 864 channel → Uses `864sd` not `864hd`

### Tunnel Issues

```bash
# On GCE VM
sudo systemctl status cloudflared
sudo journalctl -u cloudflared -f

# Restart if needed
sudo systemctl restart cloudflared
```

---

## Deployment Commands

### Deploy Worker

```bash
cd workers/radio-proxy
npx wrangler deploy
```

### Update GCE Server

```bash
# SSH to GCE
gcloud compute ssh radio-proxy --zone=asia-east2-c

# Pull latest code
cd ~/radio-proxy
git pull

# Restart server
pm2 restart radio-proxy
```

### Restart Tunnel

```bash
sudo systemctl restart cloudflared
```

---

## Monitoring

### Worker Analytics

- Cloudflare Dashboard → Workers → radio-proxy → Analytics
- Monitor: Request count, latency percentiles, error rates

### GCE Server Logs

```bash
# PM2 logs
pm2 logs radio-proxy

# Systemd logs for tunnel
sudo journalctl -u cloudflared -f
```

### Key Metrics to Watch

| Metric | Normal | Alert |
|--------|--------|-------|
| Cache age | < 20 min | > 40 min |
| Worker latency | < 200ms | > 1000ms |
| Origin latency | < 500ms | > 2000ms |
| Error rate | < 1% | > 5% |

---

## Comparison: RTHK vs CRHK

| Feature | RTHK (Edge Proxy) | CRHK (Edge Proxy) |
|---------|-------------------|-------------------|
| Stream Access | Public Akamai HLS | IP-restricted CloudFront |
| Architecture | Edge → Akamai direct | Edge → Tunnel → GCE → CDN |
| Authentication | None needed | CloudFront signed cookies |
| First Play | **Instant** (edge cached) | **Instant** (prewarmed) |
| Global Latency | **Optimized** (edge cache) | **Optimized** (edge cache) |
| Maintenance | None | Cookie refresh cron |

---

## RTHK Edge Proxy (Added January 2026)

RTHK streams are public and do not require authentication. They are now proxied through the same Cloudflare Worker for:
- Consistent URL pattern across all stations
- Edge caching of audio segments (60s TTL)
- Resilience against URL changes (redirects handled server-side)
- Single point of management

### RTHK URL Resolution

**Old Akamai URLs (302 redirect):**
```
https://rthkaudio1-lh.akamaihd.net/i/radio1_1@355864/master.m3u8
→ redirects to new URL
```

**New Akamai URLs (current):**
```
https://rthkradio1-live.akamaized.net/hls/live/2035313/radio1/master.m3u8
https://rthkradio2-live.akamaized.net/hls/live/2040078/radio2/master.m3u8
https://rthkradio3-live.akamaized.net/hls/live/2040079/radio3/master.m3u8
https://rthkradio4-live.akamaized.net/hls/live/2040080/radio4/master.m3u8
https://rthkradio5-live.akamaized.net/hls/live/2040081/radio5/master.m3u8
https://rthkradiopth-live.akamaized.net/hls/live/2040082/radiopth/master.m3u8
https://rthkradiocnrhk-live.akamaized.net/hls/live/2046111/radiocnrhk/master.m3u8
```

**Proxy URLs (client-facing):**
```
https://radio.air.zone/rthk1/playlist.m3u8
https://radio.air.zone/rthk2/playlist.m3u8
https://radio.air.zone/rthk3/playlist.m3u8
https://radio.air.zone/rthk4/playlist.m3u8
https://radio.air.zone/rthk5/playlist.m3u8
https://radio.air.zone/rthkpth/playlist.m3u8
https://radio.air.zone/rthkcnrhk/playlist.m3u8
```

### RTHK Architecture

```
Client → radio.air.zone/rthk1/playlist.m3u8
       → Cloudflare Worker (edge)
       → Direct fetch to Akamai (with redirect: follow)
       → Return with URLs rewritten to worker
       → Edge cache segments for 60s
```

The worker uses `redirect: "follow"` when fetching, so if Akamai changes redirect destinations again, it will still work automatically

---

## Metro Radio Edge Proxy (Added January 2026)

Metro Radio (新城電台) is Hong Kong's third major radio broadcaster. They migrated from Akamai to **CDN77** for their streaming infrastructure. Streams are public with no authentication required.

### Metro Stream Discovery

Metro Radio streams were discovered using browser automation (Playwright) to capture network requests from their website. The key findings:

1. **CDN Migration**: Metro moved from `metroradio-lh.akamaihd.net` (now returns 400 errors) to CDN77
2. **Stream Structure**: No master playlist - entry point IS the chunklist directly
3. **Segment Paths**: Date-based paths (e.g., `2026/01/09/04/13/57-05035.ts`)

### Metro Stream URLs

**Source URLs (CDN77):**
```
https://1716664847.rsc.cdn77.org/1716664847/tracks-a1/mono.ts.m3u8  (Metro Finance FM 104)
https://1603884249.rsc.cdn77.org/1603884249/tracks-a1/mono.ts.m3u8  (Metro Info FM 99.7)
https://1946218710.rsc.cdn77.org/1946218710/tracks-a1/mono.ts.m3u8  (Metro Plus AM 1044)
```

**Proxy URLs (client-facing):**
```
https://radio.air.zone/metro104/playlist.m3u8   (Metro Finance)
https://radio.air.zone/metro997/playlist.m3u8   (Metro Info)
https://radio.air.zone/metro1044/playlist.m3u8  (Metro Plus)
```

### Metro Architecture

```
Client → radio.air.zone/metro104/playlist.m3u8
       → Cloudflare Worker (edge)
       → Direct fetch to CDN77 (public, no auth)
       → Return with URLs rewritten to worker
       → Edge cache segments for 60s
```

### Metro-Specific Implementation

Metro has a unique stream structure compared to CRHK and RTHK:

```typescript
// Metro stream URLs - entry point is chunklist, not master playlist
const METRO_STREAM_URLS: Record<string, string> = {
  metro104: "https://1716664847.rsc.cdn77.org/1716664847/tracks-a1/mono.ts.m3u8",
  metro997: "https://1603884249.rsc.cdn77.org/1603884249/tracks-a1/mono.ts.m3u8",
  metro1044: "https://1946218710.rsc.cdn77.org/1946218710/tracks-a1/mono.ts.m3u8",
}

// URL rewriting for Metro playlists
// Segments have date-based paths: 2026/01/09/04/13/57-05035.ts
// Rewrite: "2026/01/09/04/13/57-05035.ts" → "https://radio.air.zone/metro104/2026/01/09/04/13/57-05035.ts"
```

### Comparison: Metro vs RTHK vs CRHK

| Feature | Metro (Edge Proxy) | RTHK (Edge Proxy) | CRHK (Edge Proxy) |
|---------|-------------------|-------------------|-------------------|
| Stream Access | Public CDN77 HLS | Public Akamai HLS | IP-restricted CloudFront |
| CDN Provider | CDN77 | Akamai | CloudFront |
| Architecture | Edge → CDN77 direct | Edge → Akamai direct | Edge → Tunnel → GCE → CDN |
| Authentication | None needed | None needed | CloudFront signed cookies |
| Stream Format | .ts segments | .aac segments | .aac segments |
| Playlist Type | Chunklist only | Master + Chunklist | Master + Chunklist |
| First Play | **Instant** (edge cached) | **Instant** (edge cached) | **Instant** (prewarmed) |
| Maintenance | None | None | Cookie refresh cron |

---

## Cost Estimate

| Service | Free Tier | Expected Usage | Monthly Cost |
|---------|-----------|----------------|--------------|
| Cloudflare Workers | 100k req/day | ~10k req/day | $0 |
| GCE e2-micro | 1 free/month | 1 instance | $0 |
| Cloudflare Tunnel | Free | Unlimited | $0 |
| Bandwidth | - | ~10GB/month | ~$1 |

**Total: ~$1/month**

---

## Security Considerations

- CloudFront cookies never exposed to client
- All traffic via HTTPS (tunnel + worker)
- GCE firewall allows only Cloudflare IPs on port 3001
- No user credentials stored
- Stream access is for internal/admin use

---

## Changelog

| Date | Update |
|------|--------|
| 2026-01-07 | Initial research - documented protection mechanisms |
| 2026-01-07 | Created /admin/radio page with external popup player |
| 2026-01-08 | Implemented Playwright-based cookie extraction (Vercel) |
| 2026-01-08 | Created HLS proxy with URL rewriting |
| 2026-01-08 | Discovered IP restriction on CloudFront cookies |
| 2026-01-08 | Deployed GCE VM in Hong Kong with static IP |
| 2026-01-08 | Set up Cloudflare Tunnel for secure HTTPS access |
| 2026-01-08 | Created Cloudflare Worker for edge caching |
| 2026-01-08 | Added cookie prewarm cron (every 20 min) |
| 2026-01-08 | **Production: Instant playback achieved** |
| 2026-01-08 | Updated radio cards with gradient styling |
| 2026-01-08 | Added RTHK to edge proxy (fixed broken Akamai URL redirects) |
| 2026-01-09 | Researched Metro Radio - discovered CDN migration from Akamai to CDN77 |
| 2026-01-09 | Added Metro Radio (3 channels) to edge proxy - instant playback for all 11 HK radio streams |
| 2026-01-09 | Added RTHK Putonghua (普通話台) and RTHK CNR/HK (香港之聲) - complete coverage of all 13 HK radio channels |

---

## References

- [HLS.js Documentation](https://github.com/video-dev/hls.js/)
- [Playwright Documentation](https://playwright.dev/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [AWS CloudFront Signed Cookies](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-signed-cookies.html)
- [Commercial Radio Hong Kong](https://en.wikipedia.org/wiki/Commercial_Radio_Hong_Kong)
