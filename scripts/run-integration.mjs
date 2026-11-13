import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createServer } from 'node:net'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const extension = process.platform === 'win32' ? '.exe' : ''
const execute = (command, args, env = process.env) => execFileSync(command, args, {
  cwd: root, env, windowsHide: true, timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'],
})

let bin = process.env.PG_BIN
if (!bin && process.platform === 'win32') {
  bin = 'C:/Program Files/PostgreSQL/18/bin'
}
if (!bin) {
  try { bin = execute('pg_config', ['--bindir']).toString().trim() } catch { /* Report below. */ }
}
if (!bin || !existsSync(path.join(bin, `initdb${extension}`))) {
  console.error('PostgreSQL local no encontrado. Configura PG_BIN con la carpeta de binarios; no se usará DATABASE_URL.')
  process.exit(1)
}

const parent = realpathSync(tmpdir())
const temporary = mkdtempSync(path.join(parent, 'ctlab-db-'))
const data = path.join(temporary, 'data')
// PostgreSQL children must not inherit captured pipes on Windows: that can keep pg_ctl open.
const pg = (name, args) => execFileSync(path.join(bin, `${name}${extension}`), args, {
  cwd: root, windowsHide: true, timeout: 20000, stdio: 'ignore',
})
let started = false
let stopped = true
let stage = 'prepare'
try {
  const port = await new Promise((resolve, reject) => {
    const socket = createServer()
    socket.once('error', reject)
    socket.listen(0, '127.0.0.1', () => {
      const selected = socket.address().port
      socket.close((error) => error ? reject(error) : resolve(selected))
    })
  })
  stage = 'initdb'
  pg('initdb', ['-D', data, '-U', 'postgres', '-A', 'trust', '--encoding=UTF8', '--locale=C'])
  stage = 'start'
  started = true
  pg('pg_ctl', ['-D', data, '-l', path.join(temporary, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start'])
  stage = 'createdb'
  const database = `ctlab_test_${randomBytes(8).toString('hex')}`
  pg('createdb', ['-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', database])
  const url = `postgresql://postgres@127.0.0.1:${port}/${database}?connection_limit=10`
  const env = {
    ...process.env, DATABASE_URL: url, DIRECT_URL: url, TEST_DATABASE_URL: url,
    ISOLATED_DATABASE_TEST: '1', NODE_ENV: 'test',
    JWT_SECRET: randomBytes(32).toString('hex'),
    CLOUDINARY_CLOUD_NAME: 'test', CLOUDINARY_API_KEY: randomBytes(16).toString('hex'),
    CLOUDINARY_API_SECRET: randomBytes(16).toString('hex'), TRUST_PROXY_HOPS: '0',
  }
  stage = 'migrate'
  execute(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', 'backend/prisma/schema.prisma'], env)
  console.log('Migraciones aplicadas únicamente a PostgreSQL temporal en loopback; ejecutando pruebas.')
  try {
    stage = 'tests'
    process.stdout.write(execute(process.execPath, ['--test', 'backend/test/operations.integration.cjs'], env))
  } catch (error) {
    if (error.stdout) process.stdout.write(error.stdout)
    if (error.stderr) process.stderr.write(error.stderr)
    // Test assertions must not include database URLs or environment values.
    process.exitCode = 1
  }
} catch (error) {
  console.error(`No se pudo completar la etapa aislada ${stage} (${error.status ?? error.code ?? 'error'}). No se utilizó la base configurada en .env.`)
  process.exitCode = 1
} finally {
  if (started) {
    try { pg('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']) } catch {
      stopped = false
      console.error('No se pudo detener PostgreSQL temporal; se conservó su directorio para revisión.')
      process.exitCode = 1
    }
  }
  // A resolved direct child with this prefix is the only allowed deletion target.
  if (stopped && path.dirname(path.resolve(temporary)) === parent && path.basename(temporary).startsWith('ctlab-db-')) {
    rmSync(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
}
