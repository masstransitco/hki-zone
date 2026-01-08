import { NextRequest, NextResponse } from "next/server"
import { getStreamCredentials } from "../stream/route"
import { writeToKV } from "@/lib/cloudflare-kv"

const CHANNELS = ["881", "903", "864"]
const COOKIE_VALIDITY_MS = 60 * 60 * 1000 // 1 hour

interface PrewarmResult {
  channel: string
  success: boolean
  kvWrite: boolean
  error?: string
  cookieAge?: number
}

export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  // Allow access with bearer token or Vercel cron
  const isVercelCron = request.headers.get("x-vercel-cron") === "1"
  const hasValidToken = authHeader === `Bearer ${cronSecret}`

  if (!isVercelCron && !hasValidToken && cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  console.log("[Prewarm] Starting cookie prewarm for all channels")
  const startTime = Date.now()
  const results: PrewarmResult[] = []

  for (const channel of CHANNELS) {
    try {
      console.log(`[Prewarm] Extracting cookies for channel ${channel}`)

      const credentials = await getStreamCredentials(channel)

      if (!credentials) {
        results.push({
          channel,
          success: false,
          kvWrite: false,
          error: "Failed to extract credentials",
        })
        continue
      }

      // Check if we have the required CloudFront cookies
      const hasRequiredCookies =
        credentials.cookies["CloudFront-Policy"] &&
        credentials.cookies["CloudFront-Signature"] &&
        credentials.cookies["CloudFront-Key-Pair-Id"]

      if (!hasRequiredCookies) {
        results.push({
          channel,
          success: false,
          kvWrite: false,
          error: "Missing required CloudFront cookies",
        })
        continue
      }

      // Write to Cloudflare KV
      const kvData = {
        cookies: credentials.cookies,
        cookieDomain: credentials.cookieDomain,
        expiresAt: credentials.timestamp + COOKIE_VALIDITY_MS,
        updatedAt: credentials.timestamp,
        streamUrl: credentials.streamUrl,
      }

      const kvSuccess = await writeToKV(channel, kvData)

      results.push({
        channel,
        success: true,
        kvWrite: kvSuccess,
        cookieAge: Math.round((Date.now() - credentials.timestamp) / 1000),
      })

      console.log(
        `[Prewarm] Channel ${channel}: extracted (age: ${Math.round((Date.now() - credentials.timestamp) / 1000)}s), KV: ${kvSuccess}`
      )
    } catch (error) {
      console.error(`[Prewarm] Error for channel ${channel}:`, error)
      results.push({
        channel,
        success: false,
        kvWrite: false,
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  const duration = Date.now() - startTime
  const allSuccess = results.every((r) => r.success && r.kvWrite)

  console.log(`[Prewarm] Completed in ${duration}ms. All success: ${allSuccess}`)

  return NextResponse.json({
    success: allSuccess,
    duration: duration,
    results,
    timestamp: new Date().toISOString(),
  })
}

// POST endpoint for manual trigger
export async function POST(request: NextRequest) {
  return GET(request)
}
