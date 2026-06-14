import { z, ZodSchema } from 'zod'

/**
 * Parse and validate a request body against a Zod schema.
 * Returns { data } on success or a 400 Response on failure.
 */
export async function parseBody<T>(
  schema: ZodSchema<T>,
  request: Request
): Promise<{ data: T } | Response> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    return Response.json(
      { error: 'Validation failed', issues: result.error.flatten().fieldErrors },
      { status: 400 }
    )
  }
  return { data: result.data }
}

// ── Shared schemas ────────────────────────────────────────────────────────────

export const ChatBodySchema = z.object({
  message:   z.string().min(1, 'Message required').max(4000),
  history:   z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() }))
    .default([]),
  sessionId: z.string().cuid().optional(),
})

export const InterestCreateSchema = z.object({
  topic:        z.string().min(1).max(200).trim(),
  description:  z.string().max(500).optional(),
  keywords:     z.array(z.string().max(100)).max(20).optional(),
  trackNews:    z.boolean().optional(),
  trackGithub:  z.boolean().optional(),
})

export const ChannelCreateSchema = z.object({
  url:  z.string().url('Must be a valid URL').max(2000),
  name: z.string().min(1).max(200).trim(),
})

export const FeedbackBodySchema = z.object({
  articleId: z.string().optional(),
  type:      z.enum(['like', 'dislike']),
  topics:    z.array(z.string().max(200)).max(50).default([]),
})

export const PredictionPatchSchema = z.object({
  verdict:   z.enum(['CORRECT', 'INCORRECT', 'PARTIAL']).optional(),
  userNotes: z.string().max(2000).optional(),
  dueDate:   z.string().datetime({ offset: true }).optional(),
})

export { z }
