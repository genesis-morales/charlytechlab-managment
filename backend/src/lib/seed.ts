import 'dotenv/config'
import { prisma } from './db'
import bcrypt from 'bcrypt'

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim()
  const password = process.env.ADMIN_PASSWORD
  const name = process.env.ADMIN_NAME ?? 'Administrador'

  if (!email || !password || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Configura ADMIN_EMAIL y ADMIN_PASSWORD (mínimo 12 caracteres y máximo 72 bytes) en tu entorno local.')
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log('Usuario admin ya existe:', email)
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({ data: { email, passwordHash, name } })
  console.log('Usuario admin creado:', user.email)
}

main()
  .catch(() => {
    console.error('No se pudo crear el administrador. Revisa la configuración local y la conexión a la base de datos.')
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
