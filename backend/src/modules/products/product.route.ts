import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Prisma, ProductStatus, DeviceOwnerType } from '@prisma/client'
import { prisma } from '../../lib/db'
import { runOperation } from '../../lib/operation'
import { AppError } from '../../lib/errors'
import { money } from '../../lib/validation'

function toJson(val: Record<string, unknown> | undefined): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (!val) return Prisma.DbNull
  return val as Prisma.InputJsonValue
}

async function getReservationHours(db: Prisma.TransactionClient): Promise<number> {
  const cfg = await db.systemConfig.findUnique({ where: { key: 'reservation_hold_hours' } })
  const hours = cfg ? Number(cfg.value) : 48
  if (!Number.isFinite(hours) || hours <= 0 || hours > 720) throw new AppError(422, 'El plazo de reserva configurado no es válido')
  return hours
}

const createProductSchema = z.object({
  deviceId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  askingPriceCRC: money,
  displaySpecs: z.record(z.string(), z.unknown()).optional(),
})

const updateProductSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  askingPriceCRC: money.optional(),
  displaySpecs: z.record(z.string(), z.unknown()).optional(),
})

const reserveSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(7),
  email: z.string().email().optional(),
  notes: z.string().optional(),
  customerId: z.string().optional(),
})

const sellSchema = z.object({
  customerId: z.string().optional(),
  warrantyMonths: z.number().int().min(1).max(24).default(6),
})

const claimSchema = z.object({
  description: z.string().min(1),
  status: z.literal('open').default('open'),
})

export async function productRoutes(app: FastifyInstance) {
  // GET /api/products
  app.get('/', async (req) => {
    const { status, q, page = '1', limit = '20' } = req.query as Record<string, string>
    const skip = (Number(page) - 1) * Number(limit)

    const where: any = {}
    if (status) where.status = status
    if (q) where.title = { contains: q, mode: 'insensitive' }

    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
        include: {
          device: {
            select: { id: true, brand: true, model: true, deviceType: true, processor: true, ram: true, storage: true },
          },
          photos: { orderBy: { position: 'asc' }, take: 1 },
        },
      }),
    ])

    return {
      data: products,
      meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    }
  })

  // GET /api/products/:id
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        device: true,
        photos: { orderBy: { position: 'asc' } },
        reservations: { where: { isActive: true }, orderBy: { createdAt: 'desc' } },
        inquiries: { orderBy: { createdAt: 'desc' }, take: 10 },
        warranty: { include: { claims: { orderBy: { claimedAt: 'desc' } } } },
      },
    })
    if (!product) return reply.code(404).send({ error: 'Producto no encontrado' })
    return product
  })

  app.post('/', async (req, reply) => {
    const body = createProductSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    const product = await runOperation(req, async (db) => {
      const device = await db.device.findUnique({ where: { id: body.data.deviceId } })
      if (!device) throw new AppError(404, 'Equipo no encontrado')
      if (device.ownerType !== DeviceOwnerType.OWN) throw new AppError(422, 'Solo se pueden publicar equipos propios del taller')
      if (device.ownStatus === 'SOLD' || device.ownStatus === 'SCRAPPED') throw new AppError(422, 'El equipo ya no está disponible para publicar')
      return db.product.create({
        data: {
          deviceId: device.id, title: body.data.title, description: body.data.description,
          askingPriceCRC: body.data.askingPriceCRC, displaySpecs: toJson(body.data.displaySpecs),
          status: ProductStatus.COMING_SOON,
        },
      })
    })
    return reply.code(201).send(product)
  })

  app.patch<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const body = updateProductSchema.strict().safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    const updated = await runOperation(req, async (db) => {
      const existing = await db.product.findUnique({ where: { id: req.params.id } })
      if (!existing) throw new AppError(404, 'Producto no encontrado')
      if (existing.status === 'SOLD' && body.data.askingPriceCRC !== undefined &&
          !existing.askingPriceCRC.equals(body.data.askingPriceCRC)) {
        throw new AppError(422, 'No se puede cambiar el precio de una venta registrada')
      }
      const { displaySpecs, ...rest } = body.data
      return db.product.update({
        where: { id: existing.id }, data: { ...rest, ...(displaySpecs !== undefined ? { displaySpecs: toJson(displaySpecs) } : {}) },
      })
    })
    return { data: updated }
  })

  app.post<{ Params: { id: string } }>('/:id/publish', async (req) => {
    const updated = await runOperation(req, async (db) => {
      const product = await db.product.findUnique({ where: { id: req.params.id } })
      if (!product) throw new AppError(404, 'Producto no encontrado')
      if (product.status !== 'COMING_SOON') throw new AppError(422, 'Solo se puede publicar un producto en estado Próximamente')
      await db.device.update({ where: { id: product.deviceId }, data: { ownStatus: 'LISTED' } })
      return db.product.update({ where: { id: product.id }, data: { status: 'AVAILABLE', publishedAt: new Date() } })
    })
    return { data: updated }
  })

  app.post<{ Params: { id: string } }>('/:id/reserve', async (req, reply) => {
    const body = reserveSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    const reservation = await runOperation(req, async (db) => {
      const product = await db.product.findUnique({ where: { id: req.params.id } })
      if (!product) throw new AppError(404, 'Producto no encontrado')
      if (product.status !== 'AVAILABLE') throw new AppError(422, 'El producto no está disponible para reserva')
      if (body.data.customerId && !await db.customer.findUnique({ where: { id: body.data.customerId }, select: { id: true } })) {
        throw new AppError(422, 'Cliente no disponible')
      }
      const expiresAt = new Date(Date.now() + (await getReservationHours(db)) * 60 * 60 * 1000)
      const created = await db.productReservation.create({
        data: { ...body.data, productId: product.id, expiresAt },
      })
      await db.product.update({
        where: { id: product.id }, data: { status: 'RESERVED', reservedAt: new Date(), reservedUntil: expiresAt },
      })
      await db.device.update({ where: { id: product.deviceId }, data: { ownStatus: 'RESERVED' } })
      return created
    })
    return reply.code(201).send(reservation)
  })

  app.post<{ Params: { id: string } }>('/:id/cancel-reservation', async (req, reply) => {
    await runOperation(req, async (db) => {
      const product = await db.product.findUnique({ where: { id: req.params.id } })
      if (!product) throw new AppError(404, 'Producto no encontrado')
      if (product.status !== 'RESERVED') throw new AppError(422, 'El producto no está reservado')
      await db.productReservation.updateMany({
        where: { productId: product.id, isActive: true }, data: { isActive: false, cancelledAt: new Date() },
      })
      await db.device.update({ where: { id: product.deviceId }, data: { ownStatus: 'LISTED' } })
      await db.product.update({
        where: { id: product.id }, data: { status: 'AVAILABLE', reservedAt: null, reservedUntil: null },
      })
      return null
    })
    return reply.code(204).send()
  })

  app.post<{ Params: { id: string } }>('/:id/sell', async (req, reply) => {
    const body = sellSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    const updated = await runOperation(req, async (db) => {
      const product = await db.product.findUnique({ where: { id: req.params.id } })
      if (!product) throw new AppError(404, 'Producto no encontrado')
      if (product.status !== 'AVAILABLE' && product.status !== 'RESERVED') throw new AppError(422, 'El producto no está disponible para venta')
      const now = new Date()
      const expiresAt = new Date(now)
      expiresAt.setMonth(expiresAt.getMonth() + body.data.warrantyMonths)
      await db.product.update({
        where: { id: product.id }, data: { status: 'SOLD', soldAt: now, reservedAt: null, reservedUntil: null },
      })
      await db.productReservation.updateMany({
        where: { productId: product.id, isActive: true }, data: { isActive: false, cancelledAt: now },
      })
      await db.warranty.create({
        data: { productId: product.id, customerId: body.data.customerId, startsAt: now, expiresAt },
      })
      await db.device.update({ where: { id: product.deviceId }, data: { ownStatus: 'SOLD' } })
      return db.product.findUnique({ where: { id: product.id }, include: { warranty: true } })
    })
    return { data: updated }
  })

  // GET /api/products/:id/warranty
  app.get<{ Params: { id: string } }>('/:id/warranty', async (req, reply) => {
    const warranty = await prisma.warranty.findUnique({
      where: { productId: req.params.id },
      include: { claims: { orderBy: { claimedAt: 'desc' } } },
    })
    if (!warranty) return reply.code(404).send({ error: 'Garantía no encontrada' })
    return warranty
  })

  app.post<{ Params: { id: string } }>('/:id/warranty/claims', async (req, reply) => {
    const body = claimSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    const claim = await runOperation(req, async (db) => {
      const warranty = await db.warranty.findUnique({ where: { productId: req.params.id } })
      if (!warranty) throw new AppError(404, 'Garantía no encontrada')
      if (!warranty.isActive || warranty.expiresAt <= new Date()) throw new AppError(422, 'La garantía no está vigente')
      return db.warrantyClaim.create({
        data: { warrantyId: warranty.id, description: body.data.description, status: body.data.status },
      })
    })
    return reply.code(201).send(claim)
  })
}
