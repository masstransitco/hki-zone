import { NextRequest, NextResponse } from "next/server"
import { streamCache } from "../stream/route"

const COOKIE_VALIDITY_MS = 60 * 60 * 1000 // 1 hour

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const channel = searchParams.get("channel")

  if (!channel) {
    // Return all channels
    const all: Record<string, unknown> = {}
    for (const [ch, data] of streamCache.entries()) {
      all[ch] = {
        cookies: data.cookies,
        cookieDomain: data.cookieDomain,
        expiresAt: data.timestamp + COOKIE_VALIDITY_MS,
        updatedAt: data.timestamp,
        streamUrl: data.streamUrl,
      }
    }
    return NextResponse.json(all)
  }

  const data = streamCache.get(channel)
  if (!data) {
    return NextResponse.json({ error: "No cache for channel" }, { status: 404 })
  }

  return NextResponse.json({
    cookies: data.cookies,
    cookieDomain: data.cookieDomain,
    expiresAt: data.timestamp + COOKIE_VALIDITY_MS,
    updatedAt: data.timestamp,
    streamUrl: data.streamUrl,
  })
}
