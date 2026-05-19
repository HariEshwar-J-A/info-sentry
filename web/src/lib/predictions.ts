import type { Prisma } from '@prisma/client'

/**
 * Restrict predictions to those visible to a given user:
 * - AI-generated: scoped through article → source → interest chain
 * - User-defined: directly owned (prediction.userId === userId)
 */
export function predictionVisibilityWhere(userId: string): Prisma.PredictionWhereInput {
  return {
    OR: [
      {
        isUserDefined: false,
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
      },
      {
        isUserDefined: true,
        userId,
      },
    ],
  }
}
