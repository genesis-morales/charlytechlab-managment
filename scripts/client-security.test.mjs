import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomUUID, webcrypto } from 'node:crypto'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function load(file, imports = {}) {
  const source = readFileSync(new URL(`../frontend/src/${file}`, import.meta.url), 'utf8').replaceAll('import.meta.env', '__viteEnv')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } })
  const module = { exports: {} }
  runInNewContext(compiled.outputText, { module, exports: module.exports, crypto: webcrypto, __viteEnv: {}, require: (name) => imports[name] ?? require(name) })
  return module.exports
}

test('client reuses uncertain operation keys and releases them after confirmed responses', async () => {
  const keys = load('lib/operation-key.ts')
  const handlers = {}
  const api = { interceptors: {
    request: { use: (handler) => { handlers.request = handler } },
    response: { use: (success, error) => { handlers.success = success; handlers.error = error } },
  } }
  const state = { token: randomUUID(), user: { id: 'test-user' }, logout: () => {} }
  load('lib/api.ts', {
    axios: { __esModule: true, default: { create: () => api } },
    '../store/auth.store': { useAuthStore: { getState: () => state } },
    './operation-key': keys,
  })
  const request = (amount = 20) => handlers.request({ method: 'post', url: '/quotes/test/payments', data: { amount }, headers: {} })
  const first = request()
  assert.equal(request().headers['Idempotency-Key'], first.headers['Idempotency-Key'])
  await assert.rejects(handlers.error({ response: { status: 500 }, config: first }))
  assert.equal(request().headers['Idempotency-Key'], first.headers['Idempotency-Key'])
  await assert.rejects(handlers.error({ config: first }))
  assert.equal(request().headers['Idempotency-Key'], first.headers['Idempotency-Key'])
  assert.notEqual(request(30).headers['Idempotency-Key'], first.headers['Idempotency-Key'])
  handlers.success({ config: first })
  const next = request()
  assert.notEqual(next.headers['Idempotency-Key'], first.headers['Idempotency-Key'])
  await assert.rejects(handlers.error({ response: { status: 400 }, config: next }))
  assert.notEqual(request().headers['Idempotency-Key'], next.headers['Idempotency-Key'])
})

test('logout and a new login remove cached private data and pending operation keys', () => {
  const keys = load('lib/operation-key.ts')
  const { queryClient } = load('lib/query-client.ts')
  const { useAuthStore } = load('store/auth.store.ts', {
    'zustand/middleware': { persist: (initializer) => initializer },
    '../lib/query-client': { queryClient },
    '../lib/operation-key': keys,
  })
  useAuthStore.getState().setAuth(randomUUID(), { id: 'first', name: 'Test', email: 'test@example.invalid' })
  queryClient.setQueryData(['customers'], [{ id: 'private-customer' }])
  const previous = keys.operationKey('operation')
  useAuthStore.getState().logout()
  assert.equal(useAuthStore.getState().token, null)
  assert.equal(queryClient.getQueryData(['customers']), undefined)
  assert.notEqual(keys.operationKey('operation'), previous)
  queryClient.setQueryData(['financial'], { balance: 100 })
  useAuthStore.getState().setAuth(randomUUID(), { id: 'second', name: 'Test', email: 'test2@example.invalid' })
  assert.equal(queryClient.getQueryData(['financial']), undefined)
  queryClient.clear()
})
