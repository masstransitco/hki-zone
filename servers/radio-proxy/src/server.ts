import express from "express"
import cors from "cors"
import { chromium, Browser, BrowserContext } from "playwright"

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())

// ============= Types =============
interface StreamCache {
  streamUrl: string
  cookies: Record<string, string>
  cookieDomain: string
  timestamp: number
  channel: string
}

// ============= Cache =============
const streamCache = new Map<string, StreamCache>()
const CACHE_TTL_MS = 45 * 60 * 1000 // 45 minutes
const extractionLocks = new Map<string, Promise<StreamCache | null>>()

const VALID_CHANNELS = ["881", "903", "864"]

// ============= Extraction =============
async function extractStreamCredentials(channel: string): Promise<StreamCache | null> {
  console.log(`[Extract] Starting for channel ${channel}`)

  let browser: Browser | null = null
  let context: BrowserContext | null = null

  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    })

    context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 720 },
      locale: "en-HK",
    })

    const page = await context.newPage()

    let streamUrl: string | null = null

    page.on("request", (request) => {
      const url = request.url()
      if (url.includes("live.881903.com") || url.includes("live2.881903.com")) {
        if (url.includes(".m3u8")) {
          streamUrl = url
          console.log(`[Extract] Found stream URL: ${url}`)
        }
      }
    })

    const liveUrl = `https://www.881903.com/live/${channel}`
    console.log(`[Extract] Navigating to ${liveUrl}`)

    await page.goto(liveUrl, { waitUntil: "domcontentloaded", timeout: 30000 })
    await page.waitForTimeout(3000)

    // Try to click play button
    const playSelectors = [".fp-ui", ".fp-playbtn", ".fp-play", 'button[class*="play"]', '[aria-label*="play" i]']

    for (const selector of playSelectors) {
      try {
        const btn = page.locator(selector).first()
        if (await btn.isVisible({ timeout: 1000 })) {
          console.log(`[Extract] Clicking: ${selector}`)
          await btn.click({ timeout: 3000 })
          await page.waitForTimeout(2000)
          if (streamUrl) break
        }
      } catch {}
    }

    if (!streamUrl) {
      await page.waitForTimeout(3000)
    }

    // Get CloudFront cookies
    const allCookies = await context.cookies()
    const cloudFrontCookies: Record<string, string> = {}
    let cookieDomain = "live.881903.com"

    for (const cookie of allCookies) {
      if (cookie.name.startsWith("CloudFront-")) {
        cloudFrontCookies[cookie.name] = cookie.value
        if (cookie.domain.includes("881903.com")) {
          cookieDomain = cookie.domain.replace(/^\./, "")
          console.log(`[Extract] Found ${cookie.name} from ${cookieDomain}`)
        }
      }
    }

    // Also check both CDN domains explicitly
    for (const domain of ["https://live.881903.com", "https://live2.881903.com"]) {
      const domainCookies = await context.cookies(domain)
      for (const cookie of domainCookies) {
        if (cookie.name.startsWith("CloudFront-") && !cloudFrontCookies[cookie.name]) {
          cloudFrontCookies[cookie.name] = cookie.value
          cookieDomain = new URL(domain).hostname
          console.log(`[Extract] Found ${cookie.name} from ${cookieDomain}`)
        }
      }
    }

    // Fallback stream URL
    if (!streamUrl) {
      const qualitySuffix = channel === "864" ? "sd" : "hd"
      streamUrl = `https://${cookieDomain}/edge-aac/${channel}${qualitySuffix}/playlist.m3u8`
      console.log(`[Extract] Using fallback URL: ${streamUrl}`)
    }

    const hasRequired =
      cloudFrontCookies["CloudFront-Policy"] &&
      cloudFrontCookies["CloudFront-Signature"] &&
      cloudFrontCookies["CloudFront-Key-Pair-Id"]

    if (!hasRequired) {
      console.log(`[Extract] Missing required cookies. Got: ${Object.keys(cloudFrontCookies).join(", ")}`)
      return null
    }

    console.log(`[Extract] Success for channel ${channel}`)

    return {
      streamUrl,
      cookies: cloudFrontCookies,
      cookieDomain,
      timestamp: Date.now(),
      channel,
    }
  } catch (error) {
    console.error(`[Extract] Error for ${channel}:`, error)
    return null
  } finally {
    if (context) await context.close().catch(() => {})
    if (browser) await browser.close().catch(() => {})
  }
}

async function getStreamCredentials(channel: string): Promise<StreamCache | null> {
  const cached = streamCache.get(channel)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`[Cache] Hit for ${channel} (age: ${Math.round((Date.now() - cached.timestamp) / 1000)}s)`)
    return cached
  }

  const existingLock = extractionLocks.get(channel)
  if (existingLock) {
    console.log(`[Cache] Waiting for existing extraction for ${channel}`)
    return existingLock
  }

  const extractionPromise = extractStreamCredentials(channel)
    .then((result) => {
      if (result) streamCache.set(channel, result)
      return result
    })
    .finally(() => {
      extractionLocks.delete(channel)
    })

  extractionLocks.set(channel, extractionPromise)
  return extractionPromise
}

// ============= Routes =============

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    channels: VALID_CHANNELS,
    cached: Array.from(streamCache.keys()),
  })
})

// Stream info endpoint
app.get("/api/radio/stream", async (req, res) => {
  const channel = req.query.channel as string

  if (!channel || !VALID_CHANNELS.includes(channel)) {
    return res.status(400).json({ error: "Invalid channel" })
  }

  const credentials = await getStreamCredentials(channel)

  if (!credentials) {
    return res.status(500).json({ error: "Failed to extract stream credentials" })
  }

  res.json({
    success: true,
    channel,
    proxyUrl: `/api/radio/proxy?channel=${channel}`,
    streamUrl: credentials.streamUrl,
    hasCookies: Object.keys(credentials.cookies).length > 0,
    cacheAge: Math.round((Date.now() - credentials.timestamp) / 1000),
  })
})

// Proxy endpoint
app.get("/api/radio/proxy", async (req, res) => {
  const channel = req.query.channel as string
  const path = req.query.path as string | undefined

  if (!channel || !VALID_CHANNELS.includes(channel)) {
    return res.status(400).json({ error: "Invalid channel" })
  }

  let credentials = await getStreamCredentials(channel)

  if (!credentials) {
    return res.status(503).json({ error: "Stream not available" })
  }

  // Build target URL
  let targetUrl: string
  if (path) {
    const baseUrl = new URL(credentials.streamUrl)
    if (path.startsWith("http")) {
      targetUrl = path
    } else {
      const basePath = baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf("/") + 1)
      targetUrl = `${baseUrl.origin}${basePath}${path}${baseUrl.search}`
    }
  } else {
    targetUrl = credentials.streamUrl
  }

  console.log(`[Proxy] Fetching: ${targetUrl}`)

  const cookieHeader = Object.entries(credentials.cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ")

  try {
    let response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Referer: `https://www.881903.com/live/${channel}`,
        Origin: "https://www.881903.com",
        Cookie: cookieHeader,
        Accept: "*/*",
      },
    })

    // Try alternate CDN if 404
    if (response.status === 404 && !path) {
      const currentHost = new URL(targetUrl).hostname
      const altHost = currentHost === "live.881903.com" ? "live2.881903.com" : "live.881903.com"
      const altUrl = targetUrl.replace(currentHost, altHost)
      console.log(`[Proxy] Trying alternate: ${altUrl}`)
      response = await fetch(altUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          Referer: `https://www.881903.com/live/${channel}`,
          Origin: "https://www.881903.com",
          Cookie: cookieHeader,
          Accept: "*/*",
        },
      })
      if (response.ok) targetUrl = altUrl
    }

    if (!response.ok) {
      console.error(`[Proxy] Upstream error: ${response.status}`)
      if (response.status === 403) {
        streamCache.delete(channel)
        console.log(`[Proxy] Cleared expired cache for ${channel}`)
      }
      return res.status(response.status).json({ error: `Stream error: ${response.status}` })
    }

    const contentType = response.headers.get("content-type") || "application/vnd.apple.mpegurl"

    // Rewrite m3u8 playlists
    if (contentType.includes("mpegurl") || targetUrl.includes(".m3u8")) {
      let content = await response.text()
      const lines = content.split("\n")
      const rewritten = lines.map((line) => {
        const trimmed = line.trim()
        if (trimmed.startsWith("#") || trimmed === "") return line
        return `/api/radio/proxy?channel=${channel}&path=${encodeURIComponent(trimmed)}`
      })
      content = rewritten.join("\n")

      res.set("Content-Type", "application/vnd.apple.mpegurl")
      res.set("Access-Control-Allow-Origin", "*")
      res.set("Cache-Control", "no-cache")
      return res.send(content)
    }

    // Binary content
    const buffer = Buffer.from(await response.arrayBuffer())
    res.set("Content-Type", contentType)
    res.set("Access-Control-Allow-Origin", "*")
    res.set("Cache-Control", "public, max-age=2")
    return res.send(buffer)
  } catch (error) {
    console.error("[Proxy] Error:", error)
    return res.status(500).json({ error: "Proxy error" })
  }
})

// Manual refresh endpoint
app.post("/api/radio/refresh/:channel", async (req, res) => {
  const { channel } = req.params

  if (!VALID_CHANNELS.includes(channel)) {
    return res.status(400).json({ error: "Invalid channel" })
  }

  streamCache.delete(channel)
  const credentials = await getStreamCredentials(channel)

  if (!credentials) {
    return res.status(500).json({ error: "Failed to refresh" })
  }

  res.json({ success: true, channel, cacheAge: 0 })
})

// Prewarm all channels
app.post("/api/radio/prewarm", async (req, res) => {
  console.log("[Prewarm] Starting...")
  const results: Array<{ channel: string; success: boolean }> = []

  for (const channel of VALID_CHANNELS) {
    const credentials = await getStreamCredentials(channel)
    results.push({ channel, success: !!credentials })
  }

  res.json({ results, timestamp: new Date().toISOString() })
})

// ============= Start =============
app.listen(PORT, () => {
  console.log(`[Server] Radio proxy running on port ${PORT}`)
  console.log(`[Server] Channels: ${VALID_CHANNELS.join(", ")}`)

  // Prewarm on startup
  setTimeout(async () => {
    console.log("[Server] Prewarming all channels...")
    for (const channel of VALID_CHANNELS) {
      await getStreamCredentials(channel)
    }
  }, 2000)
})
