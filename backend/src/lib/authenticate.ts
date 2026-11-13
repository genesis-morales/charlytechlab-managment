import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from './db'

export async function authenticate(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify()
  } catch {
    return reply.code(401).send({ error: 'No autorizado' })
  }
  const userId = (req.user as { sub?: unknown })?.sub
  if (typeof userId !== 'string' || !userId || userId.length > 128) {
    return reply.code(401).send({ error: 'No autorizado' })
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
  if (!user) return reply.code(401).send({ error: 'No autorizado' })
}
