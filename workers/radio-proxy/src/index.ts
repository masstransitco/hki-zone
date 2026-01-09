/**
 * Hong Kong Radio Edge CDN Proxy
 *
 * Proxies HLS streams for CRHK, RTHK, and Metro:
 * - CRHK (881/903/864): Routes through GCE origin for IP-restricted CloudFront auth
 * - RTHK (rthk1-5): Direct fetch to Akamai (public streams, no auth needed)
 * - Metro (metro104/metro997/metro1044): Direct fetch to CDN77 (public streams, no auth needed)
 *
 * Routes:
 *   /{channel}/playlist.m3u8  → master playlist (3s edge cache)
 *   /{channel}/{chunklist}    → live chunklist (NO cache - must be fresh)
 *   /{channel}/{segment}      → audio segments (60s edge cache)
 *   /health                   → health check
 *
 * Caching Strategy:
 *   - Master playlist: 3s edge cache - rarely changes, safe to cache
 *   - Chunklist: NO cache - updates every few seconds with new segments
 *   - Segments: 60s edge cache - immutable once published
 */

interface Env {
  RADIO_COOKIES: KVNamespace
  ENVIRONMENT: string
}

// CRHK channels - require authenticated proxy through GCE
const CRHK_CHANNELS = ["881", "903", "864"]

// RTHK channels - public streams, direct fetch to Akamai
const RTHK_CHANNELS = ["rthk1", "rthk2", "rthk3", "rthk4", "rthk5"]

// Metro channels - public streams, direct fetch to CDN77
const METRO_CHANNELS = ["metro104", "metro997", "metro1044"]

// All valid channels
const ALL_CHANNELS = [...CRHK_CHANNELS, ...RTHK_CHANNELS, ...METRO_CHANNELS]

// RTHK stream URLs (new Akamai URLs - the old ones 302 redirect to these)
const RTHK_STREAM_URLS: Record<string, string> = {
  rthk1: "https://rthkradio1-live.akamaized.net/hls/live/2035313/radio1/master.m3u8",
  rthk2: "https://rthkradio2-live.akamaized.net/hls/live/2040078/radio2/master.m3u8",
  rthk3: "https://rthkradio3-live.akamaized.net/hls/live/2040079/radio3/master.m3u8",
  rthk4: "https://rthkradio4-live.akamaized.net/hls/live/2040080/radio4/master.m3u8",
  rthk5: "https://rthkradio5-live.akamaized.net/hls/live/2040081/radio5/master.m3u8",
}

// Metro stream URLs (CDN77 - streams are chunklists directly, no master playlist)
// Format: https://{stream_id}.rsc.cdn77.org/{stream_id}/tracks-a1/mono.ts.m3u8
const METRO_STREAM_URLS: Record<string, string> = {
  metro104: "https://1716664847.rsc.cdn77.org/1716664847/tracks-a1/mono.ts.m3u8", // Metro Finance FM 104
  metro997: "https://1603884249.rsc.cdn77.org/1603884249/tracks-a1/mono.ts.m3u8", // Metro Info FM 99.7
  metro1044: "https://1946218710.rsc.cdn77.org/1946218710/tracks-a1/mono.ts.m3u8", // Metro Plus AM 1044
}

// GCE origin via named Cloudflare Tunnel (for CRHK only)
const PROXY_ORIGIN = "https://origin-radio.air.zone"

// Cache TTLs for scalability
const PLAYLIST_CACHE_TTL = 3 // seconds - short cache for live playlists
const SEGMENT_CACHE_TTL = 60 // seconds - longer cache for immutable segments

// Helper to check if channel is RTHK
function isRthkChannel(channel: string): boolean {
  return RTHK_CHANNELS.includes(channel)
}

// Helper to check if channel is Metro
function isMetroChannel(channel: string): boolean {
  return METRO_CHANNELS.includes(channel)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: corsHeaders(),
      })
    }

    // Health check
    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          status: "ok",
          env: env.ENVIRONMENT,
          mode: "hybrid-cdn",
          channels: {
            crhk: CRHK_CHANNELS,
            rthk: RTHK_CHANNELS,
            metro: METRO_CHANNELS,
          },
        }),
        { headers: { "Content-Type": "application/json" } }
      )
    }

    // Parse URL: /{channel}/{path...}
    const pathParts = url.pathname.split("/").filter(Boolean)

    if (pathParts.length < 1) {
      return errorResponse(400, "Invalid path. Use /{channel}/playlist.m3u8")
    }

    const channel = pathParts[0]
    const resourcePath = pathParts.slice(1).join("/") || "playlist.m3u8"

    if (!ALL_CHANNELS.includes(channel)) {
      return errorResponse(400, `Invalid channel: ${channel}. Valid: ${ALL_CHANNELS.join(", ")}`)
    }

    try {
      // Determine resource type
      const isSegment = resourcePath.includes(".aac") || resourcePath.includes(".ts")
      const isPlaylist = resourcePath.includes(".m3u8")
      const isMasterPlaylist = resourcePath === "playlist.m3u8" // Entry point, rarely changes
      const isChunklist = isPlaylist && !isMasterPlaylist // Live chunklist, updates frequently
      const cacheKey = new Request(url.toString(), request)

      // Check edge cache first (master playlists and segments only, NOT chunklists)
      // Chunklists must always be fresh for live streaming
      if (isSegment || isMasterPlaylist) {
        const cache = caches.default
        const cachedResponse = await cache.match(cacheKey)
        if (cachedResponse) {
          console.log(`[CDN] Cache HIT: ${resourcePath}`)
          return cachedResponse
        }
        console.log(`[CDN] Cache MISS: ${resourcePath}`)
      }

      // Branch based on channel type
      if (isRthkChannel(channel)) {
        // RTHK: Direct fetch to Akamai (public streams, no auth needed)
        return await handleRthkRequest(channel, resourcePath, url, request, cacheKey, isSegment, isMasterPlaylist, isChunklist)
      }

      if (isMetroChannel(channel)) {
        // Metro: Direct fetch to CDN77 (public streams, no auth needed)
        return await handleMetroRequest(channel, resourcePath, url, request, cacheKey, isSegment, isMasterPlaylist, isChunklist)
      }

      // CRHK: Proxy through GCE origin (IP-restricted CloudFront auth)
      return await handleCrhkRequest(channel, resourcePath, url, request, cacheKey, isSegment, isMasterPlaylist, isChunklist)
    } catch (error) {
      console.error("[CDN] Error:", error)
      return errorResponse(500, "CDN proxy error")
    }
  },
}

// Handle RTHK requests - direct fetch to Akamai (public, no auth)
async function handleRthkRequest(
  channel: string,
  resourcePath: string,
  url: URL,
  request: Request,
  cacheKey: Request,
  isSegment: boolean,
  isMasterPlaylist: boolean,
  isChunklist: boolean
): Promise<Response> {
  // Build target URL
  let targetUrl: string

  if (resourcePath === "playlist.m3u8") {
    // Master playlist - use known Akamai URL directly
    targetUrl = RTHK_STREAM_URLS[channel]
  } else {
    // Segment or chunklist - resolve relative to Akamai base
    const baseUrl = new URL(RTHK_STREAM_URLS[channel])
    const basePath = baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf("/") + 1)
    targetUrl = `${baseUrl.origin}${basePath}${resourcePath}`
  }

  console.log(`[RTHK] Fetching: ${targetUrl}`)

  // Fetch with redirect following (in case Akamai changes URLs again)
  const response = await fetch(targetUrl, {
    headers: {
      "User-Agent": request.headers.get("User-Agent") || "CloudflareWorker",
      Accept: "*/*",
    },
    redirect: "follow",
  })

  if (!response.ok) {
    console.error(`[RTHK] Upstream error: ${response.status}`)
    return errorResponse(response.status, `RTHK stream error: ${response.status}`)
  }

  const contentType = response.headers.get("content-type") || "application/octet-stream"

  // For master playlists, rewrite URLs and cache at edge
  if (isMasterPlaylist) {
    const content = await response.text()
    const rewritten = rewritePlaylist(content, channel, url.origin)

    // Cache master playlist at edge (s-maxage for edge, max-age=0 for client freshness)
    const playlistResponse = new Response(rewritten, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        ...corsHeaders(),
        "Cache-Control": `public, s-maxage=${PLAYLIST_CACHE_TTL}, max-age=0`,
      },
    })

    // Store in edge cache
    const cache = caches.default
    await cache.put(cacheKey, playlistResponse.clone())
    console.log(`[RTHK] Cached master playlist (${PLAYLIST_CACHE_TTL}s): ${resourcePath}`)

    return playlistResponse
  }

  // For chunklists, rewrite URLs but DO NOT cache (must be fresh for live streaming)
  if (isChunklist) {
    const content = await response.text()
    const rewritten = rewritePlaylist(content, channel, url.origin)

    console.log(`[RTHK] Chunklist (no-cache): ${resourcePath}`)
    return new Response(rewritten, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        ...corsHeaders(),
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    })
  }

  // For segments, cache at edge
  const body = await response.arrayBuffer()

  const edgeResponse = new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      ...corsHeaders(),
      "Cache-Control": `public, max-age=${SEGMENT_CACHE_TTL}`,
    },
  })

  // Store in cache for segments
  if (isSegment) {
    const cache = caches.default
    const responseToCache = new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        ...corsHeaders(),
        "Cache-Control": `public, max-age=${SEGMENT_CACHE_TTL}`,
      },
    })
    await cache.put(cacheKey, responseToCache)
    console.log(`[RTHK] Cached segment (${SEGMENT_CACHE_TTL}s): ${resourcePath}`)
  }

  return edgeResponse
}

// Handle Metro requests - direct fetch to CDN77 (public, no auth)
// Metro streams are simpler: the "playlist" is actually a chunklist with date-based segment paths
async function handleMetroRequest(
  channel: string,
  resourcePath: string,
  url: URL,
  request: Request,
  cacheKey: Request,
  isSegment: boolean,
  isMasterPlaylist: boolean,
  isChunklist: boolean
): Promise<Response> {
  const streamUrl = METRO_STREAM_URLS[channel]
  const baseUrl = new URL(streamUrl)
  // Base path: e.g., https://1716664847.rsc.cdn77.org/1716664847/
  const streamId = baseUrl.pathname.split("/")[1] // Extract stream ID from path
  const basePath = `${baseUrl.origin}/${streamId}/`

  // Build target URL
  let targetUrl: string

  if (resourcePath === "playlist.m3u8") {
    // Metro's "playlist" is actually the chunklist (mono.ts.m3u8)
    targetUrl = streamUrl
  } else {
    // Segments have date-based paths like 2026/01/09/03/26/55-05035.ts
    // These are relative to the stream base, not the chunklist path
    targetUrl = `${basePath}${resourcePath}`
  }

  console.log(`[Metro] Fetching: ${targetUrl}`)

  const response = await fetch(targetUrl, {
    headers: {
      "User-Agent": request.headers.get("User-Agent") || "CloudflareWorker",
      Accept: "*/*",
    },
    redirect: "follow",
  })

  if (!response.ok) {
    console.error(`[Metro] Upstream error: ${response.status}`)
    return errorResponse(response.status, `Metro stream error: ${response.status}`)
  }

  const contentType = response.headers.get("content-type") || "application/octet-stream"

  // For Metro, the "playlist" request returns the chunklist directly
  // We treat it as a chunklist (no-cache) since it updates frequently
  if (isMasterPlaylist) {
    const content = await response.text()
    const rewritten = rewriteMetroPlaylist(content, channel, url.origin, basePath)

    // Don't cache the chunklist - it updates every few seconds
    console.log(`[Metro] Chunklist (no-cache): ${resourcePath}`)
    return new Response(rewritten, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        ...corsHeaders(),
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    })
  }

  // For segments, cache at edge
  const body = await response.arrayBuffer()

  const edgeResponse = new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      ...corsHeaders(),
      "Cache-Control": `public, max-age=${SEGMENT_CACHE_TTL}`,
    },
  })

  // Store in cache for segments
  if (isSegment) {
    const cache = caches.default
    const responseToCache = new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        ...corsHeaders(),
        "Cache-Control": `public, max-age=${SEGMENT_CACHE_TTL}`,
      },
    })
    await cache.put(cacheKey, responseToCache)
    console.log(`[Metro] Cached segment (${SEGMENT_CACHE_TTL}s): ${resourcePath}`)
  }

  return edgeResponse
}

// Rewrite Metro playlist URLs
// Metro segments have date-based paths like "2026/01/09/03/26/55-05035.ts"
function rewriteMetroPlaylist(content: string, channel: string, origin: string, basePath: string): string {
  const lines = content.split("\n")

  const rewrittenLines = lines.map((line) => {
    const trimmed = line.trim()

    // Skip comments and empty lines
    if (trimmed.startsWith("#") || trimmed === "") {
      return line
    }

    // Handle relative URLs (date-based paths like 2026/01/09/03/26/55-05035.ts)
    if (!trimmed.startsWith("http")) {
      return `${origin}/${channel}/${trimmed}`
    }

    // Handle absolute URLs - extract path after stream ID
    const url = new URL(trimmed)
    const pathParts = url.pathname.split("/")
    // Skip first empty part and stream ID, keep the rest
    const relativePath = pathParts.slice(2).join("/")
    return `${origin}/${channel}/${relativePath}`
  })

  return rewrittenLines.join("\n")
}

// Handle CRHK requests - proxy through GCE origin (IP-restricted CloudFront auth)
async function handleCrhkRequest(
  channel: string,
  resourcePath: string,
  url: URL,
  request: Request,
  cacheKey: Request,
  isSegment: boolean,
  isMasterPlaylist: boolean,
  isChunklist: boolean
): Promise<Response> {
  // Build GCE origin URL - proxy handles extraction if needed
  let originUrl: string

  if (resourcePath === "playlist.m3u8") {
    originUrl = `${PROXY_ORIGIN}/api/radio/proxy?channel=${channel}`
  } else {
    originUrl = `${PROXY_ORIGIN}/api/radio/proxy?channel=${channel}&path=${encodeURIComponent(resourcePath)}`
  }

  console.log(`[CRHK] Fetching from origin: ${originUrl}`)

  const originResponse = await fetch(originUrl, {
    headers: {
      "User-Agent": request.headers.get("User-Agent") || "CloudflareWorker",
      Accept: "*/*",
    },
  })

  if (!originResponse.ok) {
    console.error(`[CRHK] Origin error: ${originResponse.status}`)
    return errorResponse(originResponse.status, `Origin error: ${originResponse.status}`)
  }

  const contentType = originResponse.headers.get("content-type") || "application/octet-stream"

  // For master playlists, rewrite URLs and cache at edge
  if (isMasterPlaylist) {
    const content = await originResponse.text()
    const rewritten = rewritePlaylist(content, channel, url.origin)

    // Cache master playlist at edge (s-maxage for edge, max-age=0 for client freshness)
    const playlistResponse = new Response(rewritten, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        ...corsHeaders(),
        "Cache-Control": `public, s-maxage=${PLAYLIST_CACHE_TTL}, max-age=0`,
      },
    })

    // Store in edge cache
    const cache = caches.default
    await cache.put(cacheKey, playlistResponse.clone())
    console.log(`[CRHK] Cached master playlist (${PLAYLIST_CACHE_TTL}s): ${resourcePath}`)

    return playlistResponse
  }

  // For chunklists, rewrite URLs but DO NOT cache (must be fresh for live streaming)
  if (isChunklist) {
    const content = await originResponse.text()
    const rewritten = rewritePlaylist(content, channel, url.origin)

    console.log(`[CRHK] Chunklist (no-cache): ${resourcePath}`)
    return new Response(rewritten, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        ...corsHeaders(),
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    })
  }

  // For segments, cache at edge and return
  const body = await originResponse.arrayBuffer()

  const response = new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      ...corsHeaders(),
      "Cache-Control": `public, max-age=${SEGMENT_CACHE_TTL}`,
    },
  })

  // Store in cache for segments
  if (isSegment) {
    const cache = caches.default
    const responseToCache = new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        ...corsHeaders(),
        "Cache-Control": `public, max-age=${SEGMENT_CACHE_TTL}`,
      },
    })
    await cache.put(cacheKey, responseToCache)
    console.log(`[CRHK] Cached segment (${SEGMENT_CACHE_TTL}s): ${resourcePath}`)
  }

  return response
}

function rewritePlaylist(content: string, channel: string, origin: string): string {
  const lines = content.split("\n")

  const rewrittenLines = lines.map((line) => {
    const trimmed = line.trim()

    // Skip comments and empty lines
    if (trimmed.startsWith("#") || trimmed === "") {
      return line
    }

    // Handle URLs from Vercel proxy (already encoded as query params)
    // e.g., /api/radio/proxy?channel=903&path=chunks.m3u8
    if (trimmed.startsWith("/api/radio/proxy")) {
      const url = new URL(trimmed, "http://dummy")
      const path = url.searchParams.get("path") || "playlist.m3u8"
      return `${origin}/${channel}/${path}`
    }

    // Handle relative URLs
    if (!trimmed.startsWith("http")) {
      return `${origin}/${channel}/${trimmed}`
    }

    // Handle absolute URLs (extract just the filename)
    const urlParts = trimmed.split("/")
    const filename = urlParts[urlParts.length - 1].split("?")[0] // Remove query params
    return `${origin}/${channel}/${filename}`
  })

  return rewrittenLines.join("\n")
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  }
}

function errorResponse(
  status: number,
  message: string,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
      ...extraHeaders,
    },
  })
}
