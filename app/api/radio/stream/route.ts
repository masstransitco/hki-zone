import { NextRequest, NextResponse } from "next/server"
import { chromium, Browser, BrowserContext } from "playwright"

// Cache for stream credentials (cookies + stream URL)
interface StreamCache {
  streamUrl: string
  cookies: Record<string, string>
  headers: Record<string, string>
  cookieDomain: string // Track which CDN domain the cookies are for
  timestamp: number
  channel: string
}

// In-memory cache - persists across requests
const streamCache: Map<string, StreamCache> = new Map()
const CACHE_TTL_MS = 45 * 60 * 1000 // 45 minutes (cookies last ~1 hour)

// Valid channels
const VALID_CHANNELS = ["881", "903", "864"]

// Lock to prevent concurrent extractions for the same channel
const extractionLocks: Map<string, Promise<StreamCache | null>> = new Map()

async function extractStreamCredentials(channel: string): Promise<StreamCache | null> {
  console.log(`[Radio] Starting extraction for channel ${channel}`)

  let browser: Browser | null = null
  let context: BrowserContext | null = null

  try {
    // Launch browser with stealth settings
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    })

    context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 720 },
      locale: "en-HK",
    })

    const page = await context.newPage()

    // Capture network requests to find the stream URL AND the request headers
    let streamUrl: string | null = null
    let streamHeaders: Record<string, string> = {}

    page.on("request", (request) => {
      const url = request.url()
      // Look for the playlist.m3u8 request or any request to live.881903.com
      if (url.includes("live.881903.com")) {
        console.log(`[Radio] Request to live CDN: ${url.substring(0, 150)}`)

        // Capture headers from this request
        const headers = request.headers()
        if (headers.cookie) {
          console.log(`[Radio] Request cookies: ${headers.cookie.substring(0, 100)}...`)
        }

        if (url.includes("playlist.m3u8") || url.includes(".m3u8")) {
          streamUrl = url
          streamHeaders = headers
          console.log(`[Radio] Found stream URL: ${url}`)
        }
      }
    })

    // Also capture response to see if there are any redirects or auth info
    page.on("response", async (response) => {
      const url = response.url()
      if (url.includes("live.881903.com")) {
        const status = response.status()
        console.log(`[Radio] Response from ${url.substring(0, 80)}...: ${status}`)

        // Check for Set-Cookie headers
        const headers = response.headers()
        if (headers["set-cookie"]) {
          console.log(`[Radio] Set-Cookie header found!`)
        }
      }
    })

    // Navigate to the live stream page
    const liveUrl = `https://www.881903.com/live/${channel}`
    console.log(`[Radio] Navigating to ${liveUrl}`)

    // Use domcontentloaded instead of networkidle - the page has lots of dynamic content
    await page.goto(liveUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    })

    // Wait for the page to fully load the player
    await page.waitForTimeout(3000)

    // Look for player elements and try to trigger playback
    console.log("[Radio] Looking for player controls...")

    // Try multiple selectors for the play button
    const playSelectors = [
      'button[class*="play"]',
      '[class*="play-btn"]',
      '[class*="PlayButton"]',
      '[aria-label*="play" i]',
      '[data-testid*="play" i]',
      '.fp-playbtn',  // Flowplayer
      '.fp-play',
      'button:has-text("Play")',
      '.vjs-play-control',  // Video.js
    ]

    for (const selector of playSelectors) {
      try {
        const playButton = page.locator(selector).first()
        if (await playButton.isVisible({ timeout: 1000 })) {
          console.log(`[Radio] Found play button with selector: ${selector}`)
          await playButton.click({ timeout: 3000 })
          await page.waitForTimeout(2000)
          if (streamUrl) break
        }
      } catch {
        // Try next selector
      }
    }

    // Wait for stream URL to be captured
    if (!streamUrl) {
      console.log("[Radio] Waiting for stream URL to appear...")
      await page.waitForTimeout(3000)
    }

    // Try to extract playlist URL with authentication from page JavaScript
    if (!streamUrl) {
      const playlistInfo = await page.evaluate(() => {
        // Look for Flowplayer or similar player configuration
        // @ts-ignore
        const fp = window.flowplayer?.instances?.[0]
        if (fp) {
          console.log("Found Flowplayer instance")
          // @ts-ignore
          return fp.conf?.clip?.sources?.[0]?.src
        }

        // Look for any global config containing stream URLs
        // @ts-ignore
        const crConfig = window.__CR_CONFIG__ || window.CR_CONFIG || window.radioConfig
        if (crConfig) {
          return JSON.stringify(crConfig)
        }

        // Search for playlist URL in page scripts
        const allScripts = Array.from(document.querySelectorAll("script"))
        for (const script of allScripts) {
          const content = script.textContent || script.innerHTML || ""
          // Look for playlist.881903.com URL
          const playlistMatch = content.match(/https:\/\/playlist\.881903\.com[^"'\s]+/i)
          if (playlistMatch) {
            return playlistMatch[0]
          }
          // Look for live.881903.com URL
          const liveMatch = content.match(/https:\/\/live\.881903\.com[^"'\s]+\.m3u8[^"'\s]*/i)
          if (liveMatch) {
            return liveMatch[0]
          }
        }

        return null
      })

      if (playlistInfo) {
        console.log(`[Radio] Found playlist info from JS: ${playlistInfo}`)
        if (playlistInfo.includes(".m3u8")) {
          streamUrl = playlistInfo
        }
      }
    }

    // Get cookies from the browser context - check all domains
    const cookies = await context.cookies()
    const cloudFrontCookies: Record<string, string> = {}
    let cookieDomain = "live.881903.com" // default

    console.log(`[Radio] Total cookies found: ${cookies.length}`)
    for (const cookie of cookies) {
      console.log(`[Radio] Cookie: ${cookie.name} (domain: ${cookie.domain})`)
      if (cookie.name.startsWith("CloudFront-")) {
        cloudFrontCookies[cookie.name] = cookie.value
        // Extract the CDN domain from the cookie
        if (cookie.domain.includes("881903.com")) {
          cookieDomain = cookie.domain.replace(/^\./, "") // Remove leading dot
          console.log(`[Radio] Found CloudFront cookie: ${cookie.name} (domain: ${cookieDomain})`)
        }
      }
    }

    // Also try to get cookies from both potential CDN domains
    for (const domain of ["https://live.881903.com", "https://live2.881903.com"]) {
      const liveCookies = await context.cookies(domain)
      console.log(`[Radio] Cookies from ${domain}: ${liveCookies.length}`)
      for (const cookie of liveCookies) {
        if (cookie.name.startsWith("CloudFront-") && !cloudFrontCookies[cookie.name]) {
          cloudFrontCookies[cookie.name] = cookie.value
          cookieDomain = new URL(domain).hostname
          console.log(`[Radio] Found CloudFront cookie from ${cookieDomain}: ${cookie.name}`)
        }
      }
    }

    // Also check for cookies in localStorage or page state
    if (!streamUrl) {
      // Try to extract from page JavaScript
      streamUrl = await page.evaluate(() => {
        // Look for stream URL in various places
        const scripts = Array.from(document.scripts)
        for (const script of scripts) {
          const content = script.textContent || ""
          const match = content.match(/https:\/\/live\.881903\.com[^"'\s]+playlist\.m3u8[^"'\s]*/i)
          if (match) return match[0]
        }
        return null
      })
    }

    if (!streamUrl) {
      // Construct fallback URL pattern - use the domain that matches the cookies
      // Note: 864 uses "sd" quality suffix, others use "hd"
      const qualitySuffix = channel === "864" ? "sd" : "hd"
      streamUrl = `https://${cookieDomain}/edge-aac/${channel}${qualitySuffix}/playlist.m3u8`
      console.log(`[Radio] Using fallback stream URL: ${streamUrl} (cookie domain: ${cookieDomain})`)
    }

    // Check if we got the required cookies
    const hasRequiredCookies =
      cloudFrontCookies["CloudFront-Policy"] &&
      cloudFrontCookies["CloudFront-Signature"] &&
      cloudFrontCookies["CloudFront-Key-Pair-Id"]

    if (!hasRequiredCookies) {
      console.log("[Radio] Warning: Missing some CloudFront cookies")
      console.log("[Radio] Available cookies:", Object.keys(cloudFrontCookies))
    }

    const cache: StreamCache = {
      streamUrl,
      cookies: cloudFrontCookies,
      headers: streamHeaders,
      cookieDomain,
      timestamp: Date.now(),
      channel,
    }

    console.log(`[Radio] Successfully extracted credentials for channel ${channel}`)
    return cache

  } catch (error) {
    console.error(`[Radio] Error extracting stream for channel ${channel}:`, error)
    return null
  } finally {
    if (context) await context.close().catch(() => {})
    if (browser) await browser.close().catch(() => {})
  }
}

async function getStreamCredentials(channel: string): Promise<StreamCache | null> {
  // Check cache first
  const cached = streamCache.get(channel)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`[Radio] Using cached credentials for channel ${channel} (age: ${Math.round((Date.now() - cached.timestamp) / 1000)}s)`)
    return cached
  }

  // Check if extraction is already in progress
  const existingLock = extractionLocks.get(channel)
  if (existingLock) {
    console.log(`[Radio] Waiting for existing extraction for channel ${channel}`)
    return existingLock
  }

  // Start new extraction with lock
  const extractionPromise = extractStreamCredentials(channel)
    .then((result) => {
      if (result) {
        streamCache.set(channel, result)
      }
      return result
    })
    .finally(() => {
      extractionLocks.delete(channel)
    })

  extractionLocks.set(channel, extractionPromise)
  return extractionPromise
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const channel = searchParams.get("channel")

  if (!channel || !VALID_CHANNELS.includes(channel)) {
    return NextResponse.json(
      { error: "Invalid channel. Valid channels: 881, 903, 864" },
      { status: 400 }
    )
  }

  try {
    const credentials = await getStreamCredentials(channel)

    if (!credentials) {
      return NextResponse.json(
        { error: "Failed to extract stream credentials" },
        { status: 500 }
      )
    }

    // Return proxy URL instead of direct stream (to handle cookies)
    const proxyUrl = `/api/radio/proxy?channel=${channel}`

    return NextResponse.json({
      success: true,
      channel,
      proxyUrl,
      streamUrl: credentials.streamUrl,
      hasCookies: Object.keys(credentials.cookies).length > 0,
      cacheAge: Math.round((Date.now() - credentials.timestamp) / 1000),
      cacheTTL: Math.round(CACHE_TTL_MS / 1000),
    })

  } catch (error) {
    console.error("[Radio] Error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// Export cache for proxy route to use
export { streamCache, getStreamCredentials }
