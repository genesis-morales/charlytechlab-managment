import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, realpathSync, rmSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { inspectContent, privatePath } from './security-check.mjs'

test('detects secrets while returning only locations and rule names', () => {
  const value = 'synthetic-' + 'credential-for-test'
  for (const content of [
    `JWT_SECRET=${value}`,
    `const password = '${value}'`,
    JSON.stringify({ apiKey: value }),
    JSON.stringify({ CLOUDINARY_API_SECRET: value }),
    `postgresql://admin:${value}@localhost/test`,
    ['-----BEGIN', 'PRIVATE KEY-----'].join(' '),
    'ghp_' + 'A'.repeat(36),
    'AKIA' + 'A'.repeat(16),
    'prefix\n' + value,
  ]) {
    const findings = inspectContent(content, [value])
    assert.ok(findings.length > 0)
    assert.ok(!JSON.stringify(findings).includes(value))
  }
  assert.deepEqual(inspectContent(`first\n${value}`, [value]), [{ line: 2, rule: 'local-secret-copy' }])
})

test('permits references to environment variables and empty templates', () => {
  for (const content of [
    "secret: required('JWT_SECRET')",
    'password: process.env.ADMIN_PASSWORD',
    'JWT_SECRET=\nADMIN_PASSWORD=\nDATABASE_URL=',
    'CLOUDINARY_API_SECRET=your_secret',
  ]) {
    assert.deepEqual(inspectContent(content), [])
  }
})

test('rejects private files and generated artifacts, permits source and migrations', () => {
  for (const filename of [
    'backend/.env', 'frontend/.env.production', '.env.local', '.npmrc',
    'node_modules/pkg/index.js', 'backend/dist/server.js', '.aws/credentials',
    'backend/src/lib/seed-from-csv.ts', 'backups/db.dump', 'customers.csv', 'database.sql',
    'private-key.pem', 'service-account-prod.json', 'credentials.json',
  ]) assert.ok(privatePath(filename), filename)
  for (const filename of [
    'backend/.env.example', 'frontend/.env.example', 'package-lock.json',
    'backend/prisma/migrations/20261111210415_v1_crm/migration.sql',
    'backend/src/lib/config.ts', 'frontend/src/img/logo-1.webp',
  ]) assert.ok(!privatePath(filename), filename)
})

test('CLI scans the index and deleted historical secrets while ignoring local environment files', (t) => {
  const parent = realpathSync(tmpdir())
  const dir = mkdtempSync(path.join(parent, 'ctlab-security-'))
  t.after(() => {
    // Delete only this test's verified direct child of the system temp directory.
    assert.equal(path.dirname(path.resolve(dir)), parent)
    assert.ok(path.basename(dir).startsWith('ctlab-security-'))
    rmSync(dir, { recursive: true, force: true })
  })
  const git = (...args) => execFileSync('git', [
    '-c', `safe.directory=${dir.replaceAll('\\', '/')}`,
    '-c', 'core.excludesFile=', '-c', 'core.hooksPath=',
    '-c', 'user.name=Security test', '-c', 'user.email=security@example.invalid',
    '-c', 'commit.gpgsign=false', ...args,
  ], { cwd: dir, stdio: 'pipe' })
  const scan = () => spawnSync(process.execPath, ['scripts/security-check.mjs'], { cwd: dir, encoding: 'utf8' })
  const secret = randomBytes(32).toString('hex')
  git('init', '--quiet')
  mkdirSync(path.join(dir, 'scripts'))
  copyFileSync(new URL('./security-check.mjs', import.meta.url), path.join(dir, 'scripts/security-check.mjs'))
  writeFileSync(path.join(dir, '.gitignore'), '.env\n')
  writeFileSync(path.join(dir, 'README.md'), 'Fixture\n')
  writeFileSync(path.join(dir, '.env'), `JWT_SECRET=${secret}\n`)
  git('add', '.gitignore', 'README.md')
  git('commit', '--quiet', '-m', 'Fixture baseline')
  const clean = scan()
  assert.equal(clean.status, 0, clean.stderr)

  // The secret is staged, but the file on disk has already been cleaned.
  writeFileSync(path.join(dir, 'notes.txt'), secret)
  git('add', 'notes.txt')
  writeFileSync(path.join(dir, 'notes.txt'), 'Clean file\n')
  const staged = scan()
  assert.equal(staged.status, 1)
  assert.match(staged.stderr, /index:notes\.txt:1: local-secret-copy/)
  assert.ok(!staged.stderr.includes(secret))

  // Cleaning a later commit must not hide the secret in earlier history.
  git('commit', '--quiet', '-m', 'Synthetic historical leak')
  git('add', 'notes.txt')
  git('commit', '--quiet', '-m', 'Clean current file')
  const history = scan()
  assert.equal(history.status, 1)
  assert.match(history.stderr, /history@[a-f0-9]+:notes\.txt:1: local-secret-copy/)
  assert.ok(!history.stderr.includes(secret))
})
