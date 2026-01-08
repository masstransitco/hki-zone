/**
 * CRHK Radio Edge CDN Proxy
 *
 * Proxies HLS streams through Vercel origin and caches audio segments at the edge.
 * Vercel handles the IP-restricted CloudFront cookie extraction and fetching.
 *
 * Routes:
 *   /{channel}/playlist.m3u8  → master playlist (no-cache, always fresh)
 *   /{channel}/{path}         → chunklist or audio segments (edge cached)
 *   /health                   → health check
 */

interface Env {
  RADIO_COOKIES: KVNamespace
  ENVIRONMENT: string
}

const VALID_CHANNELS = ["881", "903", "864"]

// Vercel origin for the actual streaming
const VERCEL_ORIGIN = "https://hki.zone"

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
        JSON.stringify({ status: "ok", env: env.ENVIRONMENT, mode: "hybrid-cdn" }),
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

    if (!VALID_CHANNELS.includes(channel)) {
      return errorResponse(400, `Invalid channel: ${channel}. Valid: ${VALID_CHANNELS.join(", ")}`)
    }

    try {
      // Check cache first for audio segments
      const isSegment = resourcePath.includes(".aac") || resourcePath.includes(".ts")
      const cacheKey = new Request(url.toString(), request)

      if (isSegment) {
        const cache = caches.default
        const cachedResponse = await cache.match(cacheKey)
        if (cachedResponse) {
          console.log(`[CDN] Cache HIT: ${resourcePath}`)
          return cachedResponse
        }
        console.log(`[CDN] Cache MISS: ${resourcePath}`)
      }

      // Build Vercel origin URL
      // For playlist requests, we need to first initialize the stream
      let vercelUrl: string

      if (resourcePath === "playlist.m3u8") {
        // First call the stream endpoint to ensure cookies are extracted
        const initUrl = `${VERCEL_ORIGIN}/api/radio/stream?channel=${channel}`
        const initResponse = await fetch(initUrl)
        if (!initResponse.ok) {
          const error = await initResponse.text()
          console.error(`[CDN] Init failed: ${initResponse.status} ${error}`)
          return errorResponse(503, "Stream initialization failed", { "Retry-After": "5" })
        }

        // Now get the playlist through the proxy
        vercelUrl = `${VERCEL_ORIGIN}/api/radio/proxy?channel=${channel}`
      } else {
        // For segments and chunklists, go directly to proxy
        vercelUrl = `${VERCEL_ORIGIN}/api/radio/proxy?channel=${channel}&path=${encodeURIComponent(resourcePath)}`
      }

      console.log(`[CDN] Fetching from origin: ${vercelUrl}`)

      const originResponse = await fetch(vercelUrl, {
        headers: {
          "User-Agent": request.headers.get("User-Agent") || "CloudflareWorker",
          Accept: "*/*",
        },
      })

      if (!originResponse.ok) {
        console.error(`[CDN] Origin error: ${originResponse.status}`)
        return errorResponse(originResponse.status, `Origin error: ${originResponse.status}`)
      }

      const contentType = originResponse.headers.get("content-type") || "application/octet-stream"

      // For playlists, rewrite URLs to go through edge
      if (contentType.includes("mpegurl") || resourcePath.includes(".m3u8")) {
        const content = await originResponse.text()
        const rewritten = rewritePlaylist(content, channel, url.origin)

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
          "Cache-Control": "public, max-age=60", // Cache segments for 1 minute at edge
        },
      })

      // Store in cache for segments
      if (isSegment) {
        const cache = caches.default
        // Clone response for caching
        const responseToCache = new Response(body, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            ...corsHeaders(),
            "Cache-Control": "public, max-age=60",
          },
        })
        await cache.put(cacheKey, responseToCache)
        console.log(`[CDN] Cached: ${resourcePath}`)
      }

      return response
    } catch (error) {
      console.error("[CDN] Error:", error)
      return errorResponse(500, "CDN proxy error")
    }
  },
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
