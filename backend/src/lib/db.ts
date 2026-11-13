import { PrismaClient } from '@prisma/client'
import { config } from './config'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Central error handling logs only safe metadata, never SQL or Prisma invocation data.
    log: [],
  })

if (config.isDev) globalForPrisma.prisma = prisma
