import { z } from 'zod'
import { Prisma } from '@prisma/client'

export const money = z.number().finite().positive().max(9_999_999_999.99)
  .refine((value) => new Prisma.Decimal(value).decimalPlaces() <= 2, 'Usa un máximo de dos decimales')
export const nonNegativeMoney = z.union([z.literal(0), money])
export const stockQuantity = z.number().int().min(0).max(2_147_483_647)
export const recordId = z.string().min(1).max(128)
export const shortText = z.string().trim().min(1).max(200)
export const notesText = z.string().max(5000)
export const pagination = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
