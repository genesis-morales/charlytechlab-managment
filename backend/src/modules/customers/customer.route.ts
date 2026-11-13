import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/db'

// ---- Schemas de validacion ----

const createSchema = z.object({
  name: z.string().min(2, 'Nombre requerido'),
  phone: z.string().min(7, 'Teléfono inválido'),
  email: z.string().email('Correo inválido').optional().or(z.literal('')),
  address: z.string().optional(),
  notes: z.string().optional(),
})

const updateSchema = createSchema.partial().extend({
  isActive: z.boolean().optional(),
})

const listSchema = z.object({
  q: z.string().optional(),        // busqueda por nombre, teléfono, correo
  active: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// ---- Helper: detectar duplicados ----

async function findPotentialDuplicates(phone: string, email?: string, excludeId?: string) {
  const where: any = {
    OR: [{ phone }],
    ...(excludeId ? { id: { not: excludeId } } : {}),
  }
  if (email) where.OR.push({ email })
  return prisma.customer.findMany({
    where,
    select: { id: true, name: true, phone: true, email: true },
  })
}

export async function customerRoutes(app: FastifyInstance) {
  // GET /api/customers — lista paginada con busqueda
  app.get('/', async (req, reply) => {
    const query = listSchema.safeParse(req.query)
    if (!query.success) return reply.code(400).send({ error: query.error.flatten() })
    const { q, active, page, limit } = query.data

    const where: any = {}
    if (active !== undefined) where.isActive = active === 'true'
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        { email: { contains: q, mode: 'insensitive' } },
      ]
    }

    const [total, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          address: true,
          isActive: true,
          createdAt: true,
          _count: {
            select: {
              workOrders: true,
              quotes: true,
            },
          },
        },
      }),
    ])

    return { data: customers, meta: { total, page, limit, pages: Math.ceil(total / limit) } }
  })

  // GET /api/customers/:id — ficha completa con historial
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        workOrders: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            number: true,
            createdAt: true,
            devices: {
              select: {
                status: true,
                device: { select: { brand: true, model: true, deviceType: true } },
              },
            },
          },
        },
        quotes: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            number: true,
            status: true,
            total: true,
            createdAt: true,
          },
        },
        warranties: {
          orderBy: { startsAt: 'desc' },
          take: 10,
          select: {
            id: true,
            startsAt: true,
            expiresAt: true,
            isActive: true,
            product: { select: { title: true } },
          },
        },
      },
    })

    if (!customer) return reply.code(404).send({ error: 'Cliente no encontrado' })
    return customer
  })

  // POST /api/customers — crear cliente con advertencia de duplicados
  app.post('/', async (req, reply) => {
    const body = createSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { name, phone, email, address, notes } = body.data
    const cleanEmail = email === '' ? undefined : email

    const duplicates = await findPotentialDuplicates(phone, cleanEmail)

    const customer = await prisma.customer.create({
      data: { name, phone, email: cleanEmail, address, notes },
    })

    // 201 normal, 207 si se creó pero se detectaron posibles duplicados
    const status = duplicates.length > 0 ? 207 : 201
    return reply.code(status).send({ data: customer, duplicates })
  })

  // PATCH /api/customers/:id — actualizar campos
  app.patch<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const body = updateSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { email, ...rest } = body.data
    const cleanEmail = email === '' ? null : email

    const existing = await prisma.customer.findUnique({ where: { id: req.params.id } })
    if (!existing) return reply.code(404).send({ error: 'Cliente no encontrado' })

    // Detectar duplicados sobre el nuevo teléfono/correo excluyendo este cliente
    if (rest.phone || email !== undefined) {
      const phone = rest.phone ?? existing.phone
      const emailCheck = cleanEmail ?? existing.email ?? undefined
      const duplicates = await findPotentialDuplicates(phone, emailCheck, req.params.id)
      if (duplicates.length > 0) {
        // Advertencia no bloqueante — solo se informa, igual se actualiza
        const updated = await prisma.customer.update({
          where: { id: req.params.id },
          data: { ...rest, ...(email !== undefined ? { email: cleanEmail } : {}) },
        })
        return reply.code(207).send({ data: updated, duplicates })
      }
    }

    const updated = await prisma.customer.update({
      where: { id: req.params.id },
      data: { ...rest, ...(email !== undefined ? { email: cleanEmail } : {}) },
    })
    return { data: updated }
  })

  // DELETE /api/customers/:id — solo desactiva (soft delete)
  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const existing = await prisma.customer.findUnique({ where: { id: req.params.id } })
    if (!existing) return reply.code(404).send({ error: 'Cliente no encontrado' })

    await prisma.customer.update({
      where: { id: req.params.id },
      data: { isActive: false },
    })
    return reply.code(204).send()
  })

  // GET /api/customers/check-duplicate — consulta rápida sin crear
  app.get('/check-duplicate', async (req, reply) => {
    const { phone, email } = req.query as { phone?: string; email?: string }
    if (!phone && !email) return reply.code(400).send({ error: 'Se requiere phone o email' })
    const duplicates = await findPotentialDuplicates(phone ?? '', email)
    return { duplicates }
  })
}
