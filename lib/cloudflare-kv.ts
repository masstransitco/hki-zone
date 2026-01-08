/**
 * Cloudflare KV Client
 * Uses the REST API to write cookies to the edge
 */

interface CookieData {
  cookies: Record<string, string>
  cookieDomain: string
  expiresAt: number
  updatedAt: number
  streamUrl: string
}

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN
const CLOUDFLARE_KV_NAMESPACE_ID = process.env.CLOUDFLARE_KV_NAMESPACE_ID

const KV_API_BASE = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}`

export async function writeToKV(key: string, data: CookieData): Promise<boolean> {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN || !CLOUDFLARE_KV_NAMESPACE_ID) {
    console.error("[KV] Missing Cloudflare credentials")
    return false
  }

  try {
    const response = await fetch(`${KV_API_BASE}/values/${key}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error(`[KV] Write failed for ${key}: ${response.status} ${error}`)
      return false
    }

    console.log(`[KV] Successfully wrote ${key} to KV`)
    return true
  } catch (error) {
    console.error(`[KV] Error writing ${key}:`, error)
    return false
  }
}

export async function readFromKV(key: string): Promise<CookieData | null> {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN || !CLOUDFLARE_KV_NAMESPACE_ID) {
    console.error("[KV] Missing Cloudflare credentials")
    return null
  }

  try {
    const response = await fetch(`${KV_API_BASE}/values/${key}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
    })

    if (response.status === 404) {
      return null
    }

    if (!response.ok) {
      const error = await response.text()
      console.error(`[KV] Read failed for ${key}: ${response.status} ${error}`)
      return null
    }

    return (await response.json()) as CookieData
  } catch (error) {
    console.error(`[KV] Error reading ${key}:`, error)
    return null
  }
}

export async function listKVKeys(): Promise<string[]> {
  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN || !CLOUDFLARE_KV_NAMESPACE_ID) {
    return []
  }

  try {
    const response = await fetch(`${KV_API_BASE}/keys`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
    })

    if (!response.ok) {
      return []
    }

    const data = (await response.json()) as { result: { name: string }[] }
    return data.result.map((k) => k.name)
  } catch {
    return []
  }
}
