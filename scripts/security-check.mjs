import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, lstatSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// No dependencies or network access. Reports locations, never matched values.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const secretName = /(?:secret|password|passwd|token|api[_-]?key|private[_-]?key|database_url|direct_url)/i
const placeholder = /^(?:|x{3,}|\*+|<[^>]+>|\$\{[^}]+\}|(?:your|tu|example|placeholder|replace|change|changeme|cambiar|generar)[_-].*)$/i
const rules = [
  ['private-key', /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/g],
  ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,})\b/g],
  ['aws-access-key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ['service-token', /\b(?:sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}|sk_live_[A-Za-z0-9]{16,}|xox[baprs]-[A-Za-z0-9-]{20,}|AIza[A-Za-z0-9_-]{35})\b/g],
  ['jwt', /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{16,}\b/g],
  ['credential-url', /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|rediss|https?):\/\/[^\s/@:]+:([^\s/@]+)@[^\s'"`]+/g],
  ['hardcoded-secret', /\b[\w.-]*(?:secret|password|passwd|token|api[_-]?key|private[_-]?key)\b['"]?[ \t]*[=:][ \t]*['"]([^'"\r\n]+)['"]/gi],
  ['environment-secret', /^[ \t]*(?:export[ \t]+)?([A-Z][A-Z0-9_]*(?:SECRET|PASSWORD|TOKEN|API_KEY|PRIVATE_KEY)|(?:DATABASE|DIRECT)_URL)[ \t]*=[ \t]*([^\r\n#]+)/gm],
]

export function privatePath(filename) {
  const name = filename.replaceAll('\\', '/')
  const base = path.posix.basename(name)
  return (
    /(?:^|\/)(?:node_modules|dist|build|coverage|\.git|\.aws|\.ssh|\.codex|\.agents|\.idea|\.vscode|\.vercel|\.netlify|\.terraform|\.cache|\.npm|\.vite|\.turbo|data|private|backups|uploads|playwright-report|test-results)(?:\/|$)/i.test(name) ||
    (/^\.env(?:\.|$)/i.test(base) && !/\.example$/i.test(base)) ||
    /^(?:\.envrc|\.npmrc|\.pypirc|credentials\.json|service-account.*\.json|.*-credentials\.json|.*\.service-account\.json|id_rsa.*|id_ed25519.*|\.DS_Store|Thumbs\.db|Desktop\.ini)$/i.test(base) ||
    /\.(?:pem|key|p12|pfx|jks|csv|xlsx?|dump|backup|sqlite\w*|db|log|tmp|temp|bak|swp|tsbuildinfo)$|\.sql\.(?:gz|zip)$|\.tfstate(?:\.|$)/i.test(base) ||
    (/\.sql$/i.test(base) && !/^backend\/prisma\/migrations\/[^/]+\/migration\.sql$/.test(name)) ||
    name === 'backend/src/lib/seed-from-csv.ts'
  )
}

export function inspectContent(content, knownSecrets = []) {
  const findings = []
  const add = (index, rule) => findings.push({ line: content.slice(0, index).split('\n').length, rule })
  for (const [rule, expression] of rules) {
    for (const match of content.matchAll(expression)) {
      const value = rule === 'environment-secret' ? match[2].trim().replace(/^['"]|['"]$/g, '') : match[1]
      if (value !== undefined && placeholder.test(value)) continue
      add(match.index, rule)
    }
  }
  for (const secret of knownSecrets) {
    let index = content.indexOf(secret)
    while (index !== -1) {
      add(index, 'local-secret-copy')
      index = content.indexOf(secret, index + secret.length)
    }
  }
  return findings.filter((item, index) => findings.findIndex((other) => other.line === item.line && other.rule === item.rule) === index)
}

function git(args) {
  return execFileSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, '-c', 'core.excludesFile=', ...args], {
    cwd: root, maxBuffer: 64 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
  })
}

function localSecrets() {
  const secrets = new Set()
  // Read local environment values in memory only; do not print or persist them.
  for (const dir of ['', 'backend', 'frontend']) {
    for (const suffix of ['', '.local', '.development', '.development.local', '.production', '.production.local', '.test', '.test.local', '.staging']) {
      const file = path.join(root, dir, `.env${suffix}`)
      if (!existsSync(file)) continue
      for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
        const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
        if (!match || !secretName.test(match[1])) continue
        const value = match[2].trim().replace(/^['"]|['"]$/g, '')
        if (value.length < 8 || placeholder.test(value)) continue
        secrets.add(value)
        secrets.add(encodeURIComponent(value))
        if (/^(?:DATABASE|DIRECT)_URL$/i.test(match[1])) {
          try {
            const password = decodeURIComponent(new URL(value).password)
            if (password.length >= 8) {
              secrets.add(password)
              secrets.add(encodeURIComponent(password))
            }
          } catch { /* The full value is still checked. */ }
        }
      }
    }
  }
  return [...secrets]
}

export function main() {
  const findings = []
  const secrets = localSecrets()
  let checkedFiles = 0
  let historyBlobs = 0
  const scan = (filename, bytes, scope) => {
    if (privatePath(filename)) findings.push(`${scope}:${filename}: prohibited private/generated file`)
    for (const item of inspectContent(bytes.toString('utf8'), secrets)) {
      findings.push(`${scope}:${filename}:${item.line}: ${item.rule}`)
    }
  }

  const files = new Set(git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']).toString('utf8').split('\0').filter(Boolean))
  for (const file of files) {
    const absolute = path.join(root, file)
    if (!existsSync(absolute)) continue
    if (!lstatSync(absolute).isFile()) {
      findings.push(`worktree:${file}: unsupported file type (review manually)`)
      continue
    }
    checkedFiles++
    scan(file, readFileSync(absolute), 'worktree')
  }

  // The index can differ from disk; scan exactly what a commit would contain.
  for (const entry of git(['ls-files', '--stage', '-z']).toString('utf8').split('\0').filter(Boolean)) {
    const match = entry.match(/^\d+ ([a-f0-9]+) (\d)\t(.+)$/s)
    if (!match) throw new Error('Cannot parse Git index')
    scan(match[3], git(['cat-file', 'blob', match[1]]), 'index')
  }

  // Scan publishable history. Local tool snapshots under refs/codex are not branches.
  const objects = git(['rev-list', '--objects', '--branches', '--tags', '--remotes', 'HEAD']).toString('utf8').split('\n').filter(Boolean)
  for (const object of objects) {
    const space = object.indexOf(' ')
    if (space < 0) continue
    const oid = object.slice(0, space)
    const filename = object.slice(space + 1)
    if (git(['cat-file', '-t', oid]).toString('utf8').trim() !== 'blob') continue
    historyBlobs++
    scan(filename, git(['cat-file', 'blob', oid]), `history@${oid.slice(0, 10)}`)
  }

  if (findings.length) {
    console.error('Security check FAILED. Values are redacted; review these locations:')
    for (const finding of [...new Set(findings)]) console.error(`- ${finding}`)
    process.exitCode = 1
  } else {
    console.log(`Security check OK: ${checkedFiles} candidate files, Git index and ${historyBlobs} history blobs checked; no detected secrets or prohibited files.`)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main() } catch {
    console.error('Security check could not complete. Verify local Git and file permissions; no sensitive error details printed.')
    process.exitCode = 1
  }
}
