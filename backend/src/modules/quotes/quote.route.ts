import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Prisma, QuoteStatus, PaymentMethod } from '@prisma/client'
import { prisma } from '../../lib/db'
import { runOperation } from '../../lib/operation'
import { AppError } from '../../lib/errors'
import { money, nonNegativeMoney } from '../../lib/validation'

// ---- Schemas ----

const itemSchema = z.object({
  description: z.string().min(1),
  itemType: z.enum(['part', 'labor', 'service', 'other']),
  quantity: money.max(99_999_999.99).default(1),
  unitPrice: nonNegativeMoney,
  notes: z.string().optional(),
  position: z.number().int().optional(),
  inventoryItemId: z.string().optional(),
})

const createSchema = z.object({
  workOrderId: z.string().optional(),
  customerId: z.string().optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
  validUntil: z.string().datetime().optional(),
  items: z.array(itemSchema).min(1, 'Se requiere al menos un ítem').max(100),
})

const updateSchema = z.object({
  notes: z.string().optional(),
  terms: z.string().optional(),
  validUntil: z.string().datetime().optional(),
  items: z.array(itemSchema).min(1).max(100).optional(),
})

const approveSchema = z.object({
  approvedBy: z.string().min(1),
  notes: z.string().optional(),
})

const rejectSchema = z.object({
  reason: z.string().min(1),
})

const paymentSchema = z.object({
  amount: money,
  method: z.nativeEnum(PaymentMethod),
  reference: z.string().optional(),
  notes: z.string().optional(),
  paidAt: z.string().datetime().optional(),
})

const voidPaymentSchema = z.object({
  reason: z.string().min(1),
})

// ---- Helpers ----

async function nextQuoteNumber(db: Prisma.TransactionClient): Promise<string> {
  const count = await db.quote.count()
  const year = new Date().getFullYear()
  return `COT-${year}-${String(count + 1).padStart(4, '0')}`
}

function calcSubtotal(qty: number, unit: number): Prisma.Decimal {
  const subtotal = new Prisma.Decimal(qty).mul(new Prisma.Decimal(unit)).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
  if (subtotal.gt(9_999_999_999.99)) throw new AppError(422, 'El subtotal supera el límite de la cotización')
  return subtotal
}

function calcTotal(items: { quantity: number; unitPrice: number }[]): Prisma.Decimal {
  const total = items.reduce(
    (acc, i) => acc.add(calcSubtotal(i.quantity, i.unitPrice)),
    new Prisma.Decimal(0),
  )
  if (total.gt(9_999_999_999.99)) throw new AppError(422, 'El total supera el límite de la cotización')
  return total
}

// Snapshot de cotizacion para versionado
async function snapshotQuote(db: Prisma.TransactionClient, quoteId: string) {
  const q = await db.quote.findUnique({
    where: { id: quoteId },
    include: { items: true },
  })
  const lastVersion = await db.quoteVersion.findFirst({
    where: { quoteId },
    orderBy: { version: 'desc' },
    select: { version: true },
  })
  await db.quoteVersion.create({
    data: {
      quoteId,
      version: (lastVersion?.version ?? 0) + 1,
      snapshot: JSON.parse(JSON.stringify(q)) as Prisma.InputJsonValue,
    },
  })
}

export async function quoteRoutes(app: FastifyInstance) {
  // GET /api/quotes — lista con filtros
  app.get('/', async (req) => {
    const { q, customerId, workOrderId, status, page = '1', limit = '20' } =
      req.query as Record<string, string>
    const skip = (Number(page) - 1) * Number(limit)

    const where: any = {}
    if (customerId) where.customerId = customerId
    if (workOrderId) where.workOrderId = workOrderId
    if (status) where.status = status
    if (q) {
      where.OR = [
        { number: { contains: q, mode: 'insensitive' } },
        { customer: { name: { contains: q, mode: 'insensitive' } } },
      ]
    }

    const [total, quotes] = await Promise.all([
      prisma.quote.count({ where }),
      prisma.quote.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          workOrder: { select: { id: true, number: true } },
          _count: { select: { items: true, payments: true } },
        },
      }),
    ])

    return {
      data: quotes,
      meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    }
  })

  // GET /api/quotes/:id — detalle completo
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const quote = await prisma.quote.findUnique({
      where: { id: req.params.id },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        workOrder: { select: { id: true, number: true } },
        items: { orderBy: { position: 'asc' } },
        payments: { orderBy: { paidAt: 'desc' } },
        versions: { orderBy: { version: 'desc' }, take: 10 },
      },
    })
    if (!quote) return reply.code(404).send({ error: 'Cotización no encontrada' })
    return quote
  })

  app.post('/', async (req, reply) => {
    const body = createSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    const quote = await runOperation(req, async (db) => {
      const { workOrderId, customerId, notes, terms, validUntil, items } = body.data
      let resolvedCustomerId = customerId
      if (workOrderId) {
        const wo = await db.workOrder.findUnique({ where: { id: workOrderId }, select: { customerId: true } })
        if (!wo) throw new AppError(422, 'Orden de trabajo no disponible')
        if (customerId && customerId !== wo.customerId) throw new AppError(422, 'El cliente no coincide con la orden de trabajo')
        resolvedCustomerId = wo.customerId
      }
      return db.quote.create({
        data: {
          number: await nextQuoteNumber(db), workOrderId, customerId: resolvedCustomerId,
          notes, terms, validUntil: validUntil ? new Date(validUntil) : undefined,
          total: calcTotal(items), status: QuoteStatus.DRAFT,
          items: { create: items.map((item, idx) => ({
            description: item.description, itemType: item.itemType,
            quantity: item.quantity, unitPrice: item.unitPrice, subtotal: calcSubtotal(item.quantity, item.unitPrice),
            notes: item.notes, position: item.position ?? idx, inventoryItemId: item.inventoryItemId,
          })) },
        },
        include: { customer: { select: { id: true, name: true, phone: true } }, items: { orderBy: { position: 'asc' } } },
      })
    })
    return reply.code(201).send(quote)
  })

  // Versión, ítems y total se actualizan juntos, sin reducir el total por debajo de lo cobrado.
  app.patch<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const body = updateSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    const updated = await runOperation(req, async (db) => {
      const existing = await db.quote.findUnique({
        where: { id: req.params.id }, include: { payments: { where: { isVoided: false } } },
      })
      if (!existing) throw new AppError(404, 'Cotización no encontrada')
      if (existing.status !== QuoteStatus.DRAFT && existing.status !== QuoteStatus.SENT) {
        throw new AppError(422, 'La cotización no se puede editar en su estado actual')
      }
      const { items, validUntil, ...rest } = body.data
      const total = items ? calcTotal(items) : existing.total
      const paid = existing.payments.reduce((acc, payment) => acc.add(payment.amount), new Prisma.Decimal(0))
      if (total.lt(paid)) throw new AppError(422, 'El total no puede ser menor que los pagos vigentes')
      await snapshotQuote(db, existing.id)
      if (items) {
        await db.quoteItem.deleteMany({ where: { quoteId: existing.id } })
        await db.quoteItem.createMany({ data: items.map((item, idx) => ({
          quoteId: existing.id, description: item.description, itemType: item.itemType,
          quantity: item.quantity, unitPrice: item.unitPrice, subtotal: calcSubtotal(item.quantity, item.unitPrice),
          notes: item.notes, position: item.position ?? idx, inventoryItemId: item.inventoryItemId,
        })) })
      }
      return db.quote.update({
        where: { id: existing.id },
        data: { ...rest, total, validUntil: validUntil ? new Date(validUntil) : undefined },
        include: { items: { orderBy: { position: 'asc' } }, customer: { select: { id: true, name: true, phone: true } } },
      })
    })
    return { data: updated }
  })

  app.post<{ Params: { id: string } }>('/:id/send', async (req) => {
    const updated = await runOperation(req, async (db) => {
      const existing = await db.quote.findUnique({ where: { id: req.params.id } })
      if (!existing) throw new AppError(404, 'Cotización no encontrada')
      if (existing.status !== QuoteStatus.DRAFT) throw new AppError(422, 'Solo se puede enviar una cotización en estado Borrador')
      return db.quote.update({ where: { id: existing.id }, data: { status: QuoteStatus.SENT } })
    })
    return { data: updated }
  })

  app.post<{ Params: { id: string } }>('/:id/approve', async (req, reply) => {
    const body = approveSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    const updated = await runOperation(req, async (db) => {
      const existing = await db.quote.findUnique({ where: { id: req.params.id } })
      if (!existing) throw new AppError(404, 'Cotización no encontrada')
      if (existing.status !== QuoteStatus.SENT && existing.status !== QuoteStatus.AWAITING_APPROVAL) {
        throw new AppError(422, 'La cotización no está pendiente de aprobación')
      }
      return db.quote.update({
        where: { id: existing.id },
        data: {
          status: QuoteStatus.APPROVED, approvedAt: new Date(), approvedBy: body.data.approvedBy,
          notes: body.data.notes ? [existing.notes, body.data.notes].filter(Boolean).join('\n') : existing.notes,
        },
      })
    })
    return { data: updated }
  })

  app.post<{ Params: { id: string } }>('/:id/reject', async (req, reply) => {
    const body = rejectSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    const updated = await runOperation(req, async (db) => {
      const existing = await db.quote.findUnique({
        where: { id: req.params.id }, include: { payments: { where: { isVoided: false } } },
      })
      if (!existing) throw new AppError(404, 'Cotización no encontrada')
      if (existing.payments.length || existing.status === 'CONVERTED') throw new AppError(422, 'Revisa los pagos antes de rechazar esta cotización')
      if (existing.status === 'REJECTED' || existing.status === 'EXPIRED') throw new AppError(422, 'La cotización ya está cerrada')
      return db.quote.update({
        where: { id: existing.id },
        data: { status: QuoteStatus.REJECTED, rejectedAt: new Date(), rejectedReason: body.data.reason },
      })
    })
    return { data: updated }
  })

  // GET /api/quotes/:id/payments — pagos de la cotizacion
  app.get<{ Params: { id: string } }>('/:id/payments', async (req, reply) => {
    const quote = await prisma.quote.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, total: true,
        payments: {
          where: { isVoided: false },
          orderBy: { paidAt: 'desc' },
        },
      },
    })
    if (!quote) return reply.code(404).send({ error: 'Cotización no encontrada' })

    const paid = quote.payments.reduce(
      (acc, p) => acc.add(p.amount), new Prisma.Decimal(0),
    )
    const balance = new Prisma.Decimal(quote.total).sub(paid)

    return {
      data: quote.payments,
      summary: {
        total: quote.total,
        paid: paid.toFixed(2),
        balance: balance.toFixed(2),
        isPaidInFull: balance.lte(0),
      },
    }
  })

  // La suma de pagos se valida contra el mismo snapshot que se confirma.
  app.post<{ Params: { id: string } }>('/:id/payments', async (req, reply) => {
    const body = paymentSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    const payment = await runOperation(req, async (db) => {
      const quote = await db.quote.findUnique({
        where: { id: req.params.id }, include: { payments: { where: { isVoided: false } } },
      })
      if (!quote) throw new AppError(404, 'Cotización no encontrada')
      if (quote.status === QuoteStatus.REJECTED || quote.status === QuoteStatus.EXPIRED) {
        throw new AppError(422, 'No se puede registrar pago en esta cotización')
      }
      const paid = quote.payments.reduce((acc, item) => acc.add(item.amount), new Prisma.Decimal(0))
      const newTotal = paid.add(body.data.amount)
      if (newTotal.gt(quote.total)) throw new AppError(422, 'El pago supera el saldo pendiente')
      const created = await db.payment.create({
        data: {
          quoteId: quote.id, amount: body.data.amount, method: body.data.method,
          reference: body.data.reference, notes: body.data.notes,
          paidAt: body.data.paidAt ? new Date(body.data.paidAt) : new Date(),
        },
      })
      if (newTotal.gte(quote.total)) {
        await db.quote.update({ where: { id: quote.id }, data: { status: QuoteStatus.CONVERTED } })
      }
      return created
    })
    return reply.code(201).send(payment)
  })

  app.post<{ Params: { id: string; payId: string } }>('/:id/payments/:payId/void', async (req, reply) => {
    const body = voidPaymentSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    const voided = await runOperation(req, async (db) => {
      const payment = await db.payment.findFirst({ where: { id: req.params.payId, quoteId: req.params.id } })
      if (!payment) throw new AppError(404, 'Pago no encontrado')
      if (payment.isVoided) throw new AppError(422, 'El pago ya está anulado')
      if (payment.transactionId) throw new AppError(422, 'El pago tiene un asiento vinculado y requiere conciliación')
      const updated = await db.payment.update({
        where: { id: payment.id },
        data: { isVoided: true, voidedAt: new Date(), voidReason: body.data.reason },
      })
      const quote = await db.quote.findUnique({ where: { id: req.params.id } })
      if (quote?.status === QuoteStatus.CONVERTED) {
        await db.quote.update({ where: { id: quote.id }, data: { status: QuoteStatus.APPROVED } })
      }
      return { data: updated }
    })
    return voided
  })

  // GET /api/quotes/:id/pdf-data — datos para generar PDF/WhatsApp en el frontend
  app.get<{ Params: { id: string } }>('/:id/pdf-data', async (req, reply) => {
    const quote = await prisma.quote.findUnique({
      where: { id: req.params.id },
      include: {
        customer: { select: { name: true, phone: true, email: true } },
        workOrder: { select: { number: true } },
        items: { orderBy: { position: 'asc' } },
        payments: { where: { isVoided: false } },
      },
    })
    if (!quote) return reply.code(404).send({ error: 'Cotización no encontrada' })

    const paid = quote.payments.reduce(
      (acc, p) => acc.add(p.amount), new Prisma.Decimal(0),
    )

    return {
      ...quote,
      summary: {
        total: quote.total,
        paid: paid.toFixed(2),
        balance: new Prisma.Decimal(quote.total).sub(paid).toFixed(2),
      },
    }
  })
}
