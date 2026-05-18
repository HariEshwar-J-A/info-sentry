/**
 * One-time recovery: bind Google OAuth to the existing Telegram/legacy User row
 * and move any data created under a duplicate Google-only User.
 *
 * Usage:
 *   GOOGLE_EMAIL=harieshwarja.official@gmail.com LEGACY_USER_ID=cmoi... npx tsx scripts/merge-google-user-into-legacy.ts
 *
 * If LEGACY_USER_ID is omitted, picks the User with the most Interest rows
 * among users that have telegramId set and no googleSub (typical bot owner).
 */
import "dotenv/config"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const email = (process.env.GOOGLE_EMAIL ?? "").trim().toLowerCase()
const legacyEnv = process.env.LEGACY_USER_ID?.trim()

async function main(): Promise<void> {
  if (!email) {
    console.error("Set GOOGLE_EMAIL to the Google account email (e.g. harieshwarja.official@gmail.com)")
    process.exit(1)
  }

  const googleUser = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  })

  if (!googleUser) {
    console.error(`No User row with email matching: ${email}`)
    process.exit(1)
  }

  if (!googleUser.googleSub) {
    console.error("That user has no googleSub — not a Google OAuth row. Aborting.")
    process.exit(1)
  }

  let legacyId = legacyEnv
  if (!legacyId) {
    const candidates = await prisma.user.findMany({
      where: { telegramId: { not: null }, googleSub: null },
      select: { id: true, _count: { select: { interests: true } } },
      orderBy: { interests: { _count: "desc" } },
      take: 5,
    })
    if (candidates.length === 0) {
      console.error(
        "No LEGACY_USER_ID and no user with telegramId set + googleSub null. Set LEGACY_USER_ID explicitly.",
      )
      process.exit(1)
    }
    legacyId = candidates[0]!.id
    console.log(
      `Using legacy user ${legacyId} (${candidates[0]!._count.interests} interests). Set LEGACY_USER_ID to override.`,
    )
  }

  const legacy = await prisma.user.findUnique({ where: { id: legacyId } })
  if (!legacy) {
    console.error(`LEGACY_USER_ID not found: ${legacyId}`)
    process.exit(1)
  }

  if (googleUser.id === legacy.id) {
    console.log("Google user and legacy user are already the same row. Nothing to do.")
    return
  }

  await prisma.$transaction(async (tx) => {
    // Resolve Interest topic conflicts: keep legacy row, drop duplicate on Google user
    const googleInterests = await tx.interest.findMany({ where: { userId: googleUser.id } })
    for (const gi of googleInterests) {
      const clash = await tx.interest.findFirst({
        where: { userId: legacy.id, topic: gi.topic },
      })
      if (clash) {
        await tx.interest.delete({ where: { id: gi.id } })
      }
    }

    await tx.interest.updateMany({
      where: { userId: googleUser.id },
      data: { userId: legacy.id },
    })

    await tx.articleInsight.updateMany({
      where: { userId: googleUser.id },
      data: { userId: legacy.id },
    })

    await tx.webChatSession.updateMany({
      where: { userId: googleUser.id },
      data: { userId: legacy.id },
    })

    await tx.notification.updateMany({
      where: { userId: googleUser.id },
      data: { userId: legacy.id },
    })

    await tx.chatMessage.updateMany({
      where: { userId: googleUser.id },
      data: { userId: legacy.id },
    })

    // Clear unique fields on the duplicate row so we can attach them to legacy
    await tx.user.update({
      where: { id: googleUser.id },
      data: { googleSub: null, email: null },
    })

    await tx.user.update({
      where: { id: legacy.id },
      data: {
        googleSub: googleUser.googleSub,
        email: googleUser.email ?? email,
        name: googleUser.name ?? legacy.username,
        picture: googleUser.picture,
      },
    })

    await tx.user.delete({ where: { id: googleUser.id } })
  })

  console.log(
    `Merged Google identity into legacy user ${legacy.id}. Sign out and sign in again so the session uses the merged account.`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
