const test = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID, randomBytes } = require('node:crypto')
const { execFileSync } = require('node:child_process')
const path = require('node:path')

const url = new URL(process.env.TEST_DATABASE_URL || 'http://invalid')
if (process.env.ISOLATED_DATABASE_TEST !== '1' || url.protocol !== 'postgresql:' || !['127.0.0.1', 'localhost'].includes(url.hostname) || !/^\/ctlab_test_[a-f0-9]+$/.test(url.pathname)) throw new Error('Se requiere PostgreSQL temporal aislado')
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
process.env.DIRECT_URL = process.env.TEST_DATABASE_URL
process.env.NODE_ENV = 'test'
const { PrismaClient } = require('@prisma/client')
const { createApp } = require('../dist/app.js')
const { prisma } = require('../dist/lib/db.js')
const { addWarrantyMonths, certificateState } = require('../dist/modules/warranties/certificate.service.js')
const { certificateSchemaAvailable } = require('../dist/modules/warranties/schema-readiness.js')

test('warranty certificates preserve records, privacy and their issued content', async t => {
  const app = await createApp()
  await app.ready()
  t.after(async () => { await app.close(); await prisma.$disconnect() })
  const user = await prisma.user.create({ data: { email: `cert-${randomUUID()}@example.invalid`, name: 'Certificate test', passwordHash: randomBytes(32).toString('hex') } })
  const authorization = `Bearer ${app.jwt.sign({ sub: user.id })}`
  const request = (method, route, payload, key = randomUUID()) => app.inject({ method, url: route, payload, headers: { authorization, 'idempotency-key': key } })
  const customer = () => prisma.customer.create({ data: { name: 'Cliente privado de prueba', phone: '55570000' } })
  const sale = async ({ withCustomer = true, expired = false } = {}) => {
    const c = await customer()
    const device = await prisma.device.create({ data: { ownerType: 'OWN', deviceType: 'laptop', model: 'Private test model', serialNumber: 'SERIE-PRIVADA', ownStatus: 'SOLD' } })
    const startsAt = new Date(Date.now() - (expired ? 730 : 1) * 86400000)
    const expiresAt = addWarrantyMonths(startsAt, 6)
    const product = await prisma.product.create({ data: { deviceId: device.id, title: 'Equipo privado vendido', askingPriceCRC: 100, status: 'SOLD', soldAt: startsAt } })
    const warranty = await prisma.warranty.create({ data: { productId: product.id, customerId: withCustomer ? c.id : undefined, startsAt, expiresAt } })
    return { c, device, product, warranty, route: `/api/warranties/sources/sale/${product.id}` }
  }
  const repair = async (status = 'DELIVERED', deliveredAt = new Date(Date.now() - 70 * 86400000)) => {
    const c = await customer()
    const order = await prisma.workOrder.create({ data: { customerId: c.id, number: 'OT-TEST-' + randomUUID() } })
    const device = await prisma.device.create({ data: { ownerType: 'CUSTOMER', customerId: c.id, deviceType: 'laptop', model: 'Repair test', serialNumber: 'SERIE-REPARACION' } })
    const unit = await prisma.workOrderDevice.create({ data: { workOrderId: order.id, deviceId: device.id, status, problem: 'Private diagnosis, never public' } })
    if (deliveredAt) await prisma.workOrderStatusHistory.create({ data: { workOrderDeviceId: unit.id, toStatus: 'DELIVERED', createdAt: deliveredAt } })
    return { c, device, order, unit, route: `/api/warranties/sources/repair/${unit.id}` }
  }
  const body = (overrides = {}) => ({ description: 'Detalle real de prueba <img src=x onerror=alert(1)>', coverage: 'Cobertura específica de prueba', conditions: 'Condiciones revisadas de prueba', paymentReference: 'COMPROBANTE-PRIVADO', confirmed: true, ...overrides })
  const issue = (fixture, data = body(), key) => request('POST', fixture.route + '/certificates', data, key)
  const verify = async certificate => app.inject({ method: 'POST', url: '/api/public/certificates/verify', payload: { token: certificate.verificationPath.split('#')[1] } })

  await t.test('migration preserves a legacy sale warranty and its claims', async () => {
    const database = 'ctlab_test_' + randomBytes(8).toString('hex')
    await prisma.$executeRawUnsafe(`CREATE DATABASE "${database}"`)
    let bin = process.env.PG_BIN || (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/18/bin' : '')
    if (!bin) bin = execFileSync('pg_config', ['--bindir'], { encoding: 'utf8' }).trim()
    const psql = args => execFileSync(path.join(bin, process.platform === 'win32' ? 'psql.exe' : 'psql'), ['-h', url.hostname, '-p', url.port, '-U', decodeURIComponent(url.username), '-d', database, '-v', 'ON_ERROR_STOP=1', ...args], { windowsHide: true, stdio: 'pipe', timeout: 20000 })
    for (const name of ['20261111210415_v1_crm_charlytechlab', '20261113000000_protect_operations']) psql(['-f', `backend/prisma/migrations/${name}/migration.sql`])
    psql(['-c', `INSERT INTO "Customer" (id,name,phone,"updatedAt") VALUES ('legacy-customer','Legacy test','55570000',CURRENT_TIMESTAMP);
      INSERT INTO "Device" (id,"ownerType","deviceType","updatedAt") VALUES ('legacy-device','OWN','laptop',CURRENT_TIMESTAMP);
      INSERT INTO "Product" (id,"deviceId",title,"askingPriceCRC","updatedAt") VALUES ('legacy-product','legacy-device','Legacy product',100,CURRENT_TIMESTAMP);
      INSERT INTO "Warranty" (id,"productId","customerId","startsAt","expiresAt",terms) VALUES ('legacy-warranty','legacy-product','legacy-customer','2026-01-31 18:00:00','2026-07-31 18:00:00','Legacy terms');
      INSERT INTO "WarrantyClaim" (id,"warrantyId",description,status,"updatedAt") VALUES ('legacy-claim','legacy-warranty','Legacy claim','open',CURRENT_TIMESTAMP);`])
    const copyUrl = new URL(url); copyUrl.pathname = '/' + database
    const copy = new PrismaClient({ datasources: { db: { url: copyUrl.toString() } }, log: [] })
    try {
      assert.equal(await certificateSchemaAvailable(copy), false)
      // Validate the real app against the pre-migration schema in a separate
      // process, so its Prisma singleton and readiness cache cannot mix targets.
      psql(['-c', `INSERT INTO "User" (id,email,"passwordHash",name,"updatedAt") VALUES ('legacy-admin','legacy@example.invalid','synthetic-hash','Legacy admin',CURRENT_TIMESTAMP);`])
      const legacyCode = `
        const { createApp } = require('./backend/dist/app.js');
        const { prisma } = require('./backend/dist/lib/db.js');
        (async()=>{const app=await createApp();const auth='Bearer '+app.jwt.sign({sub:'legacy-admin'});
        for(const route of ['/api/products/legacy-product','/api/products/legacy-product/warranty','/api/customers/legacy-customer','/api/dashboard']){
          const r=await app.inject({method:'GET',url:route,headers:{authorization:auth}});if(r.statusCode!==200)throw Error('Legacy flow failed');}
        const pending=await app.inject({method:'GET',url:'/api/warranties/sources/sale/legacy-product',headers:{authorization:auth}});
        if(pending.statusCode!==503)throw Error('New module must wait for migration');
        await app.close();await prisma.$disconnect();})().catch(()=>process.exit(1));`
      const copyEnv = { ...process.env, DATABASE_URL: copyUrl.toString(), DIRECT_URL: copyUrl.toString() }
      execFileSync(process.execPath, ['-e', legacyCode], { env: copyEnv, windowsHide: true, stdio: 'pipe', timeout: 30000 })
      psql(['-f', 'backend/prisma/migrations/20261117000000_warranty_certificates/migration.sql'])
      assert.equal(await certificateSchemaAvailable(copy), true)
      const legacy = await copy.warranty.findUnique({ where: { id: 'legacy-warranty' }, include: { claims: true } })
      assert.equal(legacy.productId, 'legacy-product'); assert.equal(legacy.customerId, 'legacy-customer')
      assert.equal(legacy.workOrderDeviceId, null); assert.equal(legacy.terms, 'Legacy terms')
      assert.equal(legacy.startsAt.toISOString(), '2026-01-31T18:00:00.000Z')
      assert.equal(legacy.expiresAt.toISOString(), '2026-07-31T18:00:00.000Z')
      assert.equal(legacy.claims[0].id, 'legacy-claim')
      assert.equal(await copy.warrantyCertificate.count(), 0)
      await assert.rejects(copy.warranty.create({ data: { startsAt: new Date(), expiresAt: new Date(Date.now() + 86400000) } }))
      const env = { ...process.env, DATABASE_URL: copyUrl.toString(), DIRECT_URL: copyUrl.toString() }
      execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-schema-datasource', 'backend/prisma/schema.prisma', '--to-schema-datamodel', 'backend/prisma/schema.prisma', '--exit-code'], { env, windowsHide: true, stdio: 'pipe', timeout: 30000 })
    } finally { await copy.$disconnect() }
  })

  await t.test('all private certificate actions require a session', async () => {
    for (const [method, route] of [['GET', '/api/warranties/sources/sale/missing'], ['POST', '/api/warranties/sources/sale/missing/certificates'], ['GET', '/api/warranties/certificates/missing'], ['POST', '/api/warranties/certificates/missing/revoke']]) {
      assert.equal((await app.inject({ method, url: route, payload: method === 'POST' ? body() : undefined })).statusCode, 401)
    }
    assert.equal((await request('GET', '/api/warranties/sources/unknown/missing')).statusCode, 400)
  })

  await t.test('sale issue and replay retain dates, bind only a real customer, and public output stays minimal', async () => {
    const fixture = await sale({ withCustomer: false })
    assert.equal((await issue(fixture)).statusCode, 422)
    const key = randomUUID(), input = body({ customerId: fixture.c.id })
    const response = await issue(fixture, input, key)
    assert.equal(response.statusCode, 201)
    const certificate = response.json()
    assert.equal(certificate.snapshot.customer.name, fixture.c.name)
    assert.equal(certificate.snapshot.startsAt, fixture.warranty.startsAt.toISOString())
    assert.equal(certificate.snapshot.expiresAt, fixture.warranty.expiresAt.toISOString())
    assert.equal(certificate.snapshot.issuer.location, 'Quepos, Puntarenas, Costa Rica')
    assert.equal(certificate.snapshot.version, 1)
    const replay = await issue(fixture, input, key)
    assert.equal(replay.statusCode, 201); assert.equal(replay.json().id, certificate.id)
    assert.equal((await issue(fixture, body({ customerId: fixture.c.id, coverage: 'Changed scope' }), key)).statusCode, 409)
    assert.equal((await issue(fixture, input)).statusCode, 409)
    assert.equal(await prisma.warrantyCertificate.count({ where: { warrantyId: fixture.warranty.id } }), 1)
    const publicResponse = await verify(certificate)
    assert.equal(publicResponse.statusCode, 200)
    assert.deepEqual(Object.keys(publicResponse.json()).sort(), ['number','kind','equipment','issuedAt','startsAt','expiresAt','state'].sort())
    assert.equal(publicResponse.json().state, 'ACTIVE')
    for (const secret of [fixture.c.name, fixture.c.phone, fixture.device.serialNumber, 'COMPROBANTE-PRIVADO', fixture.product.id, certificate.verificationPath.split('#')[1]]) assert.ok(!publicResponse.body.includes(secret))
    await prisma.customer.update({ where: { id: fixture.c.id }, data: { name: 'Changed customer' } })
    await prisma.product.update({ where: { id: fixture.product.id }, data: { title: 'Changed product' } })
    const fetched = await request('GET', `/api/warranties/certificates/${certificate.id}`)
    assert.deepEqual(fetched.json().snapshot, certificate.snapshot)
    await assert.rejects(prisma.warrantyCertificate.update({ where: { id: certificate.id }, data: { snapshot: { replaced: true } } }))
    await assert.rejects(prisma.warrantyCertificate.delete({ where: { id: certificate.id } }))
  })

  await t.test('simultaneous issue produces one active certificate and identical retries share their result', async () => {
    const fixture = await sale(), key = randomUUID()
    const responses = await Promise.all([issue(fixture, body(), key), issue(fixture, body(), key)])
    assert.ok(responses.every(response => response.statusCode === 201)); assert.equal(responses[0].json().id, responses[1].json().id)
    const other = await sale()
    const competing = await Promise.all([issue(other), issue(other)])
    assert.equal(competing.filter(response => response.statusCode === 201).length, 1)
    assert.ok(competing.every(response => [201,409].includes(response.statusCode)))
    assert.equal(await prisma.warrantyCertificate.count({ where: { warrantyId: other.warranty.id, revokedAt: null } }), 1)
  })

  await t.test('repair eligibility, calendar months, payment membership and per-device coverage are enforced', async () => {
    assert.equal(addWarrantyMonths(new Date('2026-02-01T02:00:00Z'), 3).toISOString(), '2026-05-01T02:00:00.000Z')
    assert.equal(addWarrantyMonths(new Date('2028-02-29T18:00:00Z'), 12).toISOString(), '2029-02-28T18:00:00.000Z')
    const pending = await repair('REPAIRING', null)
    assert.equal((await issue(pending)).statusCode, 422)
    const fixture = await repair()
    const quote = await prisma.quote.create({ data: { number: randomUUID(), workOrderId: fixture.order.id, customerId: fixture.c.id, status: 'APPROVED', total: 100 } })
    const payment = await prisma.payment.create({ data: { quoteId: quote.id, amount: 50, method: 'CASH', reference: 'REPAIR-REFERENCE' } })
    const foreignQuote = await prisma.quote.create({ data: { number: randomUUID(), total: 1 } })
    const foreignPayment = await prisma.payment.create({ data: { quoteId: foreignQuote.id, amount: 1, method: 'CASH' } })
    assert.equal((await issue(fixture, body({ paymentId: foreignPayment.id }))).statusCode, 422)
    const response = await issue(fixture, body({ paymentId: payment.id, paymentReference: undefined }))
    assert.equal(response.statusCode, 201)
    const certificate = response.json()
    assert.equal(certificate.snapshot.kind, 'repair'); assert.equal(certificate.snapshot.operation.reference, fixture.order.number)
    assert.equal(certificate.snapshot.paymentReference, 'REPAIR-REFERENCE')
    const warranty = await prisma.warranty.findUnique({ where: { workOrderDeviceId: fixture.unit.id } })
    assert.equal(warranty.productId, null)
    assert.equal(certificate.snapshot.expiresAt, addWarrantyMonths(warranty.startsAt, 3).toISOString())
    const c = await request('GET', `/api/customers/${fixture.c.id}`)
    assert.equal(c.statusCode, 200); assert.equal(c.json().warranties[0].product, null)
    assert.equal(c.json().warranties[0].workOrderDevice.workOrder.number, fixture.order.number)
    assert.equal((await request('GET', '/api/dashboard')).statusCode, 200)
    await assert.rejects(prisma.warranty.update({ where: { id: warranty.id }, data: { productId: (await sale()).product.id } }))
    const cancelled = await repair('CLOSED', null)
    assert.equal((await issue(cancelled)).statusCode, 422)
  })

  await t.test('missing series or receipt, wrong customer, future dates and void payments cannot issue', async () => {
    const fixture = await sale()
    assert.equal((await issue(fixture, body({ confirmed: false }))).statusCode, 400)
    assert.equal((await issue(fixture, body({ customerId: (await customer()).id }))).statusCode, 422)
    assert.equal((await issue(fixture, body({ paymentReference: '' }))).statusCode, 422)
    await prisma.device.update({ where: { id: fixture.device.id }, data: { serialNumber: null } })
    assert.equal((await issue(fixture)).statusCode, 422)
    assert.equal((await issue(fixture, body({ serialNotApplicable: true }))).statusCode, 201)
    const future = await sale()
    await prisma.warranty.update({ where: { id: future.warranty.id }, data: { startsAt: new Date(Date.now() + 86400000) } })
    assert.equal((await issue(future)).statusCode, 422)
    const repairFixture = await repair()
    const q = await prisma.quote.create({ data: { number: randomUUID(), workOrderId: repairFixture.order.id, total: 10 } })
    const p = await prisma.payment.create({ data: { quoteId: q.id, amount: 10, method: 'CASH', isVoided: true } })
    assert.equal((await issue(repairFixture, body({ paymentId: p.id }))).statusCode, 422)
  })

  await t.test('revocation preserves the warranty and enables a new immutable version', async () => {
    const fixture = await sale()
    const first = (await issue(fixture)).json()
    const key = randomUUID(), route = `/api/warranties/certificates/${first.id}/revoke`
    assert.equal((await request('POST', route, { reason: 'Private correction reason' }, key)).statusCode, 200)
    assert.equal((await request('POST', route, { reason: 'Private correction reason' }, key)).statusCode, 200)
    assert.equal((await verify(first)).json().state, 'REVOKED')
    assert.ok(!(await verify(first)).body.includes('Private correction reason'))
    const warranty = await prisma.warranty.findUnique({ where: { id: fixture.warranty.id } })
    assert.equal(warranty.isActive, true); assert.equal(warranty.expiresAt.toISOString(), fixture.warranty.expiresAt.toISOString())
    const second = await issue(fixture, body({ coverage: 'Corrected coverage for new version' }))
    assert.equal(second.statusCode, 201); assert.equal(second.json().version, 2)
    assert.notEqual(second.json().verificationPath, first.verificationPath)
    assert.equal((await verify(second.json())).json().state, 'ACTIVE')
    assert.equal((await request('GET', fixture.route)).json().certificates.length, 2)
  })

  await t.test('audit failures roll back repair warranty, issue and revocation with no false receipts', async () => {
    const fixture = await repair(), existing = await sale()
    const issued = (await issue(existing)).json()
    await prisma.$executeRawUnsafe(`CREATE FUNCTION fail_certificate_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic certificate audit failure'; END $$`)
    await prisma.$executeRawUnsafe('CREATE TRIGGER fail_certificate_audit BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION fail_certificate_audit()')
    const key = randomUUID(), revokeKey = randomUUID()
    try {
      assert.equal((await issue(fixture, body(), key)).statusCode, 500)
      assert.equal(await prisma.warranty.count({ where: { workOrderDeviceId: fixture.unit.id } }), 0)
      assert.equal(await prisma.idempotencyRecord.count({ where: { userId: user.id, key } }), 0)
      assert.equal((await request('POST', `/api/warranties/certificates/${issued.id}/revoke`, { reason: 'Rollback correction' }, revokeKey)).statusCode, 500)
      assert.equal((await prisma.warrantyCertificate.findUnique({ where: { id: issued.id } })).revokedAt, null)
      assert.equal(await prisma.idempotencyRecord.count({ where: { userId: user.id, key: revokeKey } }), 0)
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER fail_certificate_audit ON "AuditLog"')
      await prisma.$executeRawUnsafe('DROP FUNCTION fail_certificate_audit()')
    }
    assert.equal((await issue(fixture, body(), key)).statusCode, 201)
  })

  await t.test('verification reports expiry/inactivity, rejects invalid links and limits repeated lookup', async () => {
    const fixture = await sale({ expired: true }), certificate = (await issue(fixture)).json()
    assert.equal((await verify(certificate)).json().state, 'EXPIRED')
    await prisma.warranty.update({ where: { id: fixture.warranty.id }, data: { isActive: false } })
    assert.equal((await verify(certificate)).json().state, 'INACTIVE')
    assert.equal(certificateState({ revokedAt: null }, true, { startsAt: '2099-01-01', expiresAt: '2099-02-01' }), 'NOT_STARTED')
    for (const token of ['', 'bad', 'A'.repeat(43)]) assert.equal((await app.inject({ method: 'POST', url: '/api/public/certificates/verify', payload: { token } })).statusCode, 404)
    const invalidToken = randomBytes(32).toString('base64url')
    for (let i = 0; i < 21; i++) {
      const response = await app.inject({ method: 'POST', url: '/api/public/certificates/verify', remoteAddress: '127.0.0.91', headers: { 'x-forwarded-for': `203.0.113.${i}` }, payload: { token: invalidToken } })
      assert.equal(response.statusCode, i < 20 ? 404 : 429)
    }
  })
})
