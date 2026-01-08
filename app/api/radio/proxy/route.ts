import { NextRequest, NextResponse } from "next/server"

// Import the cache from stream route
// We need to use a shared cache mechanism
const VALID_CHANNELS = ["881", "903", "864"]

// In-memory cache shared with stream route via module scope
// Note: In production, use Redis or similar for multi-instance deployments
interface StreamCache {
  streamUrl: string
  cookies: Record<string, string>
  timestamp: number
  channel: string
}

// Reference to the cache - will be populated by stream route
let streamCache: Map<string, StreamCache> | null = null

// Lazy import to avoid circular dependency
async function getCache(): Promise<Map<string, StreamCache>> {
  if (!streamCache) {
    const streamModule = await import("../stream/route")
    streamCache = streamModule.streamCache
  }
  return streamCache
}

async function getCredentials(channel: string): Promise<StreamCache | null> {
  const cache = await getCache()
  return cache.get(channel) || null
}

// Proxy the main playlist or any HLS resource
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const channel = searchParams.get("channel")
  const path = searchParams.get("path") // For segment requests

  if (!channel || !VALID_CHANNELS.includes(channel)) {
    return NextResponse.json(
      { error: "Invalid channel" },
      { status: 400 }
    )
  }

  try {
    // Get cached credentials
    let credentials = await getCredentials(channel)

    // If no credentials, trigger extraction
    if (!credentials) {
      console.log(`[Proxy] No cached credentials for ${channel}, triggering extraction`)
      const streamModule = await import("../stream/route")
      credentials = await streamModule.getStreamCredentials(channel)
    }

    if (!credentials) {
      return NextResponse.json(
        { error: "Stream not available. Please try again." },
        { status: 503 }
      )
    }

    // Build the target URL
    let targetUrl: string
    if (path) {
      // Segment request - resolve relative to stream base
      const baseUrl = new URL(credentials.streamUrl)
      // Handle both absolute and relative paths
      if (path.startsWith("http")) {
        targetUrl = path
      } else {
        // Relative path from playlist
        const basePath = baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf("/") + 1)
        targetUrl = `${baseUrl.origin}${basePath}${path}${baseUrl.search}`
      }
    } else {
      // Main playlist request
      targetUrl = credentials.streamUrl
    }

    console.log(`[Proxy] Fetching: ${targetUrl}`)
    console.log(`[Proxy] Available cookies: ${Object.keys(credentials.cookies).join(", ")}`)

    // Build cookie header
    const cookieHeader = Object.entries(credentials.cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join("; ")

    console.log(`[Proxy] Cookie header length: ${cookieHeader.length}`)

    // Helper to make fetch request with proper headers
    const fetchWithAuth = async (url: string) => {
      return fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": `https://www.881903.com/live/${channel}`,
          "Origin": "https://www.881903.com",
          "Cookie": cookieHeader,
          "Accept": "*/*",
          "Accept-Language": "en-US,en;q=0.9",
        },
      })
    }

    // Fetch the resource with proper headers
    let response = await fetchWithAuth(targetUrl)

    // If 404, try alternate CDN domain and/or quality suffix
    if (response.status === 404 && !path) {
      const currentHost = new URL(targetUrl).hostname
      const altHost = currentHost === "live.881903.com" ? "live2.881903.com" : "live.881903.com"
      let altUrl = targetUrl.replace(currentHost, altHost)
      console.log(`[Proxy] Got 404, trying alternate CDN: ${altUrl}`)
      response = await fetchWithAuth(altUrl)

      // If still 404 and it's 864, try swapping hd/sd suffix
      if (response.status === 404 && channel === "864") {
        const sdUrl = altUrl.replace("864hd", "864sd")
        console.log(`[Proxy] Still 404, trying SD quality for 864: ${sdUrl}`)
        response = await fetchWithAuth(sdUrl)
        if (response.ok) altUrl = sdUrl
      }

      // Update targetUrl for URL rewriting if alternate works
      if (response.ok) {
        targetUrl = altUrl
      }
    }

    if (!response.ok) {
      console.error(`[Proxy] Upstream error: ${response.status} ${response.statusText}`)

      // If we get 403, credentials may be expired - clear cache
      if (response.status === 403) {
        const cache = await getCache()
        cache.delete(channel)
        console.log(`[Proxy] Cleared expired cache for channel ${channel}`)
      }

      return NextResponse.json(
        { error: `Stream error: ${response.status}` },
        { status: response.status }
      )
    }

    const contentType = response.headers.get("content-type") || "application/vnd.apple.mpegurl"

    // For m3u8 playlists, we need to rewrite URLs to go through our proxy
    if (contentType.includes("mpegurl") || targetUrl.includes(".m3u8")) {
      let content = await response.text()

      // Rewrite URLs in the playlist to go through our proxy
      // Match lines that are URLs (not starting with #)
      const lines = content.split("\n")
      const rewrittenLines = lines.map((line) => {
        const trimmed = line.trim()
        // Skip comments and empty lines
        if (trimmed.startsWith("#") || trimmed === "") {
          return line
        }
        // This is a URL - rewrite it to go through proxy
        const encodedPath = encodeURIComponent(trimmed)
        return `/api/radio/proxy?channel=${channel}&path=${encodedPath}`
      })

      content = rewrittenLines.join("\n")

      return new NextResponse(content, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      })
    }

    // For binary content (audio/video segments), stream directly
    const body = await response.arrayBuffer()

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=2",
      },
    })

  } catch (error) {
    console.error("[Proxy] Error:", error)
    return NextResponse.json(
      { error: "Proxy error" },
      { status: 500 }
    )
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  })
}
