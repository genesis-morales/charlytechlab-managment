import type { FastifyInstance } from 'fastify'
import multipart from '@fastify/multipart'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../../lib/db'
import { AppError } from '../../lib/errors'
import { operationIdentity, replayOperation, runOperation } from '../../lib/operation'
import { imageMime, productImageStorage, productPhotoPublicId, PRODUCT_PHOTO_LIMIT, PRODUCT_PHOTO_MAX_BYTES } from '../../lib/product-images'

const photoSelect = { id: true, url: true, position: true } as const
const orderSchema = z.object({ photoIds: z.array(z.string().min(1).max(128)).max(PRODUCT_PHOTO_LIMIT) }).strict()

export async function productPhotoRoutes(app: FastifyInstance) {
  await app.register(multipart, {
    limits: { fileSize: PRODUCT_PHOTO_MAX_BYTES, files: 1, fields: 0, parts: 1, fieldNameSize: 32, headerPairs: 20 },
    throwFileSizeLimit: true,
  })

  app.post<{ Params: { id: string } }>('/:id/photos', {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { userId, key } = operationIdentity(req)
    const productId = req.params.id
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(productId)) throw new AppError(400, 'El identificador del producto no es válido')
    if (!req.isMultipart()) throw new AppError(400, 'Seleccioná una fotografía JPG, PNG o WebP')
    let buffer: Buffer | undefined
    let mime: string | undefined
    for await (const part of req.parts()) {
      if (part.type !== 'file' || part.fieldname !== 'file') throw new AppError(400, 'La solicitud debe contener una sola fotografía')
      buffer = await part.toBuffer()
      mime = part.mimetype
    }
    if (!buffer?.length || !mime || imageMime(buffer) !== mime) throw new AppError(400, 'El archivo debe ser una fotografía JPG, PNG o WebP válida')
    const digest = createHash('sha256').update(buffer).digest('hex')
    req.body = { digest, mime, bytes: buffer.length }
    const previous = await replayOperation(req)
    if (previous.found) return reply.code(201).send(previous.response)

    const product = await prisma.product.findUnique({
      where: { id: productId }, select: { id: true, _count: { select: { photos: true } } },
    })
    if (!product) throw new AppError(404, 'Producto no encontrado')
    if (product._count.photos >= PRODUCT_PHOTO_LIMIT) throw new AppError(422, 'Cada producto admite hasta 10 fotografías')
    const publicId = productPhotoPublicId(productId, userId, key, digest)
    const image = await productImageStorage.upload(buffer, productId, publicId)

    const photo = await runOperation(req, async (db) => {
      if (!await db.product.findUnique({ where: { id: productId }, select: { id: true } })) throw new AppError(404, 'Producto no encontrado')
      const existing = await db.productPhoto.findMany({ where: { productId }, orderBy: [{ position: 'asc' }, { id: 'asc' }] })
      if (existing.length >= PRODUCT_PHOTO_LIMIT) throw new AppError(422, 'Cada producto admite hasta 10 fotografías')
      const position = existing.length ? Math.max(...existing.map((item) => item.position)) + 1 : 0
      return db.productPhoto.create({ data: { productId, url: image.url, publicId: image.publicId, position }, select: photoSelect })
    })
    // If a DB write fails, the uploaded original is retained. Its deterministic
    // ID and overwrite:false allow a safe retry without touching other assets.
    return reply.code(201).send(photo)
  })

  app.patch<{ Params: { id: string } }>('/:id/photos/order', async (req) => {
    const parsed = orderSchema.safeParse(req.body)
    if (!parsed.success || new Set(parsed.data.photoIds).size !== parsed.data.photoIds.length) throw new AppError(400, 'El orden de fotografías no es válido')
    return runOperation(req, async (db) => {
      if (!await db.product.findUnique({ where: { id: req.params.id }, select: { id: true } })) throw new AppError(404, 'Producto no encontrado')
      const photos = await db.productPhoto.findMany({ where: { productId: req.params.id }, select: { id: true } })
      const current = new Set(photos.map((photo) => photo.id))
      if (photos.length !== parsed.data.photoIds.length || parsed.data.photoIds.some((id) => !current.has(id))) {
        throw new AppError(409, 'Las fotografías cambiaron. Actualizá el producto e intentá nuevamente')
      }
      for (const [position, id] of parsed.data.photoIds.entries()) {
        await db.productPhoto.update({ where: { id }, data: { position } })
      }
      return db.productPhoto.findMany({ where: { productId: req.params.id }, orderBy: [{ position: 'asc' }, { id: 'asc' }], select: photoSelect })
    })
  })

  app.delete<{ Params: { id: string; photoId: string } }>('/:id/photos/:photoId', async (req, reply) => {
    await runOperation(req, async (db) => {
      const photo = await db.productPhoto.findFirst({ where: { id: req.params.photoId, productId: req.params.id }, select: { id: true } })
      if (!photo) throw new AppError(404, 'Fotografía no encontrada en este producto')
      // Unlink only. No Cloudinary destroy/delete operation is performed.
      await db.productPhoto.delete({ where: { id: photo.id } })
      const remaining = await db.productPhoto.findMany({ where: { productId: req.params.id }, orderBy: [{ position: 'asc' }, { id: 'asc' }], select: { id: true } })
      for (const [position, item] of remaining.entries()) await db.productPhoto.update({ where: { id: item.id }, data: { position } })
      return null
    })
    return reply.code(204).send()
  })
}
