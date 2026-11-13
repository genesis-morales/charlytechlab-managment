import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Prisma, InventoryCategory, InventoryMovementType } from '@prisma/client'
import { prisma } from '../../lib/db'
import { runOperation } from '../../lib/operation'
import { AppError } from '../../lib/errors'
import { stockQuantity, nonNegativeMoney } from '../../lib/validation'

// ============================================================
// Inventario: 7 categorias, movimientos trazados, sin stock
// negativo sin justificacion (WRITE_OFF/AJUSTE pueden llevar a 0).
// ============================================================

// ---- Schemas ----

const itemSchema = z.object({
  name: z.string().min(1),
  category: z.nativeEnum(InventoryCategory),
  description: z.string().optional(),
  specs: z.record(z.string(), z.unknown()).optional(),
  sku: z.string().optional(),
  minQuantity: stockQuantity.default(0),
  costPrice: nonNegativeMoney.optional(),
  salePrice: nonNegativeMoney.optional(),
  supplierId: z.string().optional(),
  quantity: stockQuantity.default(0), // solo al crear; despues via movimientos
})

const updateItemSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  specs: z.record(z.string(), z.unknown()).optional(),
  sku: z.string().optional(),
  minQuantity: stockQuantity.optional(),
  costPrice: nonNegativeMoney.optional(),
  salePrice: nonNegativeMoney.optional(),
  supplierId: z.string().optional(),
})

const movementSchema = z.object({
  type: z.enum(['ENTRY', 'CONSUMPTION', 'SALE', 'WRITE_OFF']),
  quantity: stockQuantity.refine((value) => value > 0, 'La cantidad debe ser positiva'),
  unitCost: nonNegativeMoney.optional(),
  notes: z.string().optional(),
  // Contexto: de donde viene o a donde va
  purchaseItemId: z.string().optional(),
  workOrderDeviceId: z.string().optional(),
})

const adjustSchema = z.object({
  newQuantity: stockQuantity,
  reason: z.string().min(1),
})

// ---- Helpers ----

function toJson(val: Record<string, unknown> | undefined): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (!val) return Prisma.DbNull
  return val as Prisma.InputJsonValue
}

// Efecto en stock: +1 entra, -1 sale
const STOCK_EFFECT: Record<InventoryMovementType, number> = {
  ENTRY: 1,
  CONSUMPTION: -1,
  SALE: -1,
  ADJUSTMENT: 0, // se aplica manualmente (puede + o -)
  WRITE_OFF: -1,
}

export async function inventoryRoutes(app: FastifyInstance) {
  // ========================
  // ITEMS
  // ========================

  // GET /api/inventory — lista con filtros
  app.get('/', async (req) => {
    const { q, category, lowStock, page = '1', limit = '50' } =
      req.query as Record<string, string>
    const skip = (Number(page) - 1) * Number(limit)

    const where: any = {}
    if (category) where.category = category
    if (q) where.name = { contains: q, mode: 'insensitive' }
    if (lowStock === 'true') {
      // Stock bajo: cantidad <= minQuantity
      where.AND = [
        { minQuantity: { gt: 0 } },
        { quantity: { lte: prisma.inventoryItem.fields.minQuantity } },
      ]
    }

    const [total, items] = await Promise.all([
      prisma.inventoryItem.count({ where }),
      prisma.inventoryItem.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: Number(limit),
        include: {
          supplier: { select: { id: true, name: true } },
          _count: { select: { movements: true } },
        },
      }),
    ])

    return {
      data: items,
      meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    }
  })

  // GET /api/inventory/:id — detalle con movimientos recientes
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: req.params.id },
      include: {
        supplier: { select: { id: true, name: true } },
        movements: {
          orderBy: { createdAt: 'desc' },
          take: 30,
        },
      },
    })
    if (!item) return reply.code(404).send({ error: 'Artículo no encontrado' })
    return item
  })

  // El artículo y su movimiento inicial se guardan juntos.
  app.post('/', async (req, reply) => {
    const body = itemSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    const { quantity, specs, ...rest } = body.data
    const item = await runOperation(req, async (db) => {
      const created = await db.inventoryItem.create({ data: { ...rest, specs: toJson(specs), quantity } })
      if (quantity > 0) {
        await db.inventoryMovement.create({
          data: { inventoryItemId: created.id, type: 'ENTRY', quantity, unitCost: body.data.costPrice, notes: 'Stock inicial' },
        })
      }
      return created
    })
    return reply.code(201).send(item)
  })

  // El stock solo cambia mediante movimientos trazados.
  app.patch<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const body = updateItemSchema.strict().safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    const { specs, ...rest } = body.data
    const item = await runOperation(req, (db) => db.inventoryItem.update({
      where: { id: req.params.id },
      data: { ...rest, ...(specs !== undefined ? { specs: toJson(specs) } : {}) },
    }))
    return { data: item }
  })

  // ========================
  // MOVIMIENTOS
  // ========================

  // La lectura de stock y la salida se serializan frente a otras solicitudes.
  app.post<{ Params: { id: string } }>('/:id/movements', async (req, reply) => {
    const body = movementSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    const movement = await runOperation(req, async (db) => {
      const item = await db.inventoryItem.findUnique({ where: { id: req.params.id } })
      if (!item) throw new AppError(404, 'Artículo no encontrado')
      const { type, quantity, unitCost, notes, purchaseItemId, workOrderDeviceId } = body.data
      if (purchaseItemId) throw new AppError(422, 'Las entradas vinculadas a compras se registran desde proveedores')
      if (workOrderDeviceId && !await db.workOrderDevice.findUnique({ where: { id: workOrderDeviceId }, select: { id: true } })) {
        throw new AppError(422, 'El dispositivo de la orden no está disponible')
      }
      const effect = STOCK_EFFECT[type] * quantity
      const newStock = item.quantity + effect
      if (newStock < 0) throw new AppError(422, 'Stock insuficiente para esta salida')
      if (newStock > 2_147_483_647) throw new AppError(422, 'La cantidad supera el límite de inventario')
      const created = await db.inventoryMovement.create({
        data: { inventoryItemId: item.id, type, quantity, unitCost, notes, purchaseItemId, workOrderDeviceId },
      })
      await db.inventoryItem.update({
        where: { id: item.id },
        data: { quantity: newStock, ...(type === 'ENTRY' && unitCost !== undefined ? { costPrice: unitCost } : {}) },
      })
      return created
    })
    return reply.code(201).send(movement)
  })

  // El conteo y su justificación comparten una sola transacción.
  app.post<{ Params: { id: string } }>('/:id/adjust', async (req, reply) => {
    const body = adjustSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    const movement = await runOperation(req, async (db) => {
      const item = await db.inventoryItem.findUnique({ where: { id: req.params.id } })
      if (!item) throw new AppError(404, 'Artículo no encontrado')
      const diff = body.data.newQuantity - item.quantity
      if (!diff) throw new AppError(422, 'La cantidad nueva es igual a la actual')
      const created = await db.inventoryMovement.create({
        data: {
          inventoryItemId: item.id, type: 'ADJUSTMENT', quantity: Math.abs(diff),
          notes: `Ajuste: ${item.quantity} → ${body.data.newQuantity}. Motivo: ${body.data.reason}`,
        },
      })
      await db.inventoryItem.update({ where: { id: item.id }, data: { quantity: body.data.newQuantity } })
      return { data: created }
    })
    return movement
  })

  // GET /api/inventory/:id/movements — historial completo
  app.get<{ Params: { id: string } }>('/:id/movements', async (req, reply) => {
    const movements = await prisma.inventoryMovement.findMany({
      where: { inventoryItemId: req.params.id },
      orderBy: { createdAt: 'desc' },
    })
    return { data: movements }
  })

  // ========================
  // ALERTAS Y RESUMEN
  // ========================

  // GET /api/inventory/low-stock — articulos con stock bajo
  app.get('/low-stock', async () => {
    const items = await prisma.inventoryItem.findMany({
      where: {
        minQuantity: { gt: 0 },
        quantity: { lte: prisma.inventoryItem.fields.minQuantity },
      },
      orderBy: { quantity: 'asc' },
      select: {
        id: true, name: true, category: true,
        quantity: true, minQuantity: true,
        salePrice: true,
      },
    })
    return { data: items }
  })

  // GET /api/inventory/summary — valor del inventario
  app.get('/summary', async () => {
    const items = await prisma.inventoryItem.findMany({
      select: { category: true, quantity: true, costPrice: true, salePrice: true },
    })

    const byCategory: Record<string, { count: number; costValue: number; saleValue: number }> = {}
    let totalCost = new Prisma.Decimal(0)
    let totalSale = new Prisma.Decimal(0)

    for (const item of items) {
      const cat = item.category
      if (!byCategory[cat]) byCategory[cat] = { count: 0, costValue: 0, saleValue: 0 }
      byCategory[cat].count += item.quantity
      const cost = item.costPrice ? new Prisma.Decimal(item.costPrice).mul(item.quantity) : new Prisma.Decimal(0)
      const sale = item.salePrice ? new Prisma.Decimal(item.salePrice).mul(item.quantity) : new Prisma.Decimal(0)
      byCategory[cat].costValue += Number(cost)
      byCategory[cat].saleValue += Number(sale)
      totalCost = totalCost.add(cost)
      totalSale = totalSale.add(sale)
    }

    return {
      totalItems: items.reduce((acc, i) => acc + i.quantity, 0),
      totalCost: totalCost.toFixed(2),
      totalSale: totalSale.toFixed(2),
      potentialProfit: totalSale.sub(totalCost).toFixed(2),
      byCategory,
    }
  })
}
