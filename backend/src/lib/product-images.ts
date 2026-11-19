import { createHash } from 'node:crypto'
import { v2 as cloudinary } from 'cloudinary'
import { config } from './config'
import { AppError } from './errors'

export const PRODUCT_PHOTO_LIMIT = 10
export const PRODUCT_PHOTO_MAX_BYTES = 5 * 1024 * 1024

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
  secure: true,
})

export function imageMime(buffer: Buffer): string | undefined {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png'
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
}

export function productPhotoPublicId(productId: string, userId: string, key: string, digest: string) {
  const identity = createHash('sha256').update(JSON.stringify([userId, key, digest])).digest('hex')
  return `${config.cloudinary.assetFolder}/products/${productId}/${identity}`
}

export const productImageStorage = {
  async upload(buffer: Buffer, productId: string, publicId: string): Promise<{ url: string; publicId: string }> {
    const folder = `${config.cloudinary.assetFolder}/products/${productId}`
    if (!publicId.startsWith(folder + '/') || !/^[A-Za-z0-9_-]{1,128}$/.test(productId)) {
      throw new AppError(400, 'El identificador del producto no es válido')
    }
    return new Promise((resolve, reject) => {
      const fail = (error?: { http_code?: number }) => reject(error?.http_code === 400
        ? new AppError(422, 'No se pudo procesar la imagen. Seleccioná una fotografía JPG, PNG o WebP válida')
        : new AppError(502, 'No se pudo cargar la fotografía. Intentá nuevamente con el mismo archivo'))
      try {
        const stream = cloudinary.uploader.upload_stream({
          resource_type: 'image', type: 'upload',
          asset_folder: folder, public_id: publicId,
          use_asset_folder_as_public_id_prefix: false,
          overwrite: false, use_filename: false, unique_filename: false,
          allowed_formats: ['jpg', 'jpeg', 'png', 'webp'], format: 'webp',
          transformation: [{ width: 2400, height: 2400, crop: 'limit', quality: 'auto', flags: 'strip_profile' }],
          timeout: 60000,
        }, (error, result) => {
          if (error) return fail(error)
          if (!result || result.public_id !== publicId || result.resource_type !== 'image') return fail()
          try {
            const url = new URL(result.secure_url)
            if (url.origin !== 'https://res.cloudinary.com' || !url.pathname.startsWith(`/${config.cloudinary.cloudName}/image/upload/`)) return fail()
            resolve({ url: url.toString(), publicId })
          } catch { fail() }
        })
        stream.once('error', () => fail())
        stream.end(buffer)
      } catch { fail() }
    })
  },
}
