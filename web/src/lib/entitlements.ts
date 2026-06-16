/**
 * Entitlement resolution stub.
 *
 * During the free-tier phase, all signed-in users have access to all products.
 * When Stripe integration ships, replace this with a real subscription lookup:
 *
 *   const sub = await prisma.subscription.findFirst({
 *     where: { userId, status: { in: ['trialing', 'active'] } },
 *     include: { items: true },
 *   })
 *   if (!sub) return false
 *   return sub.items.some(i => i.productSlug === product)
 */

export type ProductSlug = 'iFeeds' | 'iGitHub' | 'iVideos' | 'iChat' | 'iSurprise'

export async function hasEntitlement(_userId: string, _product: ProductSlug): Promise<boolean> {
  return true
}
