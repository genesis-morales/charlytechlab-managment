import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import { config } from './lib/config'
import { authenticate } from './lib/authenticate'
import { registerErrorHandler, AppError } from './lib/errors'
import { pagination } from './lib/validation'
import { authRoutes } from './modules/auth/auth.route'
import { customerRoutes } from './modules/customers/customer.route'
import { deviceRoutes } from './modules/devices/device.route'
import { workOrderRoutes } from './modules/workorders/workorder.route'
import { quoteRoutes } from './modules/quotes/quote.route'
import { financialRoutes } from './modules/financial/financial.route'
import { inventoryRoutes } from './modules/inventory/inventory.route'
import { importRoutes } from './modules/imports/import.route'
import { productRoutes } from './modules/products/product.route'
import { supplierRoutes } from './modules/suppliers/supplier.route'
import { dashboardRoutes } from './modules/dashboard/dashboard.route'
import { publicRoutes } from './modules/public/public.route'

export async function createApp() {
  const app = Fastify({
    bodyLimit: 256 * 1024,
    trustProxy: config.trustProxyHops > 0 ? (_address, hop) => hop < config.trustProxyHops : false,
    logger: {
      level: config.nodeEnv === 'test' ? 'silent' : 'info',
      redact: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-api-key"]', 'res.headers["set-cookie"]'],
      serializers: { req: (req) => ({ method: req.method, url: req.url?.split('?')[0] }) },
    },
  })
  registerErrorHandler(app)
  await app.register(rateLimit, {
    max: 300, timeWindow: '1 minute',
    errorResponseBuilder: () => ({ statusCode: 429, error: 'Demasiadas solicitudes. Intenta más tarde' }),
  })
  app.addHook('preValidation', async (req) => {
    const query = req.query as Record<string, unknown>
    if (query && !pagination.safeParse(query).success) throw new AppError(400, 'Paginación inválida; usa una página positiva y un límite de 1 a 100')
    for (const key of ['from', 'to']) {
      const value = query?.[key]
      if (value !== undefined && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) || !Number.isFinite(Date.parse(value)))) {
        throw new AppError(400, 'Rango de fechas inválido')
      }
    }
    if (query?.q !== undefined && (typeof query.q !== 'string' || query.q.length > 200)) throw new AppError(400, 'Búsqueda inválida')
    const params = req.params as Record<string, unknown>
    if (params && Object.values(params).some((value) => typeof value !== 'string' || value.length > 128)) throw new AppError(400, 'Identificador inválido')
  })
  app.addHook('onSend', async (_req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.header('Referrer-Policy', 'no-referrer')
    reply.header('Cache-Control', 'no-store')
  })

  // CORS: el frontend (Vercel) y el local dev comparten origen de peticiones
  await app.register(cors, {
    origin: config.isDev ? [config.frontend.url, 'http://localhost:5173'] : [config.frontend.url],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  })

  // JWT: una sola cuenta admin (decision A10)
  await app.register(jwt, {
    secret: config.jwt.secret,
    sign: { expiresIn: config.jwt.expiresIn, algorithm: 'HS256' },
    verify: { algorithms: ['HS256'] },
  })

  // Rutas publicas (web publica: catalogo, leads, reservas)
  await app.register(publicRoutes, { prefix: '/api/public' })

  // Login es público — debe registrarse fuera del bloque protegido
  await app.register(authRoutes, { prefix: '/api/auth' })

  // Rutas protegidas (CRM interno)
  await app.register(async (internal) => {
    internal.addHook('preHandler', authenticate)
    await internal.register(customerRoutes, { prefix: '/api/customers' })
    await internal.register(deviceRoutes, { prefix: '/api/devices' })
    await internal.register(workOrderRoutes, { prefix: '/api/workorders' })
    await internal.register(quoteRoutes, { prefix: '/api/quotes' })
    await internal.register(financialRoutes, { prefix: '/api/financial' })
    await internal.register(inventoryRoutes, { prefix: '/api/inventory' })
    await internal.register(importRoutes, { prefix: '/api/imports' })
    await internal.register(productRoutes, { prefix: '/api/products' })
    await internal.register(supplierRoutes, { prefix: '/api/suppliers' })
    await internal.register(dashboardRoutes, { prefix: '/api/dashboard' })
  })

  // Healthcheck para Render
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  return app
}
