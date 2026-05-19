import webpush from 'web-push'
import { prisma } from './prisma'

webpush.setVapidDetails(
  process.env['VAPID_EMAIL'] ?? 'mailto:admin@example.com',
  process.env['VAPID_PUBLIC_KEY'] ?? '',
  process.env['VAPID_PRIVATE_KEY'] ?? '',
)

export interface PushPayload {
  title: string
  body: string
  tag?: string
  requireInteraction?: boolean
  data?: Record<string, unknown>
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!process.env['VAPID_PUBLIC_KEY'] || !process.env['VAPID_PRIVATE_KEY']) return

  const subs = await prisma.pushSubscription.findMany({ where: { userId } })
  if (subs.length === 0) return

  const message = JSON.stringify(payload)

  await Promise.allSettled(
    subs.map(async sub => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          message,
        )
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          // Subscription expired — remove it
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
        }
      }
    })
  )
}
