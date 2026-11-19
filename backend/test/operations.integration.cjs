const test = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID, randomBytes } = require('node:crypto')
const { Writable } = require('node:stream')

// Explicitly fail rather than falling back to a developer's real database.
const url = new URL(process.env.TEST_DATABASE_URL || 'http://invalid')
if (process.env.ISOLATED_DATABASE_TEST !== '1' || url.protocol !== 'postgresql:' ||
    !['127.0.0.1', 'localhost'].includes(url.hostname) || !/^\/ctlab_test_[a-f0-9]+$/.test(url.pathname)) {
  throw new Error('Estas pruebas solo se ejecutan con scripts/run-integration.mjs y una base temporal aislada')
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
process.env.DIRECT_URL = process.env.TEST_DATABASE_URL
process.env.NODE_ENV = 'test'
const { createApp } = require('../dist/app.js')
const { prisma } = require('../dist/lib/db.js')

test('operations preserve data under concurrency, retries and database failures', async (t) => {
  const app = await createApp()
  await app.ready()
  t.after(async () => { await app.close(); await prisma.$disconnect() })
  const user = await prisma.user.create({ data: { email: 'admin@example.invalid', name: 'Test', passwordHash: randomBytes(32).toString('hex') } })
  const authorization = `Bearer ${app.jwt.sign({ sub: user.id })}`
  const request = (method, path, payload, key = randomUUID()) => app.inject({
    method, url: `/api${path}`, payload,
    headers: { authorization, 'idempotency-key': key },
  })
  const account = async (balance = 0) => prisma.financialAccount.create({ data: { name: 'Test account', balance } })
  const item = async (quantity) => prisma.inventoryItem.create({ data: { name: 'Test stock', category: 'SPARE_PART', quantity } })
  const quote = async (total) => prisma.quote.create({ data: { number: randomUUID(), total, status: 'APPROVED' } })
  const product = async () => {
    const device = await prisma.device.create({ data: { ownerType: 'OWN', deviceType: 'laptop', ownStatus: 'LISTED', notes: 'private device notes', serialNumber: 'private serial' } })
    return prisma.product.create({ data: { deviceId: device.id, title: 'Test product', askingPriceCRC: 100, costCRC: 20, status: 'AVAILABLE' } })
  }

  await t.test('all administrative modules reject missing JWTs', async () => {
    for (const route of ['customers', 'devices', 'workorders', 'quotes', 'financial/accounts', 'inventory', 'imports', 'products', 'suppliers', 'dashboard', 'auth/me']) {
      const response = await app.inject({ method: 'GET', url: `/api/${route}` })
      assert.equal(response.statusCode, 401, route)
    }
    for (const payload of [{}, { sub: 'deleted-user' }]) {
      const response = await app.inject({ method: 'GET', url: '/api/financial/accounts', headers: { authorization: `Bearer ${app.jwt.sign(payload)}` } })
      assert.equal(response.statusCode, 401)
    }
  })

  await t.test('duplicate confirmation credits an account exactly once', async () => {
    const a = await account()
    const tx = await prisma.financialTransaction.create({ data: { type: 'INCOME', amount: 100, description: 'Test credit', accountId: a.id } })
    const results = await Promise.all([request('POST', `/financial/transactions/${tx.id}/confirm`, { confirm: true }), request('POST', `/financial/transactions/${tx.id}/confirm`, { confirm: true })])
    assert.equal(results.filter((r) => r.statusCode === 200).length, 1)
    assert.ok(results.every((r) => [200, 409, 422].includes(r.statusCode)))
    assert.equal((await prisma.financialAccount.findUnique({ where: { id: a.id } })).balance.toFixed(2), '100.00')
  })

  await t.test('same operation key replays a payment; a changed payload is rejected', async () => {
    const q = await quote(100)
    const key = randomUUID()
    const results = await Promise.all([request('POST', `/quotes/${q.id}/payments`, { amount: 60, method: 'CASH' }, key), request('POST', `/quotes/${q.id}/payments`, { amount: 60, method: 'CASH' }, key)])
    assert.ok(results.every((r) => r.statusCode === 201))
    assert.equal(results[0].json().id, results[1].json().id)
    assert.equal(await prisma.payment.count({ where: { quoteId: q.id } }), 1)
    assert.equal((await request('POST', `/quotes/${q.id}/payments`, { amount: 10, method: 'CASH' }, key)).statusCode, 409)
    assert.equal((await request('POST', `/quotes/${q.id}/payments`, { amount: 10, method: 'CASH' }, '')).statusCode, 400)
  })

  await t.test('concurrent payments cannot exceed the outstanding balance', async () => {
    const q = await quote(100)
    const results = await Promise.all([request('POST', `/quotes/${q.id}/payments`, { amount: 80, method: 'CASH' }), request('POST', `/quotes/${q.id}/payments`, { amount: 80, method: 'CASH' })])
    assert.equal(results.filter((r) => r.statusCode === 201).length, 1)
    assert.ok(results.every((r) => [201, 409, 422].includes(r.statusCode)))
    const payments = await prisma.payment.aggregate({ where: { quoteId: q.id }, _sum: { amount: true } })
    assert.equal(payments._sum.amount.toFixed(2), '80.00')
  })

  await t.test('concurrent payment voids update the quote and payment once', async () => {
    const q = await quote(100)
    const payment = await request('POST', `/quotes/${q.id}/payments`, { amount: 100, method: 'CASH' })
    assert.equal(payment.statusCode, 201)
    const results = await Promise.all([request('POST', `/quotes/${q.id}/payments/${payment.json().id}/void`, { reason: 'Test reversal' }), request('POST', `/quotes/${q.id}/payments/${payment.json().id}/void`, { reason: 'Test reversal' })])
    assert.equal(results.filter((r) => r.statusCode === 200).length, 1)
    assert.equal((await prisma.quote.findUnique({ where: { id: q.id } })).status, 'APPROVED')
  })

  await t.test('quote editing preserves payments and rounds line totals consistently', async () => {
    const q = await prisma.quote.create({ data: { number: randomUUID(), total: 100, status: 'DRAFT' } })
    assert.equal((await request('POST', `/quotes/${q.id}/payments`, { amount: 60, method: 'CASH' })).statusCode, 201)
    const reduced = await request('PATCH', `/quotes/${q.id}`, { items: [{ description: 'Reduced', itemType: 'service', unitPrice: 50 }] })
    assert.equal(reduced.statusCode, 422)
    assert.equal((await prisma.quote.findUnique({ where: { id: q.id } })).total.toFixed(2), '100.00')
    assert.equal((await request('POST', `/quotes/${q.id}/reject`, { reason: 'Invalid rejection' })).statusCode, 422)
    const key = randomUUID()
    const payload = { items: [1, 2].map((index) => ({ description: `Fraction ${index}`, itemType: 'service', quantity: 0.5, unitPrice: 0.01 })) }
    const created = await request('POST', '/quotes', payload, key)
    assert.equal(created.statusCode, 201)
    assert.equal(created.json().total, '0.02')
    assert.equal((await request('POST', '/quotes', payload, key)).json().id, created.json().id)
  })

  await t.test('stock cannot be oversold, assigned directly or adjusted below zero', async () => {
    const stock = await item(1)
    const results = await Promise.all([request('POST', `/inventory/${stock.id}/movements`, { type: 'SALE', quantity: 1 }), request('POST', `/inventory/${stock.id}/movements`, { type: 'SALE', quantity: 1 })])
    assert.equal(results.filter((r) => r.statusCode === 201).length, 1)
    assert.equal((await prisma.inventoryItem.findUnique({ where: { id: stock.id } })).quantity, 0)
    assert.equal(await prisma.inventoryMovement.count({ where: { inventoryItemId: stock.id } }), 1)
    assert.equal((await request('POST', `/inventory/${stock.id}/adjust`, { newQuantity: -1, reason: 'invalid' })).statusCode, 400)
    assert.equal((await request('PATCH', `/inventory/${stock.id}`, { quantity: 50 })).statusCode, 400)
    assert.equal((await request('POST', `/inventory/${stock.id}/movements`, { type: 'ADJUSTMENT', quantity: 5 })).statusCode, 400)
    assert.equal((await request('POST', '/inventory', { name: 'Invalid', category: 'SPARE_PART', quantity: -1 })).statusCode, 400)
    const entry = await request('POST', `/inventory/${stock.id}/movements`, { type: 'ENTRY', quantity: 1, unitCost: 0 })
    assert.equal(entry.statusCode, 201)
    assert.equal((await prisma.inventoryItem.findUnique({ where: { id: stock.id } })).costPrice.toFixed(2), '0.00')
  })

  await t.test('transfers are paired, do not become income, and reverse both balances once', async () => {
    const from = await account(100)
    const to = await account(0)
    const key = randomUUID()
    const payload = { fromAccountId: from.id, toAccountId: to.id, amount: 30, description: 'Test transfer' }
    const response = await request('POST', '/financial/transfer', payload, key)
    assert.equal(response.statusCode, 201)
    const { egress, income } = response.json()
    assert.equal(egress.type, 'TRANSFER')
    assert.equal(income.type, 'TRANSFER')
    assert.equal(egress.transferId, income.transferId)
    assert.equal((await request('POST', '/financial/transfer', payload, key)).json().income.id, income.id)
    assert.equal((await prisma.financialAccount.findUnique({ where: { id: from.id } })).balance.toFixed(2), '70.00')
    const ledger = await request('GET', '/financial/ledger')
    assert.ok(ledger.json().data.some((row) => row.tipo === 'TRANSFER' && row.debe === '30.00'))
    assert.ok(ledger.json().data.some((row) => row.tipo === 'TRANSFER' && row.haber === '30.00'))
    const voidKey = randomUUID()
    const reversed = await request('POST', `/financial/transactions/${egress.id}/void`, { reason: 'Test reversal' }, voidKey)
    assert.equal(reversed.statusCode, 204)
    assert.equal((await request('POST', `/financial/transactions/${egress.id}/void`, { reason: 'Test reversal' }, voidKey)).statusCode, 204)
    assert.equal((await prisma.financialAccount.findUnique({ where: { id: from.id } })).balance.toFixed(2), '100.00')
    assert.equal((await prisma.financialAccount.findUnique({ where: { id: to.id } })).balance.toFixed(2), '0.00')
    assert.equal(await prisma.financialTransaction.count({ where: { transferId: egress.transferId, isVoided: true } }), 2)
  })

  await t.test('a movement and its fund are reversed once under competing requests', async () => {
    const a = await account(100)
    const fund = await prisma.fund.create({ data: { name: 'Test fund', balance: 100 } })
    const tx = await prisma.financialTransaction.create({ data: { type: 'EXPENSE', amount: 40, description: 'Test debit', accountId: a.id, fundId: fund.id } })
    assert.equal((await request('POST', `/financial/transactions/${tx.id}/confirm`, { confirm: true })).statusCode, 200)
    const results = await Promise.all([request('POST', `/financial/transactions/${tx.id}/void`, { reason: 'Reverse' }), request('POST', `/financial/transactions/${tx.id}/void`, { reason: 'Reverse' })])
    assert.equal(results.filter((r) => r.statusCode === 204).length, 1)
    assert.equal((await prisma.financialAccount.findUnique({ where: { id: a.id } })).balance.toFixed(2), '100.00')
    assert.equal((await prisma.fund.findUnique({ where: { id: fund.id } })).balance.toFixed(2), '100.00')
  })

  await t.test('purchase retries do not duplicate purchased stock', async () => {
    const stock = await item(0)
    const payload = { purchasedAt: new Date().toISOString(), items: [{ description: 'Test purchase', quantity: 2, unitCostCRC: 10, inventoryItemId: stock.id }] }
    const key = randomUUID()
    const results = await Promise.all([request('POST', '/suppliers/purchases', payload, key), request('POST', '/suppliers/purchases', payload, key)])
    assert.ok(results.every((r) => r.statusCode === 201))
    assert.equal(results[0].json().id, results[1].json().id)
    assert.equal((await prisma.inventoryItem.findUnique({ where: { id: stock.id } })).quantity, 2)
    assert.equal(await prisma.inventoryMovement.count({ where: { inventoryItemId: stock.id } }), 1)
  })

  await t.test('inactive accounts and incomplete transfers cannot change balances', async () => {
    const a = await prisma.financialAccount.create({ data: { name: 'Inactive account', isActive: false, balance: 0 } })
    const tx = await prisma.financialTransaction.create({ data: { type: 'INCOME', amount: 10, description: 'Invalid destination', accountId: a.id } })
    assert.equal((await request('POST', `/financial/transactions/${tx.id}/confirm`, { confirm: true })).statusCode, 422)
    const loansBefore = await prisma.ownerLoan.count()
    assert.equal((await request('POST', '/financial/owner-loans', { amount: 10, loanedAt: new Date().toISOString(), accountId: a.id })).statusCode, 422)
    assert.equal(await prisma.ownerLoan.count(), loansBefore)
    assert.equal((await prisma.financialAccount.findUnique({ where: { id: a.id } })).balance.toFixed(2), '0.00')
    const active = await account(100)
    const response = await request('POST', '/financial/transfer', { fromAccountId: active.id, toAccountId: 'missing', amount: 10, description: 'Invalid transfer' })
    assert.equal(response.statusCode, 422)
    assert.equal((await prisma.financialAccount.findUnique({ where: { id: active.id } })).balance.toFixed(2), '100.00')
  })

  await t.test('loan repayments cannot exceed the debt and ledger void cannot bypass the loan', async () => {
    const a = await account()
    const response = await request('POST', '/financial/owner-loans', { amount: 100, loanedAt: new Date().toISOString(), accountId: a.id })
    assert.equal(response.statusCode, 201)
    const loanId = response.json().id
    const repayment = { amount: 80, paidAt: new Date().toISOString(), accountId: a.id }
    const results = await Promise.all([request('POST', `/financial/owner-loans/${loanId}/repayments`, repayment), request('POST', `/financial/owner-loans/${loanId}/repayments`, repayment)])
    assert.equal(results.filter((r) => r.statusCode === 201).length, 1)
    assert.equal((await prisma.financialAccount.findUnique({ where: { id: a.id } })).balance.toFixed(2), '20.00')
    const tx = await prisma.financialTransaction.findFirst({ where: { type: 'OWNER_LOAN', accountId: a.id } })
    assert.equal((await request('POST', `/financial/transactions/${tx.id}/void`, { reason: 'Invalid origin' })).statusCode, 422)
  })

  await t.test('concurrent reservations and sales preserve a single reservation and warranty', async () => {
    const p = await product()
    const reserve = { name: 'Test customer', phone: '00000000' }
    const reservations = await Promise.all([request('POST', `/products/${p.id}/reserve`, reserve), request('POST', `/products/${p.id}/reserve`, reserve)])
    assert.equal(reservations.filter((r) => r.statusCode === 201).length, 1)
    assert.equal(await prisma.productReservation.count({ where: { productId: p.id, isActive: true } }), 1)
    const sales = await Promise.all([request('POST', `/products/${p.id}/sell`, {}), request('POST', `/products/${p.id}/sell`, {})])
    assert.equal(sales.filter((r) => r.statusCode === 200).length, 1)
    assert.equal(await prisma.warranty.count({ where: { productId: p.id } }), 1)
    assert.equal(await prisma.productReservation.count({ where: { productId: p.id, isActive: true } }), 0)
    assert.equal((await prisma.device.findUnique({ where: { id: p.deviceId } })).ownStatus, 'SOLD')
    assert.equal((await request('PATCH', `/products/${p.id}`, { status: 'AVAILABLE' })).statusCode, 400)
    assert.equal((await request('PATCH', `/products/${p.id}`, { askingPriceCRC: 200 })).statusCode, 422)
  })

  await t.test('database failure rolls back balances, state, receipts and audit writes', async () => {
    const a = await account()
    const tx = await prisma.financialTransaction.create({ data: { type: 'INCOME', amount: 50, description: 'Rollback test', accountId: a.id } })
    const q = await quote(100)
    const stock = await item(1)
    const p = await product()
    const transferFrom = await account(100)
    const transferTo = await account(0)
    await prisma.$executeRawUnsafe(`CREATE FUNCTION fail_test_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit failure'; END $$`)
    await prisma.$executeRawUnsafe(`CREATE TRIGGER fail_test_audit BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION fail_test_audit()`)
    try {
      const attempts = [
        ['POST', `/financial/transactions/${tx.id}/confirm`, { confirm: true }],
        ['POST', `/quotes/${q.id}/payments`, { amount: 100, method: 'CASH' }],
        ['POST', `/inventory/${stock.id}/movements`, { type: 'SALE', quantity: 1 }],
        ['POST', `/products/${p.id}/sell`, {}],
        ['POST', '/financial/transfer', { fromAccountId: transferFrom.id, toAccountId: transferTo.id, amount: 10, description: 'Rollback transfer' }],
        ['POST', '/financial/owner-loans', { amount: 10, accountId: a.id, loanedAt: new Date().toISOString() }],
      ]
      for (const [method, endpoint, payload] of attempts) {
        const key = randomUUID()
        const response = await request(method, endpoint, payload, key)
        assert.equal(response.statusCode, 500)
        assert.deepEqual(response.json(), { error: 'No se pudo completar la operación' })
        assert.equal(await prisma.idempotencyRecord.count({ where: { userId: user.id, key } }), 0)
      }
      assert.equal((await prisma.financialAccount.findUnique({ where: { id: a.id } })).balance.toFixed(2), '0.00')
      assert.equal((await prisma.financialTransaction.findUnique({ where: { id: tx.id } })).isConfirmed, false)
      assert.equal(await prisma.payment.count({ where: { quoteId: q.id } }), 0)
      assert.equal((await prisma.inventoryItem.findUnique({ where: { id: stock.id } })).quantity, 1)
      assert.equal(await prisma.warranty.count({ where: { productId: p.id } }), 0)
      assert.equal((await prisma.product.findUnique({ where: { id: p.id } })).status, 'AVAILABLE')
      assert.equal((await prisma.financialAccount.findUnique({ where: { id: transferFrom.id } })).balance.toFixed(2), '100.00')
      assert.equal((await prisma.financialAccount.findUnique({ where: { id: transferTo.id } })).balance.toFixed(2), '0.00')
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER fail_test_audit ON "AuditLog"')
      await prisma.$executeRawUnsafe('DROP FUNCTION fail_test_audit()')
    }
  })

  await t.test('public responses omit internal costs, identifiers and personal data', async () => {
    const p = await product()
    const response = await app.inject({ method: 'GET', url: `/api/public/products/${p.id}` })
    assert.equal(response.statusCode, 200)
    assert.ok(!('costCRC' in response.json()))
    assert.ok(!('serialNumber' in response.json().device))
    assert.ok(!('notes' in response.json().device))
    assert.ok(!('reservations' in response.json()))
    await prisma.product.update({ where: { id: p.id }, data: { status: 'RESERVED' } })
    assert.equal((await app.inject({ method: 'GET', url: `/api/public/products/${p.id}` })).statusCode, 404)
  })

  await t.test('public catalog filters before pagination and excludes nonpublic states', async () => {
    const upcoming = []
    for (const month of ['03', '02', '01']) {
      const p = await product()
      await prisma.product.update({ where: { id: p.id }, data: { status: 'COMING_SOON', publishedAt: new Date(`2099-${month}-01T00:00:00Z`) } })
      upcoming.push(p.id)
    }
    const hidden = await product()
    await prisma.product.update({ where: { id: hidden.id }, data: { status: 'SOLD' } })

    const total = await prisma.product.count({ where: { status: 'COMING_SOON' } })
    const seen = []
    for (const page of [1, 2, 3]) {
      const response = await app.inject({ method: 'GET', url: `/api/public/products?status=COMING_SOON&page=${page}&limit=1` })
      assert.equal(response.statusCode, 200)
      const body = response.json()
      assert.deepEqual(body.meta, { total, page, limit: 1, pages: total })
      assert.equal(body.data.length, 1)
      assert.equal(body.data[0].status, 'COMING_SOON')
      assert.equal(body.data[0].id, upcoming[page - 1])
      assert.ok(!('costCRC' in body.data[0]))
      assert.ok(!('deviceId' in body.data[0]))
      seen.push(body.data[0].id)
    }
    assert.equal(new Set(seen).size, 3)

    const beyond = await app.inject({ method: 'GET', url: `/api/public/products?status=COMING_SOON&page=${total + 1}&limit=1` })
    assert.deepEqual(beyond.json().data, [])
    assert.equal(beyond.json().meta.total, total)

    const available = await app.inject({ method: 'GET', url: '/api/public/products?status=AVAILABLE&limit=100' })
    assert.equal(available.statusCode, 200)
    assert.ok(available.json().data.every((p) => p.status === 'AVAILABLE'))
    assert.equal(available.json().meta.total, await prisma.product.count({ where: { status: 'AVAILABLE' } }))

    const all = await app.inject({ method: 'GET', url: '/api/public/products?limit=100' })
    assert.equal(all.statusCode, 200)
    assert.ok(all.json().data.every((p) => ['AVAILABLE', 'COMING_SOON'].includes(p.status)))
    assert.ok(!all.json().data.some((p) => p.id === hidden.id))
    for (const status of ['SOLD', 'RESERVED', 'INVALID', 'AVAILABLE&status=SOLD']) {
      assert.equal((await app.inject({ method: 'GET', url: `/api/public/products?status=${status}` })).statusCode, 400)
    }
  })

  await t.test('product photographs stay isolated and preserve originals during retries and failures', async (photosTest) => {
    const cloudinary = require('cloudinary').v2
    const originalUpload = cloudinary.uploader.upload_stream
    const originalDestroy = cloudinary.uploader.destroy
    const assets = new Map()
    const uploads = []
    let upstreamFailure = false
    let address = 10
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=', 'base64')
    cloudinary.uploader.destroy = () => { throw new Error('Original assets must never be deleted') }
    cloudinary.uploader.upload_stream = (options, callback) => new Writable({
      write(_chunk, _encoding, done) { done() },
      final(done) {
        uploads.push(options)
        if (upstreamFailure) callback({ http_code: upstreamFailure === 400 ? 400 : 503, message: 'synthetic upstream details must remain private' })
        else {
          if (!assets.has(options.public_id)) assets.set(options.public_id, {
            public_id: options.public_id, resource_type: 'image',
            secure_url: `https://res.cloudinary.com/test/image/upload/v1/${options.public_id}.webp`,
          })
          callback(null, assets.get(options.public_id))
        }
        done()
      },
    })
    photosTest.after(() => {
      cloudinary.uploader.upload_stream = originalUpload
      cloudinary.uploader.destroy = originalDestroy
    })
    const multipartPayload = (files) => {
      const boundary = 'photo-' + randomUUID()
      const parts = []
      for (const file of files) parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${file.name || 'file'}"; filename="test.png"\r\nContent-Type: ${file.mime || 'image/png'}\r\n\r\n`), file.buffer || png, Buffer.from('\r\n'))
      parts.push(Buffer.from(`--${boundary}--\r\n`))
      return { payload: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` }
    }
    const sendPhoto = (productId, { key = randomUUID(), files = [{}], authorized = true } = {}) => {
      const body = multipartPayload(files)
      return app.inject({ method: 'POST', url: `/api/products/${productId}/photos`, payload: body.payload,
        remoteAddress: '127.0.0.' + address++, headers: {
          'content-type': body.contentType, ...(authorized ? { authorization } : {}), ...(key ? { 'idempotency-key': key } : {}),
        },
      })
    }

    await photosTest.test('upload is namespaced, never overwrites, and duplicate delivery returns the same photo', async () => {
      const p = await product()
      const key = randomUUID()
      const before = uploads.length
      const first = await sendPhoto(p.id, { key })
      assert.equal(first.statusCode, 201)
      const options = uploads.at(-1)
      assert.equal(options.asset_folder, `CRM-TechLab/products/${p.id}`)
      assert.ok(options.public_id.startsWith(`CRM-TechLab/products/${p.id}/`))
      assert.equal(options.overwrite, false)
      assert.equal(options.use_filename, false)
      assert.equal(options.format, 'webp')
      assert.ok(options.transformation[0].flags.includes('strip_profile'))
      const second = await sendPhoto(p.id, { key })
      assert.equal(second.statusCode, 201)
      assert.deepEqual(second.json(), first.json())
      assert.equal(uploads.length, before + 1)
      assert.equal(await prisma.productPhoto.count({ where: { productId: p.id } }), 1)
      const changed = await sendPhoto(p.id, { key, files: [{ buffer: Buffer.concat([png, Buffer.from('changed')]) }] })
      assert.equal(changed.statusCode, 409)
      assert.equal(uploads.length, before + 1)
      const simultaneousKey = randomUUID()
      const responses = await Promise.all([sendPhoto(p.id, { key: simultaneousKey }), sendPhoto(p.id, { key: simultaneousKey })])
      assert.ok(responses.every(r => r.statusCode === 201))
      assert.equal(responses[0].json().id, responses[1].json().id)
      assert.equal(await prisma.productPhoto.count({ where: { productId: p.id } }), 2)
    })

    await photosTest.test('bad files, excess data and unauthenticated uploads fail before cloud access', async () => {
      const p = await product()
      const before = uploads.length
      assert.equal((await sendPhoto(p.id, { authorized: false })).statusCode, 401)
      assert.equal((await sendPhoto(p.id, { key: '' })).statusCode, 400)
      assert.equal((await sendPhoto('missing-product')).statusCode, 404)
      assert.equal((await sendPhoto(p.id, { files: [] })).statusCode, 400)
      assert.equal((await sendPhoto(p.id, { files: [{ mime: 'image/jpeg' }] })).statusCode, 400)
      assert.equal((await sendPhoto(p.id, { files: [{ buffer: Buffer.from('<svg/>') }] })).statusCode, 400)
      assert.equal((await sendPhoto(p.id, { files: [{ name: 'folder' }] })).statusCode, 400)
      assert.equal((await sendPhoto(p.id, { files: [{}, {}] })).statusCode, 413)
      const oversized = Buffer.alloc(5 * 1024 * 1024 + 1)
      png.copy(oversized)
      assert.equal((await sendPhoto(p.id, { files: [{ buffer: oversized }] })).statusCode, 413)
      assert.equal(uploads.length, before)
      assert.equal(await prisma.productPhoto.count({ where: { productId: p.id } }), 0)
    })

    await photosTest.test('cover and ordering enforce product membership; unlink preserves cloud originals', async () => {
      const p = await product()
      const first = (await sendPhoto(p.id)).json()
      const second = (await sendPhoto(p.id)).json()
      const another = await product()
      const foreign = await prisma.productPhoto.create({ data: {
        productId: another.id, url: 'https://res.cloudinary.com/test/image/upload/product-catalog/preserved.webp',
        publicId: 'product-catalog/preserved', position: 0,
      } })
      const reordered = await request('PATCH', `/products/${p.id}/photos/order`, { photoIds: [second.id, first.id] })
      assert.equal(reordered.statusCode, 200)
      assert.deepEqual(reordered.json().map(photo => [photo.id, photo.position]), [[second.id, 0], [first.id, 1]])
      const publicDetail = await app.inject({ method: 'GET', url: `/api/public/products/${p.id}` })
      assert.equal(publicDetail.json().photos[0].url, second.url)
      assert.ok(publicDetail.json().photos.every(photo => !('publicId' in photo) && !('productId' in photo)))
      assert.equal((await request('PATCH', `/products/${p.id}/photos/order`, { photoIds: [first.id, first.id] })).statusCode, 400)
      assert.equal((await request('PATCH', `/products/${p.id}/photos/order`, { photoIds: [foreign.id, first.id] })).statusCode, 409)
      assert.equal((await request('DELETE', `/products/${p.id}/photos/${foreign.id}`)).statusCode, 404)
      const assetCount = assets.size
      const key = randomUUID()
      assert.equal((await request('DELETE', `/products/${p.id}/photos/${second.id}`, undefined, key)).statusCode, 204)
      assert.equal((await request('DELETE', `/products/${p.id}/photos/${second.id}`, undefined, key)).statusCode, 204)
      assert.equal(assets.size, assetCount)
      assert.ok(await prisma.productPhoto.findUnique({ where: { id: foreign.id } }))
      const remaining = await prisma.productPhoto.findMany({ where: { productId: p.id } })
      assert.deepEqual(remaining.map(photo => [photo.id, photo.position]), [[first.id, 0]])
    })

    await photosTest.test('cloud errors are safe and a DB failure retains a recoverable original without a false receipt', async () => {
      const p = await product()
      const key = randomUUID()
      upstreamFailure = true
      const failed = await sendPhoto(p.id, { key })
      upstreamFailure = false
      assert.equal(failed.statusCode, 502)
      assert.ok(!failed.body.includes('synthetic upstream details'))
      assert.equal(await prisma.productPhoto.count({ where: { productId: p.id } }), 0)
      upstreamFailure = 400
      assert.equal((await sendPhoto(p.id, { key })).statusCode, 422)
      upstreamFailure = false
      await prisma.$executeRawUnsafe(`CREATE FUNCTION fail_photo_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic photo failure'; END $$`)
      await prisma.$executeRawUnsafe('CREATE TRIGGER fail_photo_audit BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION fail_photo_audit()')
      try {
        const rolledBack = await sendPhoto(p.id, { key })
        assert.equal(rolledBack.statusCode, 500)
        assert.equal(await prisma.productPhoto.count({ where: { productId: p.id } }), 0)
        assert.equal(await prisma.idempotencyRecord.count({ where: { userId: user.id, key } }), 0)
      } finally {
        await prisma.$executeRawUnsafe('DROP TRIGGER fail_photo_audit ON "AuditLog"')
        await prisma.$executeRawUnsafe('DROP FUNCTION fail_photo_audit()')
      }
      const originalAssetCount = assets.size
      const retried = await sendPhoto(p.id, { key })
      assert.equal(retried.statusCode, 201)
      assert.equal(assets.size, originalAssetCount)
      assert.equal(await prisma.productPhoto.count({ where: { productId: p.id } }), 1)
    })

    await photosTest.test('two uploads competing for the last slot cannot exceed ten photographs', async () => {
      const p = await product()
      await prisma.productPhoto.createMany({ data: Array.from({ length: 9 }, (_, position) => ({
        productId: p.id, position, publicId: `CRM-TechLab/products/${p.id}/test-${position}`,
        url: `https://res.cloudinary.com/test/image/upload/test-${position}.webp`,
      })) })
      const responses = await Promise.all([sendPhoto(p.id), sendPhoto(p.id)])
      assert.equal(responses.filter(response => response.statusCode === 201).length, 1)
      assert.ok(responses.every(response => [201, 409, 422].includes(response.statusCode)))
      assert.equal(await prisma.productPhoto.count({ where: { productId: p.id } }), 10)
      const before = uploads.length
      assert.equal((await sendPhoto(p.id)).statusCode, 422)
      assert.equal(uploads.length, before)
    })
  })

  await t.test('Zod migration preserves optional PATCH fields without applying create defaults', async () => {
    const a = await prisma.financialAccount.create({ data: { name: 'Inactive', isActive: false } })
    assert.equal((await request('PATCH', `/financial/accounts/${a.id}`, { description: 'Updated' })).statusCode, 200)
    assert.equal((await prisma.financialAccount.findUnique({ where: { id: a.id } })).isActive, false)
    const supplier = await prisma.supplier.create({ data: { name: 'Foreign', isLocal: false } })
    assert.equal((await request('PATCH', `/suppliers/${supplier.id}`, { notes: 'Updated' })).statusCode, 200)
    assert.equal((await prisma.supplier.findUnique({ where: { id: supplier.id } })).isLocal, false)
  })

  await t.test('invalid pagination, dates, precision and large payloads fail before writes', async () => {
    for (const path of ['/public/products?limit=100000', '/inventory?page=-1', '/financial/ledger?from=invalid']) {
      assert.equal((await request('GET', path)).statusCode, 400)
    }
    assert.equal((await request('POST', '/financial/transactions', { type: 'INCOME', amount: 0.001, description: 'Invalid precision' })).statusCode, 400)
    assert.equal((await request('POST', '/financial/transactions', { type: 'INCOME', amount: 100, description: 'x'.repeat(300000) })).statusCode, 413)
  })

  await t.test('login and inquiry throttling cannot be bypassed by forged proxy headers', async () => {
    for (let index = 0; index < 6; index++) {
      const response = await app.inject({ method: 'POST', url: '/api/auth/login', payload: {}, headers: { 'x-forwarded-for': `192.0.2.${index}` } })
      assert.equal(response.statusCode, index < 5 ? 400 : 429)
    }
    for (let index = 0; index < 11; index++) {
      const response = await app.inject({ method: 'POST', url: '/api/public/inquiries', payload: {}, headers: { 'x-forwarded-for': `192.0.2.${index}` } })
      assert.equal(response.statusCode, index < 10 ? 400 : 429)
    }
  })

  await t.test('sensitive writes leave audit records without copying request payloads', async () => {
    const logs = await prisma.auditLog.findMany({ where: { userId: user.id } })
    assert.ok(logs.length > 5)
    for (const log of logs) assert.deepEqual(Object.keys(log.data), ['requestHash'])
  })

  await t.test('database constraints also reject future invalid writes outside the API', async () => {
    const stock = await item(1)
    await assert.rejects(prisma.inventoryItem.update({ where: { id: stock.id }, data: { quantity: -1 } }))
    assert.equal((await prisma.inventoryItem.findUnique({ where: { id: stock.id } })).quantity, 1)
    await assert.rejects(prisma.financialTransaction.create({ data: { type: 'INCOME', amount: -1, description: 'Invalid write' } }))
  })
})
