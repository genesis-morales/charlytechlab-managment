import { Prisma } from '@prisma/client'
import { AppError } from '../../lib/errors'

export type CertificateKind = 'sale' | 'repair'
export const issuer = { name: 'Charly Tech Lab', location: 'Quepos, Puntarenas, Costa Rica', phone: '+506 7013-4952', instagram: '@charly.techlab' }

export interface CertificateSnapshot {
  schemaVersion: 1
  issuer: typeof issuer
  number: string
  version: number
  issuedAt: string
  kind: CertificateKind
  customer: { id: string; name: string }
  operation: { reference: string; date: string }
  device: { title: string; type: string; serialNumber: string | null; serialNotApplicable: boolean; description: string }
  startsAt: string
  expiresAt: string
  coverage: string
  conditions: string
  paymentReference: string
  paymentId: string | null
}

// Calendar months in the business timezone, independent of the server timezone.
export function addWarrantyMonths(date: Date, months: number): Date {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Costa_Rica', year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]))
  const local = Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second, date.getUTCMilliseconds())
  const offset = local - date.getTime()
  const targetMonth = values.month - 1 + months
  const lastDay = new Date(Date.UTC(values.year, targetMonth + 1, 0)).getUTCDate()
  return new Date(Date.UTC(values.year, targetMonth, Math.min(values.day, lastDay), values.hour, values.minute, values.second, date.getUTCMilliseconds()) - offset)
}

export async function certificateSource(db: Prisma.TransactionClient, kind: CertificateKind, id: string) {
  if (kind === 'sale') {
    const product = await db.product.findUnique({ where: { id }, include: { device: true, warranty: { include: { customer: true } } } })
    if (!product) throw new AppError(404, 'Producto no encontrado')
    const warranty = product.warranty
    return {
      kind, id, warranty, customer: warranty?.customer ?? null, device: product.device,
      title: product.title, description: product.description ?? product.title,
      reference: product.title, operationDate: product.soldAt,
      startsAt: warranty?.startsAt ?? null, expiresAt: warranty?.expiresAt ?? null,
      workOrderId: null as string | null,
      eligible: product.status === 'SOLD' && Boolean(warranty && product.soldAt),
      unavailableReason: 'Se necesita una venta registrada, su fecha y una garantía existente',
    }
  }
  const unit = await db.workOrderDevice.findUnique({
    where: { id }, include: {
      device: true, workOrder: { include: { customer: true } }, warranty: { include: { customer: true } },
      history: { where: { toStatus: 'DELIVERED' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 1 },
    },
  })
  if (!unit) throw new AppError(404, 'Equipo de la orden no encontrado')
  const deliveredAt = unit.history[0]?.createdAt ?? null
  const title = [unit.device.brand, unit.device.model].filter(Boolean).join(' ') || unit.device.deviceType
  return {
    kind, id, warranty: unit.warranty, customer: unit.workOrder.customer, device: unit.device,
    title, description: '', reference: unit.workOrder.number, operationDate: deliveredAt,
    startsAt: unit.warranty?.startsAt ?? deliveredAt,
    expiresAt: unit.warranty?.expiresAt ?? (deliveredAt ? addWarrantyMonths(deliveredAt, 3) : null),
    workOrderId: unit.workOrderId,
    eligible: Boolean(deliveredAt) && ['DELIVERED', 'CLOSED', 'WARRANTY_CLAIM'].includes(unit.status) &&
      unit.device.ownerType === 'CUSTOMER' && (!unit.device.customerId || unit.device.customerId === unit.workOrder.customerId),
    unavailableReason: 'El equipo debe tener una entrega registrada y pertenecer al cliente de esta orden',
  }
}

export function certificateState(certificate: { revokedAt: Date | string | null }, active: boolean, snapshot: CertificateSnapshot, now = new Date()) {
  if (certificate.revokedAt) return 'REVOKED'
  if (!active) return 'INACTIVE'
  if (now < new Date(snapshot.startsAt)) return 'NOT_STARTED'
  if (now >= new Date(snapshot.expiresAt)) return 'EXPIRED'
  return 'ACTIVE'
}
