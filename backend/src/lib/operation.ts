import { createHash } from 'node:crypto'
import { setTimeout } from 'node:timers/promises'
import type { FastifyRequest } from 'fastify'
import { Prisma } from '@prisma/client'
import { prisma } from './db'
import { AppError, errorCode } from './errors'

export async function serializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 10000,
      })
    } catch (error) {
      if (errorCode(error) !== 'P2034') throw error
      if (attempt === 3) throw new AppError(409, 'Otra operación modificó los datos. Intenta nuevamente con la misma clave de operación')
      await setTimeout(20 * (attempt + 1) + Math.floor(Math.random() * 20))
    }
  }
  throw new AppError(409, 'No se pudo completar la operación concurrente')
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]))
  }
  return value
}

// Business writes, their audit entry and the retry receipt share the same commit.
export async function runOperation<T>(req: FastifyRequest, work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  const userId = (req.user as { sub?: string } | undefined)?.sub
  if (!userId) throw new AppError(401, 'No autorizado')
  const key = req.headers['idempotency-key']
  if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(key)) {
    throw new AppError(400, 'Se requiere un encabezado Idempotency-Key válido para esta operación')
  }
  const requestHash = createHash('sha256').update(JSON.stringify(canonical({ method: req.method, url: req.url, body: req.body ?? null }))).digest('hex')
  const execute = () => serializable(async (tx) => {
    const previous = await tx.idempotencyRecord.findUnique({ where: { userId_key: { userId, key } } })
    if (previous) {
      if (previous.requestHash !== requestHash) throw new AppError(409, 'La clave de operación ya fue usada con otros datos')
      return previous.response as T
    }
    const result = await work(tx)
    const response = JSON.parse(JSON.stringify(result ?? null)) as Prisma.InputJsonValue
    const resultId = typeof result === 'object' && result !== null && 'id' in result ? String(result.id) : undefined
    const params = req.params as { id?: string } | undefined
    await tx.auditLog.create({ data: {
      action: `${req.method} ${req.routeOptions.url}`,
      entity: req.routeOptions.url?.split('/')[2] ?? 'Operation',
      entityId: resultId ?? params?.id ?? key,
      userId,
      data: { requestHash },
    } })
    await tx.idempotencyRecord.create({ data: {
      userId, key, requestHash, response: response === null ? Prisma.JsonNull : response,
    } })
    return response as T
  })
  try {
    return await execute()
  } catch (error) {
    // A simultaneous retry may win the unique key while this transaction rolls back.
    if (errorCode(error) !== 'P2002') throw error
    const previous = await prisma.idempotencyRecord.findUnique({ where: { userId_key: { userId, key } } })
    if (!previous) throw error
    if (previous.requestHash !== requestHash) throw new AppError(409, 'La clave de operación ya fue usada con otros datos')
    return previous.response as T
  }
}
