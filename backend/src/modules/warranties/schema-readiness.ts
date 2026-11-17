import type { PrismaClient } from '@prisma/client'
import { prisma } from '../../lib/db'
import { AppError } from '../../lib/errors'

const readyClients = new WeakSet<PrismaClient>()
export async function certificateSchemaAvailable(db: PrismaClient = prisma): Promise<boolean> {
  if (readyClients.has(db)) return true
  const [result] = await db.$queryRaw<{ available: boolean }[]>`
    SELECT EXISTS (SELECT 1 FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_name = 'WarrantyCertificate')
    AND EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'Warranty' AND column_name = 'workOrderDeviceId') AS available`
  if (result.available) readyClients.add(db)
  return result.available
}
export async function requireCertificateSchema() {
  if (!await certificateSchemaAvailable()) throw new AppError(503, 'El módulo de certificados todavía no está activado')
}

// Keep existing sale workflows usable before the separately approved migration.
export const saleWarrantyFields = {
  id: true, productId: true, customerId: true, startsAt: true, expiresAt: true,
  terms: true, isActive: true, createdAt: true,
} as const
