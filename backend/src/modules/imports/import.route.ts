import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Prisma, ImportShipmentStatus } from '@prisma/client'
import { prisma } from '../../lib/db'

// ============================================================
// Importaciones y casillero
// Seguimiento logistico eBay -> casillero -> CR
// Distribucion de costos compartidos entre repuestos.
// ============================================================

// ---- Estados del envio ----
export const SHIPMENT_STATUS_LABELS: Record<ImportShipmentStatus, string> = {
  PENDING: 'Pendiente',
  PURCHASED: 'Comprado',
  RECEIVED_IN_MAILBOX: 'En casillero (US)',
  IN_TRANSIT: 'En tránsito',
  IN_CUSTOMS: 'En aduana',
  RECEIVED_IN_CR: 'Recibido en CR',
  DELIVERED: 'Entregado',
}

// Transiciones validas del envio
const SHIPMENT_TRANSITIONS: Record<ImportShipmentStatus, ImportShipmentStatus[]> = {
  PENDING: ['PURCHASED', 'CANCELLED' as ImportShipmentStatus].filter(Boolean) as ImportShipmentStatus[],
  PURCHASED: ['RECEIVED_IN_MAILBOX', 'IN_TRANSIT', 'CANCELLED' as ImportShipmentStatus].filter(Boolean) as ImportShipmentStatus[],
  RECEIVED_IN_MAILBOX: ['IN_TRANSIT'],
  IN_TRANSIT: ['IN_CUSTOMS', 'RECEIVED_IN_CR'],
  IN_CUSTOMS: ['RECEIVED_IN_CR'],
  RECEIVED_IN_CR: ['DELIVERED'],
  DELIVERED: [],
}

function isValidShipmentTransition(from: ImportShipmentStatus, to: ImportShipmentStatus): boolean {
  return SHIPMENT_TRANSITIONS[from]?.includes(to) ?? false
}

// ---- Schemas ----

const createShipmentSchema = z.object({
  trackingNumber: z.string().optional(),
  origin: z.string().optional(),
  notes: z.string().optional(),
  purchasedAt: z.string().datetime().optional(),
  estimatedArrival: z.string().datetime().optional(),
})

const updateShipmentSchema = z.object({
  trackingNumber: z.string().optional(),
  origin: z.string().optional(),
  notes: z.string().optional(),
  weightLbs: z.number().positive().optional(),
  shippingCRC: z.number().min(0).optional(),
  customsCRC: z.number().min(0).optional(),
  handlingCRC: z.number().min(0).optional(),
  estimatedArrival: z.string().datetime().optional(),
})

const transitionSchema = z.object({
  toStatus: z.nativeEnum(ImportShipmentStatus),
  notes: z.string().optional(),
})

const itemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().int().positive(),
  pricePaidCRC: z.number().min(0),
})

// ---- Helper: calcular y distribuir costos ----
// Regla del spec: tarifa configurable ($6/lb + ₡750 + ₡2.500)
// Aqui distribuimos los costos compartidos proporcionalmente al precio pagado.
async function distributeCosts(shipmentId: string) {
  const shipment = await prisma.importShipment.findUnique({
    where: { id: shipmentId },
    include: { items: true },
  })
  if (!shipment || shipment.items.length === 0) return

  // Calcular costo total de importacion
  const shipping = shipment.shippingCRC ?? new Prisma.Decimal(0)
  const customs = shipment.customsCRC ?? new Prisma.Decimal(0)
  const handling = shipment.handlingCRC ?? new Prisma.Decimal(0)
  const totalImportCost = shipping.add(customs).add(handling)

  // Suma total de precios pagados (base de prorrateo)
  const totalPaid = shipment.items.reduce(
    (acc, i) => acc.add(i.pricePaidCRC), new Prisma.Decimal(0),
  )
  if (totalPaid.lte(0)) return

  // Calcular costo total del envio (import + items)
  const itemsTotal = totalPaid
  const grandTotal = itemsTotal.add(totalImportCost)

  // Distribuir el costo de importacion proporcionalmente
  await prisma.$transaction([
    ...shipment.items.map((item) =>
      prisma.importShipmentItem.update({
        where: { id: item.id },
        data: {
          // allocatedCost = (item.price / totalPaid) * totalImportCost
          allocatedCostCRC: new Prisma.Decimal(item.pricePaidCRC)
            .mul(totalImportCost)
            .div(totalPaid),
        },
      }),
    ),
    prisma.importShipment.update({
      where: { id: shipmentId },
      data: { totalCostCRC: grandTotal },
    }),
  ])
}

export async function importRoutes(app: FastifyInstance) {
  // ========================
  // ENVIOS
  // ========================

  // GET /api/imports — lista de envios
  app.get('/', async (req) => {
    const { status, q, page = '1', limit = '20' } = req.query as Record<string, string>
    const skip = (Number(page) - 1) * Number(limit)

    const where: any = {}
    if (status) where.status = status
    if (q) {
      where.OR = [
        { trackingNumber: { contains: q, mode: 'insensitive' } },
        { origin: { contains: q, mode: 'insensitive' } },
      ]
    }

    const [total, shipments] = await Promise.all([
      prisma.importShipment.count({ where }),
      prisma.importShipment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
        include: {
          _count: { select: { items: true } },
          items: { select: { id: true, description: true, quantity: true, pricePaidCRC: true, allocatedCostCRC: true } },
        },
      }),
    ])

    return {
      data: shipments,
      meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    }
  })

  // GET /api/imports/:id — envio completo
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const shipment = await prisma.importShipment.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          include: {
            purchaseItems: {
              include: {
                purchase: { select: { id: true, purchasedAt: true } },
                inventoryItem: { select: { id: true, name: true } },
              },
            },
          },
        },
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!shipment) return reply.code(404).send({ error: 'Envío no encontrado' })
    return shipment
  })

  // POST /api/imports — crear envio
  app.post('/', async (req, reply) => {
    const body = createShipmentSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const shipment = await prisma.importShipment.create({
      data: {
        trackingNumber: body.data.trackingNumber,
        origin: body.data.origin,
        notes: body.data.notes,
        purchasedAt: body.data.purchasedAt ? new Date(body.data.purchasedAt) : undefined,
        estimatedArrival: body.data.estimatedArrival ? new Date(body.data.estimatedArrival) : undefined,
        statusHistory: {
          create: { toStatus: ImportShipmentStatus.PENDING, notes: 'Envío creado' },
        },
      },
    })

    return reply.code(201).send(shipment)
  })

  // PATCH /api/imports/:id — actualizar datos y costos del envio
  app.patch<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const body = updateShipmentSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const existing = await prisma.importShipment.findUnique({ where: { id: req.params.id } })
    if (!existing) return reply.code(404).send({ error: 'Envío no encontrado' })

    const { estimatedArrival, ...rest } = body.data
    await prisma.importShipment.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        estimatedArrival: estimatedArrival ? new Date(estimatedArrival) : undefined,
      },
    })

    // Recalcular distribucion de costos si cambiaron los costos
    const hasCostChange = body.data.shippingCRC !== undefined
      || body.data.customsCRC !== undefined
      || body.data.handlingCRC !== undefined
    if (hasCostChange) {
      await distributeCosts(req.params.id)
    }

    const updated = await prisma.importShipment.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    })
    return { data: updated }
  })

  // POST /api/imports/:id/transition — cambiar estado del envio
  app.post<{ Params: { id: string } }>('/:id/transition', async (req, reply) => {
    const body = transitionSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const shipment = await prisma.importShipment.findUnique({ where: { id: req.params.id } })
    if (!shipment) return reply.code(404).send({ error: 'Envío no encontrado' })

    const toStatus = body.data.toStatus
    if (!isValidShipmentTransition(shipment.status, toStatus)) {
      return reply.code(422).send({
        error: `Transición inválida: ${SHIPMENT_STATUS_LABELS[shipment.status]} → ${SHIPMENT_STATUS_LABELS[toStatus]}`,
      })
    }

    const [updated] = await prisma.$transaction([
      prisma.importShipment.update({
        where: { id: req.params.id },
        data: {
          status: toStatus,
          arrivedAt: toStatus === 'RECEIVED_IN_CR' ? new Date() : undefined,
        },
      }),
      prisma.importShipmentStatusHistory.create({
        data: {
          shipmentId: req.params.id,
          fromStatus: shipment.status,
          toStatus,
          notes: body.data.notes,
        },
      }),
    ])

    return { data: updated }
  })

  // ========================
  // ITEMS DEL ENVIO
  // ========================

  // POST /api/imports/:id/items — agregar item al envio
  app.post<{ Params: { id: string } }>('/:id/items', async (req, reply) => {
    const body = itemSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const shipment = await prisma.importShipment.findUnique({ where: { id: req.params.id } })
    if (!shipment) return reply.code(404).send({ error: 'Envío no encontrado' })

    const item = await prisma.importShipmentItem.create({
      data: {
        shipmentId: req.params.id,
        description: body.data.description,
        quantity: body.data.quantity,
        pricePaidCRC: body.data.pricePaidCRC,
      },
    })

    // Recalcular distribucion con el nuevo item
    await distributeCosts(req.params.id)

    return reply.code(201).send(item)
  })

  // DELETE /api/imports/:id/items/:itemId — quitar item
  app.delete<{ Params: { id: string; itemId: string } }>('/:id/items/:itemId', async (req, reply) => {
    const item = await prisma.importShipmentItem.findFirst({
      where: { id: req.params.itemId, shipmentId: req.params.id },
    })
    if (!item) return reply.code(404).send({ error: 'Item no encontrado' })

    await prisma.importShipmentItem.delete({ where: { id: req.params.itemId } })
    await distributeCosts(req.params.id)

    return reply.code(204).send()
  })

  // PATCH /api/imports/:id/items/:itemId — editar item
  app.patch<{ Params: { id: string; itemId: string } }>('/:id/items/:itemId', async (req, reply) => {
    const body = itemSchema.partial().safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const item = await prisma.importShipmentItem.findFirst({
      where: { id: req.params.itemId, shipmentId: req.params.id },
    })
    if (!item) return reply.code(404).send({ error: 'Item no encontrado' })

    const updated = await prisma.importShipmentItem.update({
      where: { id: req.params.itemId },
      data: {
        description: body.data.description,
        quantity: body.data.quantity,
        pricePaidCRC: body.data.pricePaidCRC,
      },
    })

    await distributeCosts(req.params.id)

    return { data: updated }
  })

  // ========================
  // RECALCULAR COSTOS
  // ========================

  // POST /api/imports/:id/recalculate — forzar recalculo de distribucion
  app.post<{ Params: { id: string } }>('/:id/recalculate', async (req, reply) => {
    const shipment = await prisma.importShipment.findUnique({ where: { id: req.params.id } })
    if (!shipment) return reply.code(404).send({ error: 'Envío no encontrado' })
    await distributeCosts(req.params.id)
    const updated = await prisma.importShipment.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    })
    return { data: updated }
  })

  // ========================
  // RESUMEN
  // ========================

  // GET /api/imports/summary — envios activos y costos pendientes
  app.get('/summary', async () => {
    const activeShipments = await prisma.importShipment.findMany({
      where: { status: { notIn: [ImportShipmentStatus.DELIVERED] } },
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const totalInTransit = activeShipments.length
    const totalItemsPending = activeShipments.reduce(
      (acc, s) => acc + s._count.items, 0,
    )

    // Costos totales en envios activos
    const costAgg = await prisma.importShipment.aggregate({
      where: { status: { notIn: [ImportShipmentStatus.DELIVERED] } },
      _sum: { shippingCRC: true, customsCRC: true, handlingCRC: true },
    })

    return {
      activeShipments,
      totalInTransit,
      totalItemsPending,
      pendingCosts: {
        shipping: costAgg._sum.shippingCRC?.toFixed(2) ?? '0.00',
        customs: costAgg._sum.customsCRC?.toFixed(2) ?? '0.00',
        handling: costAgg._sum.handlingCRC?.toFixed(2) ?? '0.00',
      },
    }
  })
}
