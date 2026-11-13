import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Prisma, InventoryMovementType } from '@prisma/client'
import { prisma } from '../../lib/db'
import { runOperation } from '../../lib/operation'
import { money, stockQuantity } from '../../lib/validation'
import { AppError } from '../../lib/errors'

// ============================================================
// Proveedores y compras
// ============================================================

// ---- Schemas ----

const supplierSchema = z.object({
  name: z.string().min(1),
  isLocal: z.boolean().default(true),
  country: z.string().optional(),
  contact: z.string().optional(),
  website: z.string().optional(),
  notes: z.string().optional(),
})

const updateSupplierSchema = supplierSchema.partial().extend({ isLocal: z.boolean().optional() })

const purchaseItemSchema = z.object({
  description: z.string().min(1),
  quantity: stockQuantity.refine((value) => value > 0, 'La cantidad debe ser positiva'),
  unitCostCRC: money,
  inventoryItemId: z.string().optional(),
  importShipmentItemId: z.string().optional(),
}).refine((item) => new Prisma.Decimal(item.quantity).mul(item.unitCostCRC).lte(9_999_999_999.99), 'El subtotal supera el límite permitido')

const createPurchaseSchema = z.object({
  supplierId: z.string().optional(),
  purchasedAt: z.string().datetime(),
  notes: z.string().optional(),
  items: z.array(purchaseItemSchema).min(1, 'Se requiere al menos un ítem').max(100),
})

export async function supplierRoutes(app: FastifyInstance) {
  // ========================
  // PROVEEDORES
  // ========================

  // GET /api/suppliers — lista con filtros
  app.get('/', async (req) => {
    const { q, isLocal, page = '1', limit = '50' } = req.query as Record<string, string>
    const skip = (Number(page) - 1) * Number(limit)

    const where: any = {}
    if (isLocal !== undefined) where.isLocal = isLocal === 'true'
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { country: { contains: q, mode: 'insensitive' } },
      ]
    }

    const [total, suppliers] = await Promise.all([
      prisma.supplier.count({ where }),
      prisma.supplier.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: Number(limit),
        include: {
          _count: { select: { purchases: true, partRequests: true } },
        },
      }),
    ])

    return {
      data: suppliers,
      meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    }
  })

  // GET /api/suppliers/:id — detalle
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const supplier = await prisma.supplier.findUnique({
      where: { id: req.params.id },
      include: {
        purchases: {
          orderBy: { purchasedAt: 'desc' },
          take: 10,
          include: { _count: { select: { items: true } } },
        },
        partRequests: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, description: true, status: true, createdAt: true },
        },
      },
    })
    if (!supplier) return reply.code(404).send({ error: 'Proveedor no encontrado' })
    return supplier
  })

  // POST /api/suppliers — crear
  app.post('/', async (req, reply) => {
    const body = supplierSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    const supplier = await prisma.supplier.create({ data: body.data })
    return reply.code(201).send(supplier)
  })

  // PATCH /api/suppliers/:id — actualizar
  app.patch<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const body = updateSupplierSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    const existing = await prisma.supplier.findUnique({ where: { id: req.params.id } })
    if (!existing) return reply.code(404).send({ error: 'Proveedor no encontrado' })
    const updated = await prisma.supplier.update({ where: { id: req.params.id }, data: body.data })
    return { data: updated }
  })

  // DELETE /api/suppliers/:id — eliminar (solo si no tiene referencias)
  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const supplier = await prisma.supplier.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { purchases: true, partRequests: true } } },
    })
    if (!supplier) return reply.code(404).send({ error: 'Proveedor no encontrado' })
    if (supplier._count.purchases > 0 || supplier._count.partRequests > 0) {
      return reply.code(422).send({
        error: 'No se puede eliminar un proveedor con compras o solicitudes de repuesto asociadas',
      })
    }
    await prisma.supplier.delete({ where: { id: req.params.id } })
    return reply.code(204).send()
  })

  // ========================
  // COMPRAS
  // ========================

  // GET /api/suppliers/purchases — lista de compras
  // IMPORTANTE: esta ruta debe ir antes que /:id para no colisionar
  app.get('/purchases', async (req) => {
    const { supplierId, page = '1', limit = '20' } = req.query as Record<string, string>
    const skip = (Number(page) - 1) * Number(limit)

    const where: any = {}
    if (supplierId) where.supplierId = supplierId

    const [total, purchases] = await Promise.all([
      prisma.purchase.count({ where }),
      prisma.purchase.findMany({
        where,
        orderBy: { purchasedAt: 'desc' },
        skip,
        take: Number(limit),
        include: {
          supplier: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
    ])

    return {
      data: purchases,
      meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    }
  })

  // GET /api/suppliers/purchases/:id — detalle de compra
  app.get<{ Params: { id: string } }>('/purchases/:id', async (req, reply) => {
    const purchase = await prisma.purchase.findUnique({
      where: { id: req.params.id },
      include: {
        supplier: { select: { id: true, name: true, country: true } },
        items: {
          include: {
            inventoryItem: { select: { id: true, name: true } },
            importShipmentItem: { select: { id: true, description: true } },
          },
        },
      },
    })
    if (!purchase) return reply.code(404).send({ error: 'Compra no encontrada' })
    return purchase
  })

  // POST /api/suppliers/purchases — crear compra
  app.post('/purchases', async (req, reply) => {
    const body = createPurchaseSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    const { supplierId, purchasedAt, notes, items } = body.data

    const totalCRC = items.reduce(
      (acc, i) => acc.add(new Prisma.Decimal(i.quantity).mul(new Prisma.Decimal(i.unitCostCRC))),
      new Prisma.Decimal(0),
    )

    if (totalCRC.gt(999_999_999_999.99)) throw new AppError(422, 'El total de la compra supera el límite permitido')
    const purchase = await runOperation(req, async (tx) => {
      const created = await tx.purchase.create({
        data: {
          supplierId,
          purchasedAt: new Date(purchasedAt),
          notes,
          totalCRC,
          items: {
            create: items.map((i) => ({
              description: i.description,
              quantity: i.quantity,
              unitCostCRC: i.unitCostCRC,
              subtotal: new Prisma.Decimal(i.quantity).mul(new Prisma.Decimal(i.unitCostCRC)),
              inventoryItemId: i.inventoryItemId,
              importShipmentItemId: i.importShipmentItemId,
            })),
          },
        },
        include: { items: true },
      })

      // Para cada item con inventoryItemId: crear movimiento de entrada y actualizar stock
      for (const item of created.items) {
        if (item.inventoryItemId) {
          const stock = await tx.inventoryItem.findUnique({ where: { id: item.inventoryItemId }, select: { quantity: true } })
          if (!stock || stock.quantity + item.quantity > 2_147_483_647) throw new AppError(422, 'La entrada supera el límite de inventario')
          await tx.inventoryMovement.create({
            data: {
              inventoryItemId: item.inventoryItemId,
              type: InventoryMovementType.ENTRY,
              quantity: item.quantity,
              unitCost: item.unitCostCRC,
              notes: `Compra: ${item.description}`,
              purchaseItemId: item.id,
            },
          })
          await tx.inventoryItem.update({
            where: { id: item.inventoryItemId },
            data: {
              quantity: { increment: item.quantity },
              costPrice: item.unitCostCRC,
            },
          })
        }
      }

      return tx.purchase.findUnique({
        where: { id: created.id },
        include: {
          supplier: { select: { id: true, name: true } },
          items: {
            include: { inventoryItem: { select: { id: true, name: true } } },
          },
        },
      })
    })

    return reply.code(201).send(purchase)
  })
}
