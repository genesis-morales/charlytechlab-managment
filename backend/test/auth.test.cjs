const test = require('node:test')
const assert = require('node:assert/strict')
const { randomBytes } = require('node:crypto')
const Fastify = require('fastify')
const jwt = require('@fastify/jwt')
const bcrypt = require('bcrypt')

// Isolated credentials and an unused local URL; never connect to the real database.
process.env.DATABASE_URL = 'postgresql://localhost/security_test'
process.env.JWT_SECRET = randomBytes(32).toString('hex')
process.env.CLOUDINARY_CLOUD_NAME = 'test'
process.env.CLOUDINARY_API_KEY = randomBytes(16).toString('hex')
process.env.CLOUDINARY_API_SECRET = randomBytes(16).toString('hex')
process.env.NODE_ENV = 'test'

const { authRoutes } = require('../dist/modules/auth/auth.route.js')
const { prisma } = require('../dist/lib/db.js')

test('authentication rejects unauthenticated requests and does not expose password hashes', async (t) => {
  const app = Fastify()
  await app.register(jwt, { secret: process.env.JWT_SECRET })
  await app.register(authRoutes, { prefix: '/api/auth' })
  await app.ready()
  t.after(async () => { await app.close(); await prisma.$disconnect() })

  let calls = 0
  const password = randomBytes(24).toString('hex')
  const user = { id: 'test-admin', name: 'Test', email: 'admin@example.invalid' }
  const passwordHash = await bcrypt.hash(password, 4)
  const originalFindUnique = prisma.user.findUnique
  t.after(() => { prisma.user.findUnique = originalFindUnique })
  // Prisma delegates use a proxy, so replace the method directly.
  prisma.user.findUnique = async (args) => {
    calls++
    if (args.where.email) return args.where.email === user.email ? { ...user, passwordHash } : null
    if (args.where.id !== user.id) return null
    assert.deepEqual(Object.keys(args.select).sort(), ['createdAt', 'email', 'id', 'name'])
    return { ...user, createdAt: new Date(0).toISOString() }
  }

  await t.test('missing, malformed and expired tokens return 401 without querying users', async () => {
    const tokens = [undefined, 'invalid', app.jwt.sign({ sub: user.id }, { expiresIn: -1 })]
    for (const token of tokens) {
      const response = await app.inject({
        method: 'GET', url: '/api/auth/me',
        headers: token ? { authorization: `Bearer ${token}` } : {},
      })
      assert.equal(response.statusCode, 401)
    }
    assert.equal(calls, 0)
  })

  await t.test('malformed login returns 400 before querying users', async () => {
    for (const payload of [{}, { email: user.email }, { email: user.email, password: 123 }, { email: 'invalid', password }]) {
      const response = await app.inject({ method: 'POST', url: '/api/auth/login', payload })
      assert.equal(response.statusCode, 400)
    }
    assert.equal(calls, 0)
  })

  await t.test('unknown account and incorrect password return 401', async () => {
    for (const payload of [{ email: 'unknown@example.invalid', password }, { email: user.email, password: randomBytes(16).toString('hex') }]) {
      const response = await app.inject({ method: 'POST', url: '/api/auth/login', payload })
      assert.equal(response.statusCode, 401)
      assert.equal(response.json().error, 'Credenciales inválidas')
    }
  })

  await t.test('valid login returns a usable token and only public user fields', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: user.email, password } })
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.json().user, user)
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { authorization: `Bearer ${response.json().token}` } })
    assert.equal(me.statusCode, 200)
    assert.equal(me.json().id, user.id)
    assert.ok(!('passwordHash' in me.json()))
  })

  await t.test('a valid token for a deleted user returns 401', async () => {
    const token = app.jwt.sign({ sub: 'deleted-user' })
    const response = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { authorization: `Bearer ${token}` } })
    assert.equal(response.statusCode, 401)
  })
})
