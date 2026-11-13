import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ProductStatus } from '@prisma/client'
import { prisma } from '../../lib/db'
import { AppError } from '../../lib/errors'

const inquirySchema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().min(7).max(32),
  email: z.string().email().max(254).optional(),
  message: z.string().max(2000).optional(),
  productId: z.string().min(1).max(128).optional(),
})

export async function publicRoutes(app: FastifyInstance) {
  // GET /api/public/products
  app.get('/products', async (req) => {
    const { page = '1', limit = '20' } = req.query as Record<string, string>
    const skip = (Number(page) - 1) * Number(limit)

    const [total, products] = await Promise.all([
      prisma.product.count({
        where: { status: { in: [ProductStatus.AVAILABLE, ProductStatus.COMING_SOON] } },
      }),
      prisma.product.findMany({
        where: { status: { in: [ProductStatus.AVAILABLE, ProductStatus.COMING_SOON] } },
        orderBy: { publishedAt: 'desc' },
        skip,
        take: Number(limit),
        select: {
          id: true,
          title: true,
          description: true,
          askingPriceCRC: true,
          status: true,
          displaySpecs: true,
          publishedAt: true,
          photos: { orderBy: { position: 'asc' }, take: 1, select: { url: true, position: true } },
        },
      }),
    ])

    return {
      data: products,
      meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    }
  })

  // GET /api/public/products/:id
  app.get<{ Params: { id: string } }>('/products/:id', async (req, reply) => {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        title: true,
        description: true,
        askingPriceCRC: true,
        status: true,
        displaySpecs: true,
        publishedAt: true,
        photos: { orderBy: { position: 'asc' }, select: { url: true, position: true } },
        device: {
          select: { brand: true, model: true, deviceType: true, processor: true, ram: true, storage: true },
        },
      },
    })
    if (!product) return reply.code(404).send({ error: 'Producto no encontrado' })
    if (product.status !== 'AVAILABLE' && product.status !== 'COMING_SOON') return reply.code(404).send({ error: 'Producto no disponible' })
    return product
  })

  // POST /api/public/inquiries
  app.post('/inquiries', { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } }, async (req, reply) => {
    const body = inquirySchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    if (body.data.productId && !await prisma.product.findFirst({
      where: { id: body.data.productId, status: { in: ['AVAILABLE', 'COMING_SOON'] } }, select: { id: true },
    })) throw new AppError(404, 'Producto no disponible')

    const inquiry = await prisma.publicInquiry.create({
      data: {
        name: body.data.name,
        phone: body.data.phone,
        email: body.data.email,
        message: body.data.message,
        productId: body.data.productId,
      },
      select: { id: true },
    })
    return reply.code(201).send(inquiry)
  })
}
