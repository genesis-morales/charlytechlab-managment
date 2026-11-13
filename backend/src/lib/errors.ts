import type { FastifyInstance } from 'fastify'

export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message)
  }
}

export function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code) : undefined
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, req, reply) => {
    if (error instanceof AppError) return reply.code(error.statusCode).send({ error: error.message })
    const code = errorCode(error)
    if (code === 'P2002') return reply.code(409).send({ error: 'El registro ya existe o la operación ya fue procesada' })
    if (code === 'P2003' || code === 'P2025') return reply.code(409).send({ error: 'La operación hace referencia a un registro no disponible' })
    if (code === 'P2034') return reply.code(409).send({ error: 'Otra operación modificó los datos. Intenta nuevamente' })
    const status = typeof error === 'object' && error !== null && 'statusCode' in error ? Number(error.statusCode) : 500
    if (status === 429) return reply.code(429).send({ error: 'Demasiadas solicitudes. Intenta más tarde' })
    if (status === 413) return reply.code(413).send({ error: 'La solicitud supera el tamaño permitido' })
    if (status === 400) return reply.code(400).send({ error: 'Solicitud inválida' })
    // Prisma messages and arbitrary exception text can include credentials or personal data.
    req.log.error({ code: code ?? 'INTERNAL_ERROR', requestId: req.id, route: req.routeOptions.url }, 'Operación fallida')
    return reply.code(500).send({ error: 'No se pudo completar la operación' })
  })
}
