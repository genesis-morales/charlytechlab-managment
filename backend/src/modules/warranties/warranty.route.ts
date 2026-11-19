import type { FastifyInstance } from 'fastify'
import { Prisma, type WarrantyCertificate } from '@prisma/client'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../../lib/db'
import { runOperation } from '../../lib/operation'
import { AppError } from '../../lib/errors'
import { certificateSource, certificateState, issuer, type CertificateSnapshot } from './certificate.service'
import { requireCertificateSchema } from './schema-readiness'

const sourceParams = z.object({ kind: z.enum(['sale', 'repair']), id: z.string().min(1).max(128) })
const issueSchema = z.object({
  customerId: z.string().min(1).max(128).optional(),
  description: z.string().trim().min(3).max(2000),
  serialNotApplicable: z.boolean().default(false),
  coverage: z.string().trim().min(5).max(3000),
  conditions: z.string().trim().min(5).max(5000),
  paymentReference: z.string().trim().max(500).optional(),
  paymentId: z.string().min(1).max(128).optional(),
  confirmed: z.literal(true),
}).strict()

function parseSource(value: unknown) {
  const parsed = sourceParams.safeParse(value)
  if (!parsed.success) throw new AppError(400, 'El origen del certificado no es válido')
  return parsed.data
}

function documentResult(certificate: WarrantyCertificate, active: boolean) {
  const { verificationToken, ...document } = certificate
  const snapshot = certificate.snapshot as unknown as CertificateSnapshot
  return { ...document, snapshot, verificationPath: `/garantias/verificar#${verificationToken}`, state: certificateState(certificate, active, snapshot) }
}

export async function warrantyRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireCertificateSchema)
  app.get('/sources/:kind/:id', async (req) => {
    const { kind, id } = parseSource(req.params)
    return prisma.$transaction(async (db) => {
      const source = await certificateSource(db, kind, id)
      const certificates = source.warranty ? await db.warrantyCertificate.findMany({
        where: { warrantyId: source.warranty.id }, orderBy: { version: 'desc' },
        select: { id: true, number: true, version: true, issuedAt: true, revokedAt: true },
      }) : []
      const payments = source.workOrderId ? await db.payment.findMany({
        where: { isVoided: false, quote: { workOrderId: source.workOrderId, OR: [{ customerId: source.customer?.id }, { customerId: null }] } },
        orderBy: { paidAt: 'desc' }, select: { id: true, reference: true, amount: true, paidAt: true }, take: 100,
      }) : []
      return {
        kind, id, eligible: source.eligible, unavailableReason: source.eligible ? null : source.unavailableReason,
        issuer, customer: source.customer ? { id: source.customer.id, name: source.customer.name } : null,
        device: { title: source.title, type: source.device.deviceType, serialNumber: source.device.serialNumber },
        operation: { reference: source.reference, date: source.operationDate },
        startsAt: source.startsAt, expiresAt: source.expiresAt, description: source.description,
        conditions: source.warranty?.terms ?? '', warrantyActive: source.warranty?.isActive ?? true,
        certificates, payments,
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })
  })

  app.post('/sources/:kind/:id/certificates', async (req, reply) => {
    const { kind, id } = parseSource(req.params)
    const body = issueSchema.safeParse(req.body)
    if (!body.success) throw new AppError(400, 'Completá la descripción, cobertura y condiciones, y confirmá los datos del certificado')
    const certificate = await runOperation(req, async (db) => {
      const source = await certificateSource(db, kind, id)
      if (!source.eligible) throw new AppError(422, source.unavailableReason)
      const now = new Date()
      if (!source.startsAt || !source.expiresAt || !source.operationDate || source.startsAt > now || source.expiresAt <= source.startsAt || source.operationDate > now) {
        throw new AppError(422, 'La operación no tiene fechas de garantía válidas')
      }
      if (source.warranty && !source.warranty.isActive) throw new AppError(422, 'La garantía no está activa')
      if (source.warranty?.customerId && source.customer?.id !== source.warranty.customerId) throw new AppError(422, 'El cliente de la garantía no coincide con la operación')
      const customerId = source.customer?.id ?? body.data.customerId
      if (!customerId || (source.customer && body.data.customerId && body.data.customerId !== source.customer.id)) throw new AppError(422, 'Seleccioná el cliente real de esta operación')
      const customer = await db.customer.findUnique({ where: { id: customerId }, select: { id: true, name: true, isActive: true } })
      if (!customer?.name.trim() || !customer.isActive) throw new AppError(422, 'El cliente no está disponible')
      const serial = source.device.serialNumber?.trim() || null
      if (!serial && !body.data.serialNotApplicable) throw new AppError(422, 'Registrá el número de serie o confirmá que no corresponde')
      if (serial && body.data.serialNotApplicable) throw new AppError(422, 'El equipo ya tiene un número de serie registrado')
      let paymentReference = body.data.paymentReference ?? ''
      if (body.data.paymentId) {
        if (!source.workOrderId) throw new AppError(422, 'Los pagos de cotizaciones no se pueden asociar automáticamente a esta venta')
        const payment = await db.payment.findFirst({
          where: { id: body.data.paymentId, isVoided: false, quote: { workOrderId: source.workOrderId, OR: [{ customerId }, { customerId: null }] } },
          select: { id: true, reference: true },
        })
        if (!payment) throw new AppError(422, 'El pago no corresponde a esta operación o está anulado')
        paymentReference = payment.reference?.trim() || payment.id
      }
      if (!paymentReference) throw new AppError(422, 'Indicá la referencia real del comprobante de la operación')
      let warranty = source.warranty
      if (!warranty) {
        warranty = await db.warranty.create({ data: {
          workOrderDeviceId: id, customerId, startsAt: source.startsAt, expiresAt: source.expiresAt,
        }, include: { customer: true } })
      } else if (!warranty.customerId) {
        warranty = await db.warranty.update({ where: { id: warranty.id }, data: { customerId }, include: { customer: true } })
      }
      if (await db.warrantyCertificate.findFirst({ where: { warrantyId: warranty.id, revokedAt: null }, select: { id: true } })) {
        throw new AppError(409, 'Esta garantía ya tiene un certificado activo. Consultalo o anulá su emisión antes de corregirlo')
      }
      const latest = await db.warrantyCertificate.aggregate({ where: { warrantyId: warranty.id }, _max: { version: true } })
      const version = (latest._max.version ?? 0) + 1
      const year = new Intl.DateTimeFormat('en', { timeZone: 'America/Costa_Rica', year: 'numeric' }).format(now)
      const number = `CTL-G-${year}-${randomBytes(6).toString('hex').toUpperCase()}`
      const snapshot: CertificateSnapshot = {
        schemaVersion: 1, issuer, number, version, issuedAt: now.toISOString(), kind,
        customer: { id: customer.id, name: customer.name },
        operation: { reference: source.reference, date: source.operationDate.toISOString() },
        device: { title: source.title, type: source.device.deviceType, serialNumber: serial, serialNotApplicable: !serial, description: body.data.description },
        startsAt: source.startsAt.toISOString(), expiresAt: source.expiresAt.toISOString(),
        coverage: body.data.coverage, conditions: body.data.conditions, paymentReference, paymentId: body.data.paymentId ?? null,
      }
      const created = await db.warrantyCertificate.create({ data: {
        warrantyId: warranty.id, number, version, issuedAt: now,
        issuedBy: (req.user as { sub: string }).sub, verificationToken: randomBytes(32).toString('base64url'),
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
      } })
      return documentResult(created, warranty.isActive)
    })
    return reply.code(201).send(certificate)
  })

  app.get<{ Params: { id: string } }>('/certificates/:id', async (req) => {
    const certificate = await prisma.warrantyCertificate.findUnique({ where: { id: req.params.id }, include: { warranty: { select: { isActive: true } } } })
    if (!certificate) throw new AppError(404, 'Certificado no encontrado')
    const { warranty, ...document } = certificate
    return documentResult(document, warranty.isActive)
  })

  app.post<{ Params: { id: string } }>('/certificates/:id/revoke', async (req) => {
    const body = z.object({ reason: z.string().trim().min(5).max(1000) }).strict().safeParse(req.body)
    if (!body.success) throw new AppError(400, 'Indicá el motivo de la anulación del certificado')
    return runOperation(req, async (db) => {
      const certificate = await db.warrantyCertificate.findUnique({ where: { id: req.params.id }, select: { id: true, revokedAt: true } })
      if (!certificate) throw new AppError(404, 'Certificado no encontrado')
      if (certificate.revokedAt) throw new AppError(409, 'La emisión de este certificado ya está anulada')
      const updated = await db.warrantyCertificate.update({ where: { id: certificate.id }, data: {
        revokedAt: new Date(), revokedBy: (req.user as { sub: string }).sub, revocationReason: body.data.reason,
      }, select: { id: true, revokedAt: true } })
      return updated
    })
  })
}

export async function publicCertificateRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireCertificateSchema)
  app.post('/certificates/verify', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req) => {
    const body = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict().safeParse(req.body)
    if (!body.success) throw new AppError(404, 'No se encontró una constancia con este enlace')
    const certificate = await prisma.warrantyCertificate.findUnique({ where: { verificationToken: body.data.token }, select: {
      number: true, issuedAt: true, revokedAt: true, snapshot: true, warranty: { select: { isActive: true } },
    } })
    if (!certificate) throw new AppError(404, 'No se encontró una constancia con este enlace')
    const snapshot = certificate.snapshot as unknown as CertificateSnapshot
    const equipment: Record<string, string> = { laptop: 'Laptop', desktop: 'Computadora de escritorio', celular: 'Celular', tablet: 'Tablet' }
    return {
      number: certificate.number, kind: snapshot.kind, equipment: equipment[snapshot.device.type] ?? 'Equipo',
      issuedAt: certificate.issuedAt, startsAt: snapshot.startsAt, expiresAt: snapshot.expiresAt,
      state: certificateState(certificate, certificate.warranty.isActive, snapshot),
    }
  })
}
