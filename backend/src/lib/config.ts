import 'dotenv/config'

const required = (key: string): string => {
  const value = process.env[key]
  if (!value) throw new Error(`Variable de entorno requerida: ${key}`)
  return value
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isDev: process.env.NODE_ENV !== 'production',
  trustProxyHops: Number(process.env.TRUST_PROXY_HOPS ?? 0),

  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },

  db: {
    url: required('DATABASE_URL'),
  },

  cloudinary: {
    cloudName: required('CLOUDINARY_CLOUD_NAME'),
    apiKey: required('CLOUDINARY_API_KEY'),
    apiSecret: required('CLOUDINARY_API_SECRET'),
  },

  frontend: {
    url: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  },

  reservation: {
    holdHours: Number(process.env.RESERVATION_HOLD_HOURS ?? 48),
  },
}

if (!Number.isInteger(config.trustProxyHops) || config.trustProxyHops < 0 || config.trustProxyHops > 2) {
  throw new Error('TRUST_PROXY_HOPS debe ser un entero entre 0 y 2')
}
if (config.nodeEnv === 'production') {
  if (Buffer.byteLength(config.jwt.secret, 'utf8') < 32 || /^(?:cambia|change|your|tu[-_])/i.test(config.jwt.secret)) {
    throw new Error('JWT_SECRET debe ser un secreto propio de al menos 32 bytes en producción')
  }
  if (!process.env.FRONTEND_URL || new URL(config.frontend.url).protocol !== 'https:') {
    throw new Error('FRONTEND_URL debe ser un origen HTTPS explícito en producción')
  }
}
