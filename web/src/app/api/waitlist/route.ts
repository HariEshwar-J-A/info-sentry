import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z }     from 'zod'

const VALID_PRODUCTS = ['iFeeds', 'iGitHub', 'iVideos', 'iChat', 'iSurprise']

const schema = z.object({
  email:    z.string().email(),
  products: z.array(z.string()).default([]),
})

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { email, products } = parsed.data
  const validProducts = products.filter(p => VALID_PRODUCTS.includes(p))

  await prisma.waitlistEntry.upsert({
    where:  { email },
    create: { email, products: validProducts },
    update: { products: validProducts },
  })

  return Response.json({ ok: true })
}
