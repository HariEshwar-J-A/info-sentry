import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

async function clearSession(): Promise<NextResponse> {
  const store = await cookies()
  store.delete('is_auth')
  const appUrl = process.env.APP_URL ?? 'http://localhost:3001'
  return NextResponse.redirect(`${appUrl}/`)
}

// GET — direct navigation (/api/auth/logout link)
export async function GET() { return clearSession() }

// POST — fetch() call from client JS
export async function POST() { return clearSession() }
