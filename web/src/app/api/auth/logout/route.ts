import { cookies } from 'next/headers'

export async function GET() {
  const store = await cookies()
  store.delete('is_auth')
  const appUrl = process.env.APP_URL ?? 'http://localhost:3001'
  return Response.redirect(`${appUrl}/login`)
}
