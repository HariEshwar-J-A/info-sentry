import { NextRequest } from 'next/server'
import { requireUserId }  from '@/lib/user'
import { prisma }         from '@/lib/prisma'
import { Prisma }         from '@prisma/client'

type Params = { params: Promise<{ product: string }> }

const VALID_PRODUCTS = ['global', 'iFeeds', 'iGitHub', 'iVideos', 'iChat', 'iSurprise']

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth

  const { product } = await params
  if (!VALID_PRODUCTS.includes(product)) {
    return Response.json({ error: 'Unknown product' }, { status: 400 })
  }

  const row = await prisma.userSettings.findUnique({
    where: { userId_product: { userId: auth.userId, product } },
  })

  return Response.json({ data: row?.data ?? {} })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireUserId()
  if (auth instanceof Response) return auth

  const { product } = await params
  if (!VALID_PRODUCTS.includes(product)) {
    return Response.json({ error: 'Unknown product' }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const existing = await prisma.userSettings.findUnique({
    where: { userId_product: { userId: auth.userId, product } },
  })

  const merged = {
    ...((existing?.data as Record<string, unknown>) ?? {}),
    ...body,
  } as Prisma.InputJsonValue

  const row = await prisma.userSettings.upsert({
    where:  { userId_product: { userId: auth.userId, product } },
    create: { userId: auth.userId, product, data: merged },
    update: { data: merged },
  })

  return Response.json({ data: row.data })
}
