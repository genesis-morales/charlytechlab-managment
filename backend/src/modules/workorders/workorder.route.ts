import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Prisma, WorkOrderDeviceStatus, DeviceOwnerType, PartRequestStatus } from '@prisma/client'
import { prisma } from '../../lib/db'
import { money } from '../../lib/validation'
import { isValidTransition, canTransitionTo, STATUS_LABELS } from './state-machine'

// Helper: convierte un objeto a InputJsonValue de Prisma de forma segura
function toJson(val: Record<string, unknown> | undefined): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (!val) return Prisma.DbNull
  return val as Prisma.InputJsonValue
}

// ---- Schemas ----

const createWorkOrderSchema = z.object({
  customerId: z.string().min(1),
  notes: z.string().optional(),
  devices: z.array(
    z.object({
      // Datos del dispositivo
      deviceType: z.string().min(1),
      brand: z.string().optional(),
      model: z.string().optional(),
      serialNumber: z.string().optional(),
      processor: z.string().optional(),
      ram: z.string().optional(),
      storage: z.string().optional(),
      specs: z.record(z.string(), z.unknown()).optional(),
      physicalCondition: z.string().optional(),
      accessories: z.string().optional(),
      notes: z.string().optional(),
      // Datos de la linea de trabajo
      problem: z.string().min(1, 'Describa el problema reportado'),
    }),
  ).min(1, 'Se requiere al menos un equipo').max(50),
})

const addDeviceSchema = z.object({
  deviceType: z.string().min(1),
  brand: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  processor: z.string().optional(),
  ram: z.string().optional(),
  storage: z.string().optional(),
  physicalCondition: z.string().optional(),
  accessories: z.string().optional(),
  notes: z.string().optional(),
  problem: z.string().min(1),
})

const transitionSchema = z.object({
  toStatus: z.nativeEnum(WorkOrderDeviceStatus),
  notes: z.string().optional(),
})

const diagnosisSchema = z.object({
  testsPerformed: z.string().optional(),
  findings: z.string().optional(),
  diagnosis: z.string().min(1),
  hasCost: z.boolean().default(false),
  diagnosticCost: money.optional(),
  notes: z.string().optional(),
})

const partRequestSchema = z.object({
  description: z.string().min(1),
  supplierId: z.string().optional(),
  purchaseLink: z.string().url().optional().or(z.literal('')),
  priceCRC: money.optional(),
  purchasedAt: z.string().datetime().optional(),
  estimatedArrival: z.string().datetime().optional(),
  notes: z.string().optional(),
})

const partTransitionSchema = z.object({
  toStatus: z.nativeEnum(PartRequestStatus),
  notes: z.string().optional(),
  inventoryItemId: z.string().optional(),
})

const hoursSchema = z.object({
  hoursWorked: z.number().min(0).max(9999.99).refine((value) => new Prisma.Decimal(value).decimalPlaces() <= 2),
})

// ---- Helper: generar numero de orden ----
async function nextOrderNumber(): Promise<string> {
  const count = await prisma.workOrder.count()
  const year = new Date().getFullYear()
  return `OT-${year}-${String(count + 1).padStart(4, '0')}`
}

export async function workOrderRoutes(app: FastifyInstance) {
  // GET /api/workorders — lista paginada
  app.get('/', async (req) => {
    const { q, customerId, status, page = '1', limit = '20' } =
      req.query as Record<string, string>
    const skip = (Number(page) - 1) * Number(limit)

    const where: any = {}
    if (customerId) where.customerId = customerId
    if (q) {
      where.OR = [
        { number: { contains: q, mode: 'insensitive' } },
        { customer: { name: { contains: q, mode: 'insensitive' } } },
      ]
    }
    if (status) {
      where.devices = { some: { status } }
    }

    const [total, orders] = await Promise.all([
      prisma.workOrder.count({ where }),
      prisma.workOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          devices: {
            select: {
              id: true,
              status: true,
              device: {
                select: { id: true, brand: true, model: true, deviceType: true },
              },
            },
          },
        },
      }),
    ])

    return {
      data: orders,
      meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    }
  })

  // GET /api/workorders/:id — orden completa con todo el historial
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const order = await prisma.workOrder.findUnique({
      where: { id: req.params.id },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        quotes: {
          select: { id: true, number: true, status: true, total: true, createdAt: true },
        },
        devices: {
          include: {
            device: true,
            history: { orderBy: { createdAt: 'desc' } },
            diagnoses: { orderBy: { createdAt: 'desc' } },
            partRequests: {
              include: {
                supplier: { select: { id: true, name: true } },
                statusHistory: { orderBy: { createdAt: 'desc' } },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    })

    if (!order) return reply.code(404).send({ error: 'Orden no encontrada' })
    return order
  })

  // POST /api/workorders — crear orden con uno o varios dispositivos
  app.post('/', async (req, reply) => {
    const body = createWorkOrderSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    const { customerId, notes, devices } = body.data

    const customer = await prisma.customer.findUnique({ where: { id: customerId } })
    if (!customer) return reply.code(404).send({ error: 'Cliente no encontrado' })

    const number = await nextOrderNumber()

    const order = await prisma.workOrder.create({
      data: {
        number,
        customerId,
        notes,
        devices: {
          create: devices.map((d) => ({
            problem: d.problem,
            status: WorkOrderDeviceStatus.RECEIVED,
            device: {
              create: {
                ownerType: DeviceOwnerType.CUSTOMER,
                customerId,
                deviceType: d.deviceType,
                brand: d.brand,
                model: d.model,
                serialNumber: d.serialNumber,
                processor: d.processor,
                ram: d.ram,
                storage: d.storage,
                specs: toJson(d.specs),
                physicalCondition: d.physicalCondition,
                accessories: d.accessories,
                notes: d.notes,
              },
            },
            history: {
              create: { toStatus: WorkOrderDeviceStatus.RECEIVED, notes: 'Recepción inicial' },
            },
          })),
        },
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        devices: {
          include: {
            device: { select: { id: true, brand: true, model: true, deviceType: true } },
          },
        },
      },
    })

    return reply.code(201).send(order)
  })

  // PATCH /api/workorders/:id — actualizar notas de la orden
  app.patch<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const { notes } = req.body as { notes?: string }
    const existing = await prisma.workOrder.findUnique({ where: { id: req.params.id } })
    if (!existing) return reply.code(404).send({ error: 'Orden no encontrada' })
    const updated = await prisma.workOrder.update({
      where: { id: req.params.id },
      data: { notes },
    })
    return { data: updated }
  })

  // POST /api/workorders/:id/devices — agregar un equipo a una orden existente
  app.post<{ Params: { id: string } }>('/:id/devices', async (req, reply) => {
    const body = addDeviceSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const order = await prisma.workOrder.findUnique({ where: { id: req.params.id } })
    if (!order) return reply.code(404).send({ error: 'Orden no encontrada' })

    // Crear el Device primero, luego el WorkOrderDevice (relacion obligatoria)
    const device = await prisma.device.create({
      data: {
        ownerType: DeviceOwnerType.CUSTOMER,
        customerId: order.customerId,
        deviceType: body.data.deviceType,
        brand: body.data.brand,
        model: body.data.model,
        serialNumber: body.data.serialNumber,
        processor: body.data.processor,
        ram: body.data.ram,
        storage: body.data.storage,
        physicalCondition: body.data.physicalCondition,
        accessories: body.data.accessories,
        notes: body.data.notes,
      },
    })

    const wod = await prisma.workOrderDevice.create({
      data: {
        workOrderId: req.params.id,
        deviceId: device.id,
        problem: body.data.problem,
        status: WorkOrderDeviceStatus.RECEIVED,
        history: {
          create: { toStatus: WorkOrderDeviceStatus.RECEIVED, notes: 'Equipo agregado a orden existente' },
        },
      },
      include: { device: true },
    })

    return reply.code(201).send(wod)
  })

  // POST /api/workorders/:id/devices/:wodId/transition — cambiar estado del dispositivo
  app.post<{ Params: { id: string; wodId: string } }>(
    '/:id/devices/:wodId/transition',
    async (req, reply) => {
      const body = transitionSchema.safeParse(req.body)
      if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

      const wod = await prisma.workOrderDevice.findFirst({
        where: { id: req.params.wodId, workOrderId: req.params.id },
      })
      if (!wod) return reply.code(404).send({ error: 'Dispositivo no encontrado en esta orden' })

      const toStatus = body.data.toStatus as WorkOrderDeviceStatus
      if (!isValidTransition(wod.status, toStatus)) {
        return reply.code(422).send({
          error: `Transición inválida: ${wod.status} → ${toStatus}`,
          allowedTransitions: canTransitionTo(wod.status).map((s) => ({
            status: s,
            label: STATUS_LABELS[s],
          })),
        })
      }

      const [updated] = await prisma.$transaction([
        prisma.workOrderDevice.update({
          where: { id: req.params.wodId },
          data: { status: toStatus },
        }),
        prisma.workOrderStatusHistory.create({
          data: {
            workOrderDeviceId: req.params.wodId,
            fromStatus: wod.status,
            toStatus,
            notes: body.data.notes,
          },
        }),
      ])

      return { data: updated }
    },
  )

  // POST /api/workorders/:id/devices/:wodId/diagnoses — registrar diagnostico
  app.post<{ Params: { id: string; wodId: string } }>(
    '/:id/devices/:wodId/diagnoses',
    async (req, reply) => {
      const body = diagnosisSchema.safeParse(req.body)
      if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

      const wod = await prisma.workOrderDevice.findFirst({
        where: { id: req.params.wodId, workOrderId: req.params.id },
      })
      if (!wod) return reply.code(404).send({ error: 'Dispositivo no encontrado' })

      const diag = await prisma.diagnosis.create({
        data: { workOrderDeviceId: req.params.wodId, ...body.data },
      })
      return reply.code(201).send(diag)
    },
  )

  // GET /api/workorders/:id/devices/:wodId/parts — listar solicitudes de repuesto
  app.get<{ Params: { id: string; wodId: string } }>(
    '/:id/devices/:wodId/parts',
    async (req, reply) => {
      const wod = await prisma.workOrderDevice.findFirst({ where: { id: req.params.wodId, workOrderId: req.params.id }, select: { id: true } })
      if (!wod) return reply.code(404).send({ error: 'Dispositivo no encontrado en esta orden' })
      const parts = await prisma.partRequest.findMany({
        where: { workOrderDeviceId: req.params.wodId },
        include: {
          supplier: { select: { id: true, name: true } },
          statusHistory: { orderBy: { createdAt: 'desc' } },
        },
        orderBy: { createdAt: 'desc' },
      })
      return { data: parts }
    },
  )

  // POST /api/workorders/:id/devices/:wodId/parts — agregar solicitud de repuesto
  app.post<{ Params: { id: string; wodId: string } }>(
    '/:id/devices/:wodId/parts',
    async (req, reply) => {
      const body = partRequestSchema.safeParse(req.body)
      if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

      const wod = await prisma.workOrderDevice.findFirst({
        where: { id: req.params.wodId, workOrderId: req.params.id },
      })
      if (!wod) return reply.code(404).send({ error: 'Dispositivo no encontrado' })

      const part = await prisma.partRequest.create({
        data: {
          workOrderDeviceId: req.params.wodId,
          description: body.data.description,
          supplierId: body.data.supplierId,
          purchaseLink: body.data.purchaseLink || undefined,
          priceCRC: body.data.priceCRC,
          purchasedAt: body.data.purchasedAt ? new Date(body.data.purchasedAt) : undefined,
          estimatedArrival: body.data.estimatedArrival
            ? new Date(body.data.estimatedArrival)
            : undefined,
          notes: body.data.notes,
          statusHistory: {
            create: { toStatus: 'TO_BUY' },
          },
        },
      })
      return reply.code(201).send(part)
    },
  )

  // POST /api/workorders/:id/devices/:wodId/parts/:partId/transition — cambiar estado del repuesto
  app.post<{ Params: { id: string; wodId: string; partId: string } }>(
    '/:id/devices/:wodId/parts/:partId/transition',
    async (req, reply) => {
      const body = partTransitionSchema.safeParse(req.body)
      if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

      const part = await prisma.partRequest.findFirst({
        where: { id: req.params.partId, workOrderDeviceId: req.params.wodId, workOrderDevice: { workOrderId: req.params.id } },
      })
      if (!part) return reply.code(404).send({ error: 'Solicitud de repuesto no encontrada' })

      const [updated] = await prisma.$transaction([
        prisma.partRequest.update({
          where: { id: req.params.partId },
          data: {
            status: body.data.toStatus as any,
            notes: body.data.notes ?? part.notes,
            inventoryItemId: body.data.inventoryItemId ?? part.inventoryItemId,
          },
        }),
        prisma.partRequestStatusHistory.create({
          data: {
            partRequestId: req.params.partId,
            fromStatus: part.status,
            toStatus: body.data.toStatus as any,
            notes: body.data.notes,
          },
        }),
      ])

      return { data: updated }
    },
  )

  // PATCH /api/workorders/:id/devices/:wodId/hours — registrar horas trabajadas (opcional A4)
  app.patch<{ Params: { id: string; wodId: string } }>(
    '/:id/devices/:wodId/hours',
    async (req, reply) => {
      const body = hoursSchema.safeParse(req.body)
      if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

      const wod = await prisma.workOrderDevice.findFirst({
        where: { id: req.params.wodId, workOrderId: req.params.id },
      })
      if (!wod) return reply.code(404).send({ error: 'Dispositivo no encontrado' })

      const updated = await prisma.workOrderDevice.update({
        where: { id: req.params.wodId },
        data: { hoursWorked: body.data.hoursWorked },
      })
      return { data: updated }
    },
  )
}
