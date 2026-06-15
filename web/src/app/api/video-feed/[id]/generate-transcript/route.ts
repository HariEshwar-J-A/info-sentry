import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/user'

export const maxDuration = 300

const execFileAsync = promisify(execFile)

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth
  const { userId } = auth

  const { id } = await params

  // Check GROQ_API_KEY
  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey) {
    return Response.json({ error: 'GROQ_API_KEY not configured' }, { status: 503 })
  }

  // Find the video, scoped to the authenticated user
  const video = await prisma.videoItem.findFirst({
    where: { id, channel: { userId } },
    include: { channel: { select: { id: true } } },
  })

  if (!video) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  // Return existing transcript if already present
  if (video.transcript) {
    return Response.json({ transcript: video.transcript })
  }

  const ytDlpPath = process.env.YT_DLP_PATH ?? '/opt/homebrew/bin/yt-dlp'
  const base = path.join(os.tmpdir(), `yt-${video.videoId}`)
  const audioPath = `${base}.mp3`

  try {
    // Download audio via yt-dlp
    try {
      await execFileAsync(
        ytDlpPath,
        [
          '-x',
          '--audio-format', 'mp3',
          '--audio-quality', '7',
          '--max-filesize', '24M',
          '-o', `${base}.%(ext)s`,
          '--no-playlist',
          '--quiet',
          video.url,
        ],
        { timeout: 150_000 },
      )
    } catch (err) {
      console.error('yt-dlp error:', err)
      return Response.json({ error: 'Failed to download audio' }, { status: 422 })
    }

    // Read audio file
    const audioBuffer = fs.readFileSync(audioPath)
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' })

    // Send to Groq Whisper
    const formData = new FormData()
    formData.append('file', audioBlob, 'audio.mp3')
    formData.append('model', 'whisper-large-v3-turbo')
    formData.append('response_format', 'text')

    const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
      },
      body: formData,
    })

    if (!groqRes.ok) {
      const errText = await groqRes.text()
      console.error('Groq Whisper error:', groqRes.status, errText)
      return Response.json({ error: 'Transcription service error' }, { status: 502 })
    }

    const transcript = await groqRes.text()

    // Save to DB
    await prisma.videoItem.update({
      where: { id },
      data: { transcript },
    })

    return Response.json({ transcript })
  } finally {
    // Clean up temp file
    if (fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath)
    }
  }
}
