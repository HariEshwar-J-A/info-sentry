import { NextResponse } from 'next/server'
import { requireUserId } from '@/lib/user'

// Resolves a YouTube channel URL/handle to channelId, channelName, and RSS feed URL.
// Fetches the YouTube page and extracts externalId + channel name from the HTML.
export async function POST(request: Request) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth

  const { url } = (await request.json()) as { url: string }
  if (!url?.trim()) return NextResponse.json({ error: 'url required' }, { status: 400 })

  // Normalise: handle @handle, /channel/UC..., /c/name, plain channel IDs
  let fetchUrl = url.trim()
  if (!fetchUrl.startsWith('http')) fetchUrl = `https://www.youtube.com/${fetchUrl.startsWith('@') ? fetchUrl : '@' + fetchUrl}`

  try {
    const res = await fetch(fetchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(12_000),
    })

    if (!res.ok) return NextResponse.json({ error: `YouTube returned ${res.status}` }, { status: 502 })

    const html = await res.text()

    // Extract channel ID (externalId in ytInitialData or canonical link)
    const idMatch =
      html.match(/"externalId":"(UC[^"]{20,})"/) ??
      html.match(/channel\/(UC[^"?&/]{20,})/) ??
      html.match(/canonicalBaseUrl":"\/channel\/(UC[^"]+)"/)

    const channelId = idMatch?.[1]
    if (!channelId) return NextResponse.json({ error: 'Could not extract channel ID from page. Paste the channel URL exactly as shown in your browser.' }, { status: 422 })

    // Extract channel name
    const nameMatch =
      html.match(/"author":"([^"]+)"/) ??
      html.match(/<title>([^<]+)<\/title>/) ??
      html.match(/"channelMetadataRenderer":{"title":"([^"]+)"/)

    const channelName = nameMatch?.[1]?.replace(' - YouTube', '').trim() ?? channelId

    const rssFeedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    const canonicalUrl = `https://www.youtube.com/channel/${channelId}`

    return NextResponse.json({ channelId, channelName, channelUrl: canonicalUrl, rssFeedUrl })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
