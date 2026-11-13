import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { Prisma, TransactionType, TransferDirection } from '@prisma/client'
import { prisma } from '../../lib/db'
import { runOperation } from '../../lib/operation'
import { AppError } from '../../lib/errors'
import { money } from '../../lib/validation'

// ============================================================
// Logica de saldos: que tipos de transaccion suman o restan
// al saldo de una cuenta / fondo.
// ============================================================

// Tipos que AUMENTAN el saldo de la cuenta (credito)
const CREDIT_TYPES = new Set<TransactionType>([
  'INCOME', 'SALE', 'OWNER_INVESTMENT', 'OWNER_LOAN', 'REFUND', 'RELEASE_RESERVE',
])

// Tipos que DISMINUYEN el saldo de la cuenta (debito)
const DEBIT_TYPES = new Set<TransactionType>([
  'EXPENSE', 'OWNER_WITHDRAWAL', 'OWNER_LOAN_REPAYMENT',
  'INVENTORY_PURCHASE', 'COST_ADJUSTMENT', 'WRITE_OFF', 'RESERVE', 'OTHER',
])

function balanceEffect(type: TransactionType, transferDirection?: TransferDirection | null): 1 | -1 | 0 {
  if (type === 'TRANSFER') return transferDirection === 'IN' ? 1 : transferDirection === 'OUT' ? -1 : 0
  if (CREDIT_TYPES.has(type)) return 1
  if (DEBIT_TYPES.has(type)) return -1
  return 0 // TRANSFER se maneja aparte (dos cuentas)
}

// Aplica o revierte el efecto de una transaccion sobre el saldo de cuenta y fondo
async function applyBalances(
  db: Prisma.TransactionClient,
  tx: { type: TransactionType; amount: Prisma.Decimal; accountId: string | null; fundId: string | null; transferDirection?: TransferDirection | null },
  direction: 'confirm' | 'void',
) {
  const sign = direction === 'confirm' ? 1 : -1
  const base = balanceEffect(tx.type, tx.transferDirection)

  // Saldo de la cuenta
  if (tx.accountId && base !== 0) {
    if (direction === 'confirm') {
      const account = await db.financialAccount.findUnique({ where: { id: tx.accountId }, select: { isActive: true } })
      if (!account?.isActive) throw new AppError(422, 'La cuenta debe existir y estar activa')
    }
    const effect = base * sign
    const delta = effect > 0 ? tx.amount : tx.amount.mul(-1)
    await db.financialAccount.update({
      where: { id: tx.accountId },
      data: { balance: { increment: delta } },
    })
  }

  // Saldo del fondo: mismo efecto que la cuenta (RESERVE reserva, RELEASE libera)
  if (tx.fundId && base !== 0) {
    if (direction === 'confirm') {
      const fund = await db.fund.findUnique({ where: { id: tx.fundId }, select: { isActive: true } })
      if (!fund?.isActive) throw new AppError(422, 'El fondo debe existir y estar activo')
    }
    const effect = base * sign
    const delta = effect > 0 ? tx.amount : tx.amount.mul(-1)
    await db.fund.update({
      where: { id: tx.fundId },
      data: { balance: { increment: delta } },
    })
  }
}

// ---- Schemas de validacion ----

const accountSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
})

const fundSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
})

const categorySchema = z.object({
  name: z.string().min(1),
  type: z.enum(['income', 'expense']),
  description: z.string().optional(),
})

const txSchema = z.object({
  type: z.nativeEnum(TransactionType),
  amount: money,
  description: z.string().min(1),
  accountId: z.string().optional(),
  fundId: z.string().optional(),
  categoryId: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  transactedAt: z.string().datetime().optional(),
  // Para TRANSFER: cuenta destino
  toAccountId: z.string().optional(),
})

const confirmSchema = z.object({
  confirm: z.literal(true),
})

const voidSchema = z.object({
  reason: z.string().min(1),
})

const transferSchema = z.object({
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  amount: money,
  description: z.string().min(1),
  notes: z.string().optional(),
  transactedAt: z.string().datetime().optional(),
})

const ownerLoanSchema = z.object({
  amount: money,
  description: z.string().optional(),
  loanedAt: z.string().datetime(),
  accountId: z.string().optional(),
})

const repaymentSchema = z.object({
  amount: money,
  paidAt: z.string().datetime(),
  notes: z.string().optional(),
  accountId: z.string().optional(),
})

// ---- Rutas ----

export async function financialRoutes(app: FastifyInstance) {
  // ========================
  // CUENTAS (donde esta el dinero)
  // ========================

  app.get('/accounts', async () => {
    const accounts = await prisma.financialAccount.findMany({
      orderBy: { name: 'asc' },
    })
    return { data: accounts }
  })

  app.post('/accounts', async (req, reply) => {
    const body = accountSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    const account = await runOperation(req, (db) => db.financialAccount.create({ data: body.data }))
    return reply.code(201).send(account)
  })

  app.patch<{ Params: { id: string } }>('/accounts/:id', async (req, reply) => {
    const body = accountSchema.partial().extend({ isActive: z.boolean().optional() }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    const account = await runOperation(req, (db) => db.financialAccount.update({
      where: { id: req.params.id },
      data: body.data,
    }))
    return { data: account }
  })

  // ========================
  // FONDOS (para que esta reservado el dinero)
  // ========================

  app.get('/funds', async () => {
    const funds = await prisma.fund.findMany({ orderBy: { name: 'asc' } })
    return { data: funds }
  })

  app.post('/funds', async (req, reply) => {
    const body = fundSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    const fund = await runOperation(req, (db) => db.fund.create({ data: body.data }))
    return reply.code(201).send(fund)
  })

  app.patch<{ Params: { id: string } }>('/funds/:id', async (req, reply) => {
    const body = fundSchema.partial().extend({ isActive: z.boolean().optional() }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    const fund = await runOperation(req, (db) => db.fund.update({
      where: { id: req.params.id },
      data: body.data,
    }))
    return { data: fund }
  })

  // ========================
  // CATEGORIAS CONTABLES
  // ========================

  app.get('/categories', async () => {
    const cats = await prisma.accountingCategory.findMany({ orderBy: { type: 'asc' } })
    return { data: cats }
  })

  app.post('/categories', async (req, reply) => {
    const body = categorySchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    const cat = await runOperation(req, (db) => db.accountingCategory.create({ data: body.data }))
    return reply.code(201).send(cat)
  })

  // ========================
  // TRANSACCIONES
  // ========================

  // GET /api/financial/transactions — lista con filtros y paginacion
  app.get('/transactions', async (req) => {
    const {
      accountId, fundId, categoryId, type,
      confirmed, page = '1', limit = '40',
      from, to,
    } = req.query as Record<string, string>
    const skip = (Number(page) - 1) * Number(limit)

    const where: any = { isVoided: false }
    if (accountId) where.accountId = accountId
    if (fundId) where.fundId = fundId
    if (categoryId) where.categoryId = categoryId
    if (type) where.type = type
    if (confirmed !== undefined) where.isConfirmed = confirmed === 'true'
    if (from || to) {
      where.transactedAt = {}
      if (from) where.transactedAt.gte = new Date(from)
      if (to) where.transactedAt.lte = new Date(to)
    }

    const [total, transactions] = await Promise.all([
      prisma.financialTransaction.count({ where }),
      prisma.financialTransaction.findMany({
        where,
        orderBy: { transactedAt: 'desc' },
        skip,
        take: Number(limit),
        include: {
          account: { select: { id: true, name: true } },
          fund: { select: { id: true, name: true } },
          category: { select: { id: true, name: true, type: true } },
        },
      }),
    ])

    return {
      data: transactions,
      meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    }
  })

  // POST /api/financial/transactions — registrar movimiento
  app.post('/transactions', async (req, reply) => {
    const body = txSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    if (body.data.type === 'TRANSFER') throw new AppError(422, 'Usa el módulo de transferencias entre cuentas')
    if (body.data.type === 'OWNER_LOAN' || body.data.type === 'OWNER_LOAN_REPAYMENT') {
      throw new AppError(422, 'Registra los préstamos y devoluciones desde el módulo de préstamos')
    }
    const transaction = await runOperation(req, (db) => db.financialTransaction.create({
      data: {
        type: body.data.type, amount: body.data.amount, description: body.data.description,
        accountId: body.data.accountId, fundId: body.data.fundId, categoryId: body.data.categoryId,
        reference: body.data.reference, notes: body.data.notes,
        transactedAt: body.data.transactedAt ? new Date(body.data.transactedAt) : new Date(),
        isConfirmed: false,
      },
      include: {
        account: { select: { id: true, name: true } }, fund: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
    }))
    return reply.code(201).send(transaction)
  })

  // Confirmación y saldos se confirman juntos; una segunda solicitud no aplica dos veces.
  app.post<{ Params: { id: string } }>('/transactions/:id/confirm', async (req, reply) => {
    const body = confirmSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    const updated = await runOperation(req, async (db) => {
      const tx = await db.financialTransaction.findUnique({ where: { id: req.params.id } })
      if (!tx) throw new AppError(404, 'Transacción no encontrada')
      if (tx.isConfirmed) throw new AppError(422, 'La transacción ya está confirmada')
      if (tx.isVoided) throw new AppError(422, 'No se puede confirmar una transacción anulada')
      if (tx.type === 'TRANSFER' || tx.type === 'OWNER_LOAN' || tx.type === 'OWNER_LOAN_REPAYMENT') {
        throw new AppError(422, 'Este movimiento debe gestionarse desde su operación de origen')
      }
      await db.financialTransaction.update({ where: { id: tx.id }, data: { isConfirmed: true } })
      await applyBalances(db, tx, 'confirm')
      return db.financialTransaction.findUnique({
        where: { id: tx.id },
        include: { account: { select: { id: true, name: true } }, fund: { select: { id: true, name: true } } },
      })
    })
    return { data: updated }
  })

  // Anular una transferencia revierte las dos cuentas en la misma transacción.
  app.post<{ Params: { id: string } }>('/transactions/:id/void', async (req, reply) => {
    const body = voidSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    await runOperation(req, async (db) => {
      const tx = await db.financialTransaction.findUnique({
        where: { id: req.params.id }, include: { payment: { select: { id: true } } },
      })
      if (!tx) throw new AppError(404, 'Transacción no encontrada')
      if (tx.isVoided) throw new AppError(422, 'La transacción ya está anulada')
      if (tx.payment || tx.type === 'OWNER_LOAN' || tx.type === 'OWNER_LOAN_REPAYMENT') {
        throw new AppError(422, 'Este movimiento pertenece a un pago o préstamo y no puede anularse desde el libro')
      }
      if ((tx.type === 'TRANSFER' && !tx.transferId) ||
          (tx.type === 'INCOME' && tx.description.startsWith('Transferencia desde ← '))) {
        throw new AppError(422, 'La transferencia histórica requiere conciliación antes de anularse')
      }
      const entries = tx.transferId
        ? await db.financialTransaction.findMany({ where: { transferId: tx.transferId } }) : [tx]
      if (tx.transferId && (entries.length !== 2 || entries.some((entry) => !entry.isConfirmed || entry.isVoided))) {
        throw new AppError(409, 'La transferencia requiere revisión de sus dos movimientos')
      }
      for (const entry of entries) {
        await db.financialTransaction.update({
          where: { id: entry.id },
          data: { isVoided: true, voidedAt: new Date(), voidReason: body.data.reason },
        })
        if (entry.isConfirmed) await applyBalances(db, entry, 'void')
      }
      return null
    })
    return reply.code(204).send()
  })

  // Las transferencias no son ingresos ni gastos y sus movimientos quedan vinculados.
  app.post('/transfer', async (req, reply) => {
    const body = transferSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    const { fromAccountId, toAccountId, amount, description, notes, transactedAt } = body.data
    if (fromAccountId === toAccountId) throw new AppError(422, 'Las cuentas origen y destino deben ser distintas')
    const result = await runOperation(req, async (db) => {
      const accounts = await db.financialAccount.count({
        where: { id: { in: [fromAccountId, toAccountId] }, isActive: true },
      })
      if (accounts !== 2) throw new AppError(422, 'Las dos cuentas deben existir y estar activas')
      const transferId = randomUUID()
      const date = transactedAt ? new Date(transactedAt) : new Date()
      const common = { type: TransactionType.TRANSFER, amount, notes, transactedAt: date, isConfirmed: true, transferId }
      const egress = await db.financialTransaction.create({
        data: { ...common, description, accountId: fromAccountId, transferDirection: 'OUT' },
      })
      const income = await db.financialTransaction.create({
        data: { ...common, description, accountId: toAccountId, transferDirection: 'IN' },
      })
      await applyBalances(db, egress, 'confirm')
      await applyBalances(db, income, 'confirm')
      return { egress, income }
    })
    return reply.code(201).send(result)
  })

  // ========================
  // PRESTAMOS DE LA PROPIETARIA
  // ========================

  // GET /api/financial/owner-loans — listar prestamos con saldo pendiente
  app.get('/owner-loans', async () => {
    const loans = await prisma.ownerLoan.findMany({
      orderBy: { loanedAt: 'desc' },
      include: {
        repayments: { orderBy: { paidAt: 'desc' } },
      },
    })

    // Calcular saldo pendiente por prestamo
    const loansWithBalance = loans.map((l) => {
      const repaid = l.repayments.reduce(
        (acc, r) => acc.add(r.amount),
        new Prisma.Decimal(0),
      )
      const pending = new Prisma.Decimal(l.amount).sub(repaid)
      return { ...l, repaid: repaid.toFixed(2), pending: pending.toFixed(2) }
    })

    const totalPending = loansWithBalance.reduce(
      (acc, l) => acc.add(new Prisma.Decimal(l.pending)),
      new Prisma.Decimal(0),
    )

    return { data: loansWithBalance, totalPending: totalPending.toFixed(2) }
  })

  // Préstamo, asiento y saldo comparten transacción y recibo de reintento.
  app.post('/owner-loans', async (req, reply) => {
    const body = ownerLoanSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    const loan = await runOperation(req, async (db) => {
      const created = await db.ownerLoan.create({
        data: { amount: body.data.amount, description: body.data.description, loanedAt: new Date(body.data.loanedAt) },
      })
      if (body.data.accountId) {
        const entry = await db.financialTransaction.create({
          data: {
            type: TransactionType.OWNER_LOAN, amount: body.data.amount,
            description: 'Préstamo propietaria', reference: created.id,
            accountId: body.data.accountId, transactedAt: new Date(body.data.loanedAt), isConfirmed: true,
          },
        })
        await applyBalances(db, entry, 'confirm')
      }
      return created
    })
    return reply.code(201).send(loan)
  })

  // El saldo pendiente se valida dentro de la transacción serializable.
  app.post<{ Params: { id: string } }>('/owner-loans/:id/repayments', async (req, reply) => {
    const body = repaymentSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    const repayment = await runOperation(req, async (db) => {
      const loan = await db.ownerLoan.findUnique({ where: { id: req.params.id }, include: { repayments: true } })
      if (!loan) throw new AppError(404, 'Préstamo no encontrado')
      const totalRepaid = loan.repayments.reduce((acc, item) => acc.add(item.amount), new Prisma.Decimal(0))
      const newAmount = new Prisma.Decimal(body.data.amount)
      if (newAmount.gt(new Prisma.Decimal(loan.amount).sub(totalRepaid))) {
        throw new AppError(422, 'El monto supera el saldo pendiente del préstamo')
      }
      const created = await db.ownerLoanRepayment.create({
        data: { loanId: loan.id, amount: newAmount, paidAt: new Date(body.data.paidAt), notes: body.data.notes },
      })
      const isRepaid = totalRepaid.add(newAmount).gte(loan.amount)
      await db.ownerLoan.update({
        where: { id: loan.id }, data: { isRepaid, repaidAt: isRepaid ? new Date(body.data.paidAt) : null },
      })
      if (body.data.accountId) {
        const entry = await db.financialTransaction.create({
          data: {
            type: TransactionType.OWNER_LOAN_REPAYMENT, amount: newAmount,
            description: 'Devolución préstamo propietaria', reference: created.id,
            accountId: body.data.accountId, transactedAt: new Date(body.data.paidAt), isConfirmed: true,
          },
        })
        await applyBalances(db, entry, 'confirm')
      }
      return created
    })
    return reply.code(201).send(repayment)
  })

  // ========================
  // RESUMEN FINANCIERO (para el panel)
  // ========================

  app.get('/summary', async () => {
    const [accounts, funds, loans, txStats] = await Promise.all([
      prisma.financialAccount.findMany({ where: { isActive: true } }),
      prisma.fund.findMany({ where: { isActive: true } }),
      prisma.ownerLoan.findMany({
        where: { isRepaid: false },
        include: { repayments: true },
      }),
      prisma.financialTransaction.aggregate({
        where: {
          isVoided: false,
          isConfirmed: true,
          transactedAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
        _sum: { amount: true },
      }),
    ])

    const totalBalance = accounts.reduce(
      (acc, a) => acc.add(a.balance), new Prisma.Decimal(0),
    )
    const totalFunds = funds.reduce(
      (acc, f) => acc.add(f.balance), new Prisma.Decimal(0),
    )
    const totalOwnerDebt = loans.reduce((acc, l) => {
      const repaid = l.repayments.reduce(
        (a, r) => a.add(r.amount), new Prisma.Decimal(0),
      )
      return acc.add(new Prisma.Decimal(l.amount).sub(repaid))
    }, new Prisma.Decimal(0))

    return {
      totalBalance: totalBalance.toFixed(2),
      totalFunds: totalFunds.toFixed(2),
      totalOwnerDebt: totalOwnerDebt.toFixed(2),
      monthlyMovements: txStats._sum.amount?.toFixed(2) ?? '0.00',
      accounts: accounts.map((a) => ({ id: a.id, name: a.name, balance: a.balance.toFixed(2) })),
      funds: funds.map((f) => ({ id: f.id, name: f.name, balance: f.balance.toFixed(2) })),
    }
  })

  // ========================
  // REPORTE DEBER/HABER (exportacion contable)
  // ========================

  app.get('/ledger', async (req) => {
    const { from, to } = req.query as { from?: string; to?: string }

    const where: any = { isVoided: false, isConfirmed: true }
    if (from || to) {
      where.transactedAt = {}
      if (from) where.transactedAt.gte = new Date(from)
      if (to) where.transactedAt.lte = new Date(to)
    }

    const transactions = await prisma.financialTransaction.findMany({
      where,
      orderBy: { transactedAt: 'asc' },
      include: {
        account: { select: { name: true } },
        fund: { select: { name: true } },
        category: { select: { name: true, type: true } },
      },
    })

    // Formato deber / haber para libro contable
    const rows = transactions.map((tx) => {
      const effect = balanceEffect(tx.type, tx.transferDirection)
      return {
        fecha: tx.transactedAt.toISOString().slice(0, 10),
        descripcion: tx.description,
        tipo: tx.type,
        cuenta: tx.account?.name ?? '—',
        fondo: tx.fund?.name ?? '—',
        categoria: tx.category?.name ?? '—',
        debe: effect === -1 ? tx.amount.toFixed(2) : '0.00',
        haber: effect === 1 ? tx.amount.toFixed(2) : '0.00',
        referencia: tx.reference ?? '',
      }
    })

    return { data: rows }
  })
}
