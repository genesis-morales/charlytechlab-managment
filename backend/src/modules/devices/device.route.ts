import type { FastifyInstance } from 'fastify'

export async function deviceRoutes(app: FastifyInstance) {
  app.get('/', async () => ({ data: [] }))
}
