import type { FastifyInstance } from 'fastify'
import { Prisma, OwnDeviceStatus, TransactionType, WorkOrderDeviceStatus } from '@prisma/client'
import { prisma } from '../../lib/db'

const ZERO = new Prisma.Decimal(0)

const ACTIVE_OWN_STATUSES: OwnDeviceStatus[] = [
  'ACQUIRED', 'INITIAL_ASSESSMENT', 'WAITING_PARTS', 'RECONDITIONING',
  'QUALITY_CHECK', 'PHOTOGRAPHING', 'PRICING', 'LISTED', 'RESERVED',
  'WARRANTY_CLAIM',
]

const ACTIVE_WO_STATUSES: WorkOrderDeviceStatus[] = [
  'RECEIVED', 'DIAGNOSING', 'QUOTED', 'AWAITING_APPROVAL', 'APPROVED',
  'WAITING_PARTS', 'REPAIRING', 'QUALITY_CHECK', 'READY_FOR_DELIVERY', 'WARRANTY_CLAIM',
]

const EXPENSE_TYPES: TransactionType[] = [
  'EXPENSE', 'INVENTORY_PURCHASE', 'WRITE_OFF', 'COST_ADJUSTMENT',
]
const INCOME_TYPES: TransactionType[] = ['INCOME', 'SALE', 'REFUND']

export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    // ===================================================================
    // Queries en paralelo — cada bloque corresponde a una seccion del panel
    // ===================================================================
    const [
      accounts, funds, ownerLoans,
      inventoryItems, ownDevices, soldProducts,
      convertedQuoteItems,
      expenseTxns, incomeTxns, toolsExpenses, infraExpenses,
      workOrderDevices, pendingQuotes, unpaidQuotes,
      lowStockItems, productsByStatus,
      warranties, activeReservations,
    ] = await Promise.all([
      // --- Financiero: saldos ---
      prisma.financialAccount.findMany({ where: { isActive: true } }),
      prisma.fund.findMany({ where: { isActive: true } }),
      prisma.ownerLoan.findMany({ where: { isRepaid: false }, include: { repayments: true } }),

      // --- Inventario ---
      prisma.inventoryItem.findMany({ select: { quantity: true, costPrice: true, salePrice: true } }),

      // --- Equipos propios (laptops en reacondicionamiento o listados) ---
      prisma.device.findMany({
        where: { ownerType: 'OWN', ownStatus: { in: ACTIVE_OWN_STATUSES } },
        select: { totalCost: true },
      }),

      // --- Productos vendidos (laptops vendidas) ---
      prisma.product.findMany({
        where: { status: 'SOLD' },
        select: { askingPriceCRC: true, costCRC: true, device: { select: { totalCost: true } } },
      }),

      // --- Items de cotizaciones CONVERTIDAS (pagadas) ---
      prisma.quoteItem.findMany({
        where: { quote: { status: 'CONVERTED' } },
        select: { itemType: true, subtotal: true },
      }),

      // --- Transacciones de gasto confirmadas ---
      prisma.financialTransaction.aggregate({
        where: { isConfirmed: true, isVoided: false, type: { in: EXPENSE_TYPES } },
        _sum: { amount: true },
      }),

      // --- Transacciones de ingreso confirmadas ---
      prisma.financialTransaction.aggregate({
        where: { isConfirmed: true, isVoided: false, type: { in: INCOME_TYPES } },
        _sum: { amount: true },
      }),

      // --- Gastos en herramientas/taller ---
      prisma.financialTransaction.aggregate({
        where: {
          isConfirmed: true, isVoided: false,
          type: { in: EXPENSE_TYPES },
          category: { name: { contains: 'herramienta', mode: 'insensitive' } },
        },
        _sum: { amount: true },
      }),

      // --- Gastos en infraestructura/local ---
      prisma.financialTransaction.aggregate({
        where: {
          isConfirmed: true, isVoided: false,
          type: { in: EXPENSE_TYPES },
          category: { name: { contains: 'infraestructura', mode: 'insensitive' } },
        },
        _sum: { amount: true },
      }),

      // --- Ordenes de trabajo activas ---
      prisma.workOrderDevice.findMany({
        where: { status: { in: ACTIVE_WO_STATUSES } },
        select: { id: true, status: true, updatedAt: true },
      }),

      // --- Cotizaciones pendientes de aprobacion ---
      prisma.quote.count({ where: { status: { in: ['SENT', 'AWAITING_APPROVAL'] } } }),

      // --- Saldo por cobrar (cotizaciones aprobadas con saldo pendiente) ---
      prisma.quote.findMany({
        where: { status: { in: ['APPROVED', 'CONVERTED'] } },
        select: { total: true, payments: { where: { isVoided: false }, select: { amount: true } } },
      }),

      // --- Stock bajo ---
      prisma.inventoryItem.findMany({
        where: { minQuantity: { gt: 0 }, quantity: { lte: prisma.inventoryItem.fields.minQuantity } },
        select: { id: true, name: true, quantity: true, minQuantity: true },
      }),

      // --- Productos por estado ---
      prisma.product.groupBy({ by: ['status'], _count: true }),

      // --- Garantias vigentes ---
      prisma.warranty.findMany({
        where: { isActive: true, expiresAt: { gt: new Date() } },
        select: { id: true, expiresAt: true, product: { select: { title: true } } },
      }),

      // --- Reservas activas ---
      prisma.productReservation.count({ where: { isActive: true, expiresAt: { gt: new Date() } } }),
    ])

    // ===================================================
    // CALCULOS
    // ===================================================

    // --- Saldos financieros ---
    const totalBalance = accounts.reduce((acc, a) => acc.add(a.balance), ZERO)
    const totalFunds = funds.reduce((acc, f) => acc.add(f.balance), ZERO)
    const totalOwnerDebt = ownerLoans.reduce((acc, l) => {
      const repaid = l.repayments.reduce((a, r) => a.add(r.amount), ZERO)
      return acc.add(new Prisma.Decimal(l.amount).sub(repaid))
    }, ZERO)

    // --- Capital invertido ---
    const capitalInventario = inventoryItems.reduce(
      (acc, i) => acc.add(i.costPrice ? new Prisma.Decimal(i.costPrice).mul(i.quantity) : ZERO),
      ZERO,
    )
    const capitalLaptops = ownDevices.reduce(
      (acc, d) => acc.add(d.totalCost ?? ZERO), ZERO,
    )

    // --- Metricas de laptops ---
    const ingresosVentasLaptops = soldProducts.reduce(
      (acc, p) => acc.add(p.askingPriceCRC), ZERO,
    )
    const gananciaNetaLaptops = soldProducts.reduce((acc, p) => {
      const cost = p.costCRC ?? p.device.totalCost ?? ZERO
      return acc.add(new Prisma.Decimal(p.askingPriceCRC).sub(cost))
    }, ZERO)

    // --- Ingresos por repuestos y servicios (cotizaciones pagadas) ---
    const ingresosRepuestos = convertedQuoteItems
      .filter((i) => i.itemType === 'part')
      .reduce((acc, i) => acc.add(i.subtotal), ZERO)
    const ingresosServicios = convertedQuoteItems
      .filter((i) => i.itemType === 'labor' || i.itemType === 'service')
      .reduce((acc, i) => acc.add(i.subtotal), ZERO)

    // --- Gastos ---
    const gastosTotales = expenseTxns._sum?.amount ?? ZERO
    const gastosHerramientas = toolsExpenses._sum?.amount ?? ZERO
    const gastosInfraestructura = infraExpenses._sum?.amount ?? ZERO

    // --- Ganancia liquida acumulada ---
    // = (ingresos laptops + repuestos + servicios) - gastos totales
    const gananciaLiquida = ingresosVentasLaptops
      .add(ingresosRepuestos)
      .add(ingresosServicios)
      .sub(gastosTotales)

    // --- Ordenes de trabajo ---
    const ordenesActivas = workOrderDevices.length
    const ordenesPorEstado: Record<string, number> = {}
    for (const wod of workOrderDevices) {
      ordenesPorEstado[wod.status] = (ordenesPorEstado[wod.status] ?? 0) + 1
    }
    // Ordenes atrasadas: activas y sin actualizar hace mas de 14 dias
    const hace14dias = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    const ordenesAtrasadas = workOrderDevices.filter((w) => w.updatedAt < hace14dias).length

    // --- Saldo por cobrar ---
    const saldoPorCobrar = unpaidQuotes.reduce((acc, q) => {
      const paid = q.payments.reduce((a, p) => a.add(p.amount), ZERO)
      const balance = new Prisma.Decimal(q.total).sub(paid)
      return acc.add(balance.gt(0) ? balance : ZERO)
    }, ZERO)

    // --- Productos por estado ---
    const productStatusMap: Record<string, number> = {}
    for (const p of productsByStatus) {
      productStatusMap[p.status] = p._count
    }

    // --- Garantias por vencer (proximos 30 dias) ---
    const en30dias = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const garantiasPorVencer = warranties
      .filter((w) => new Date(w.expiresAt) <= en30dias)
      .map((w) => ({ id: w.id, product: w.product.title, expiresAt: w.expiresAt }))

    return {
      // --- Saldos y capital ---
      totalBalance: totalBalance.toFixed(2),
      totalFunds: totalFunds.toFixed(2),
      totalOwnerDebt: totalOwnerDebt.toFixed(2),

      capitalInventario: capitalInventario.toFixed(2),
      capitalLaptops: capitalLaptops.toFixed(2),

      // --- Metricas de laptops ---
      ingresosVentasLaptops: ingresosVentasLaptops.toFixed(2),
      gananciaNetaLaptops: gananciaNetaLaptops.toFixed(2),

      // --- Ingresos por linea ---
      ingresosRepuestos: ingresosRepuestos.toFixed(2),
      ingresosServicios: ingresosServicios.toFixed(2),

      // --- Gastos ---
      gastosHerramientas: gastosHerramientas.toFixed(2),
      gastosInfraestructura: gastosInfraestructura.toFixed(2),
      gastosTotales: gastosTotales.toFixed(2),

      // --- Ganancia liquida ---
      gananciaLiquida: gananciaLiquida.toFixed(2),

      // --- Operaciones ---
      ordenesActivas,
      ordenesAtrasadas,
      ordenesPorEstado,
      cotizacionesPendientes: pendingQuotes,
      saldoPorCobrar: saldoPorCobrar.toFixed(2),

      // --- Inventario ---
      stockBajo: lowStockItems,
      valorInventarioCosto: capitalInventario.toFixed(2),

      // --- Productos ---
      productosDisponibles: productStatusMap['AVAILABLE'] ?? 0,
      productosReservados: productStatusMap['RESERVED'] ?? 0,
      productosProximamente: productStatusMap['COMING_SOON'] ?? 0,
      productosVendidos: productStatusMap['SOLD'] ?? 0,
      reservasActivas: activeReservations,

      // --- Garantias ---
      garantiasVigentes: warranties.length,
      garantiasPorVencer,

      // --- Cuentas y fondos (detalle) ---
      accounts: accounts.map((a) => ({ id: a.id, name: a.name, balance: a.balance.toFixed(2) })),
      funds: funds.map((f) => ({ id: f.id, name: f.name, balance: f.balance.toFixed(2) })),
    }
  })
}
