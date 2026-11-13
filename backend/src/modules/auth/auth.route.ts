import type { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/db'
import bcrypt from 'bcrypt'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(1024),
})

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/login — no requiere token
  app.post('/login', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, reply) => {
    const body = loginSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Correo y contraseña requeridos' })
    const { email, password } = body.data
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return reply.code(401).send({ error: 'Credenciales inválidas' })
    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) return reply.code(401).send({ error: 'Credenciales inválidas' })
    const token = app.jwt.sign({ sub: user.id, name: user.name, email: user.email })
    return { token, user: { id: user.id, name: user.name, email: user.email } }
  })

  app.get('/me', {
    preHandler: async (req, reply) => {
      try {
        await req.jwtVerify()
      } catch {
        return reply.code(401).send({ error: 'No autorizado' })
      }
    },
  }, async (req, reply) => {
    const payload = req.user as { sub: string }
    if (typeof payload?.sub !== 'string' || !payload.sub || payload.sub.length > 128) return reply.code(401).send({ error: 'No autorizado' })
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, createdAt: true },
    })
    if (!user) return reply.code(401).send({ error: 'No autorizado' })
    return user
  })
}
