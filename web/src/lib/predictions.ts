import type { Prisma } from '@prisma/client'

/**
 * Restrict predictions to content connected to a user's active interests.
 * This keeps predictions de-duplicated globally while exposing user-specific subsets.
 */
export function predictionVisibilityWhere(userId: string): Prisma.PredictionWhereInput {
  return {
    article: {
      source: {
        interests: {
          some: {
            interest: {
              userId,
              isActive: true,
            },
          },
        },
      },
    },
  }
}
