import { z } from 'zod'

export const usageStateSchema = z.enum(['used', 'unused', 'unknown'])
export const findingStatusSchema = z.enum(['open', 'in_review', 'handed_off', 'kept', 'deferred', 'justified'])
export const apiErrorSchema = z.object({ code: z.enum(['validation', 'not_found', 'conflict', 'forbidden', 'rate_limited', 'unavailable', 'unknown']), message: z.string(), details: z.record(z.string(), z.array(z.string())).optional() })
export const pageSchema = <T extends z.ZodTypeAny>(item: T) => z.object({ items: z.array(item), nextCursor: z.string().nullable(), total: z.number().nonnegative() })
export const decisionSchema = z.object({ findingId: z.string(), reviewerId: z.string(), decision: z.string(), reasonCode: z.string(), note: z.string().max(500), decidedAt: z.string(), evidenceHash: z.string(), explanationSnapshot: z.string() })
export const findingMutationSchema = z.object({ ownerId: z.string().optional(), dueDate: z.string().optional(), version: z.number().int().positive().optional() })
