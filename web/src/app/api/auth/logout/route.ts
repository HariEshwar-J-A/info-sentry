import { cookies } from 'next/headers'

export async function POST() {
  const store = await cookies()
  store.delete('is_auth')
  const appUrl = process.env.APP_URL ?? 'https://sentry.harieshwar.dev'
  return Response.redirect(`${appUrl}/login`)
}
