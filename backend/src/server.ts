import { createApp } from './app'
import { config } from './lib/config'

async function bootstrap() {
  const app = await createApp()
  await app.listen({ port: config.port, host: '0.0.0.0' })
}

bootstrap().catch(() => {
  console.error('No se pudo iniciar el servidor. Revisa la configuración y los registros operativos.')
  process.exitCode = 1
})
