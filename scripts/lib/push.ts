/**
 * push.ts — Sends web push notifications from pipeline scripts.
 * Uses web-push directly (no HTTP round-trip to the web server).
 */
import 'dotenv/config'
import webpush from 'web-push'
import type { PrismaClient } from '@prisma/client'

const VAPID_PUBLIC  = process.env['VAPID_PUBLIC_KEY']  ?? ''
const VAPID_PRIVATE = process.env['VAPID_PRIVATE_KEY'] ?? ''
const VAPID_EMAIL   = process.env['VAPID_EMAIL']        ?? 'mailto:admin@example.com'

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE)
}

export interface NotifyPayload {
  title: string
  body: string
  tag?: string
  requireInteraction?: boolean
  data?: Record<string, unknown>
}

/**
 * Create a Notification record in the DB and send a web push to the user's devices.
 */
export async function notifyUser(
  db: PrismaClient,
  userId: string,
  type: string,
  payload: NotifyPayload,
  extraData?: Record<string, unknown>,
): Promise<string | null> {
  const data = { type, ...extraData }

  // Create DB notification
  let notifId: string | null = null
  try {
    const notif = await db.notification.create({
      data: {
        userId,
        type: type as Parameters<typeof db.notification.create>[0]['data']['type'],
        title: payload.title,
        body: payload.body,
        data,
      },
    })
    notifId = notif.id
  } catch (err) {
    console.warn('[push] DB notification create failed:', (err as Error).message)
  }

  // Send web push if VAPID configured
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return notifId

  try {
    const subs = await db.pushSubscription.findMany({ where: { userId } })
    const pushPayload = JSON.stringify({
      ...payload,
      data: { ...data, notificationId: notifId },
    })

    await Promise.allSettled(
      subs.map(async sub => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            pushPayload,
          )
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode
          if (status === 404 || status === 410) {
            await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
          }
        }
      })
    )
  } catch (err) {
    console.warn('[push] Web push failed:', (err as Error).message)
  }

  return notifId
}
