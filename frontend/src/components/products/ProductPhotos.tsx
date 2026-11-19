import { useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ImagePlus, Star } from 'lucide-react'
import { useOrderProductPhotos, useRemoveProductPhoto, useUploadProductPhoto, type ProductPhoto } from '../../api/products'

const MAX_PHOTOS = 10
const MAX_BYTES = 5 * 1024 * 1024
const FORMATS = ['image/jpeg', 'image/png', 'image/webp']

function message(error: unknown) {
  const value = (error as { response?: { data?: { error?: unknown } } })?.response?.data?.error
  return typeof value === 'string' ? value : 'No se pudo confirmar la operación. Revisá el estado del producto antes de volver a intentar'
}

export default function ProductPhotos({ productId, title, photos }: { productId: string; title: string; photos: ProductPhoto[] }) {
  const upload = useUploadProductPhoto(productId)
  const order = useOrderProductPhotos(productId)
  const remove = useRemoveProductPhoto(productId)
  const input = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const busy = uploading || order.isPending || remove.isPending

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!files.length) { setError('Seleccioná al menos una fotografía'); return }
    if (files.length + photos.length > MAX_PHOTOS) { setError('El producto admite hasta 10 fotografías'); return }
    if (files.some(file => !FORMATS.includes(file.type) || file.size === 0 || file.size > MAX_BYTES)) {
      setError('Seleccioná fotografías JPG, PNG o WebP de hasta 5 MB cada una')
      return
    }
    setUploading(true)
    let completed = 0
    try {
      for (const file of files) {
        setProgress(completed + 1)
        await upload.mutateAsync(file)
        completed++
      }
      setNotice(`${completed} ${completed === 1 ? 'fotografía cargada' : 'fotografías cargadas'}`)
      setFiles([])
      if (input.current) input.current.value = ''
    } catch (failure) {
      setFiles(files.slice(completed))
      setError(`${completed ? `Se cargaron ${completed} fotografías. ` : ''}${message(failure)}`)
    } finally { setUploading(false) }
  }

  async function move(photoId: string, destination: number) {
    setError('')
    setNotice('')
    const ids = photos.map(photo => photo.id)
    const position = ids.indexOf(photoId)
    if (position < 0 || destination < 0 || destination >= ids.length) return
    ids.splice(position, 1)
    ids.splice(destination, 0, photoId)
    try {
      await order.mutateAsync(ids)
      setNotice('Orden de fotografías actualizado')
    } catch (failure) { setError(message(failure)) }
  }

  async function unlink(photoId: string) {
    if (!window.confirm('¿Quitar esta foto del producto? El original se conserva en la biblioteca de imágenes.')) return
    setError('')
    setNotice('')
    try {
      await remove.mutateAsync(photoId)
      setNotice('Fotografía retirada del producto. El original se conserva')
    } catch (failure) { setError(message(failure)) }
  }

  return (
    <section aria-labelledby="product-photos-title" className="min-w-0 rounded-lg border bg-white p-4 space-y-4">
      <div>
        <h3 id="product-photos-title" className="font-semibold text-gray-800">Fotografías del producto</h3>
        <p className="text-sm text-gray-500 mt-1">La primera fotografía es la portada del catálogo. JPG, PNG o WebP; hasta 5 MB por archivo y 10 fotos por producto.</p>
      </div>
      <fieldset disabled={busy} className="min-w-0 space-y-4 disabled:opacity-70">
        <legend className="sr-only">Gestionar fotografías de {title}</legend>
        {photos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {photos.map((photo, index) => (
              <div key={photo.id} className="border rounded-lg overflow-hidden">
                <img src={photo.url} alt={`Foto ${index + 1} de ${title}`} loading="lazy" className="h-44 w-full object-contain bg-gray-50" />
                <div className="p-3 space-y-3">
                  <p className="text-xs font-medium text-gray-600">{index === 0 ? 'Portada' : `Fotografía ${index + 1}`}</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={index === 0} onClick={() => { void move(photo.id, 0) }} className="inline-flex items-center gap-1 border rounded px-2 py-2 text-xs disabled:opacity-40">
                      <Star size={14} aria-hidden="true" /> Usar como portada
                    </button>
                    <button type="button" disabled={index === 0} aria-label={`Mover foto ${index + 1} hacia el inicio`} onClick={() => { void move(photo.id, index - 1) }} className="border rounded p-2 disabled:opacity-40"><ArrowLeft size={16} aria-hidden="true" /></button>
                    <button type="button" disabled={index === photos.length - 1} aria-label={`Mover foto ${index + 1} hacia el final`} onClick={() => { void move(photo.id, index + 1) }} className="border rounded p-2 disabled:opacity-40"><ArrowRight size={16} aria-hidden="true" /></button>
                  </div>
                  <button type="button" onClick={() => { void unlink(photo.id) }} className="text-xs text-red-600 underline py-1">Quitar del producto</button>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-gray-500">Este producto todavía no tiene fotografías.</p>}
        <form onSubmit={handleUpload} className="border-t pt-4 space-y-3">
          <label htmlFor="product-photo-files" className="block text-sm font-medium">Agregar fotografías ({photos.length}/{MAX_PHOTOS})</label>
          <input id="product-photo-files" ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={photos.length >= MAX_PHOTOS}
            onChange={event => { setFiles(Array.from(event.target.files ?? [])); setError(''); setNotice('') }} className="block w-full text-sm" />
          {files.length > 0 && <p className="text-xs text-gray-500">{files.length} {files.length === 1 ? 'archivo seleccionado' : 'archivos seleccionados'}</p>}
          <button type="submit" disabled={!files.length || photos.length >= MAX_PHOTOS} className="inline-flex items-center gap-2 text-sm px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
            <ImagePlus size={16} aria-hidden="true" /> {uploading ? `Cargando ${progress} de ${files.length}…` : 'Cargar fotografías'}
          </button>
        </form>
      </fieldset>
      <p className="text-xs text-gray-500">Quitar una foto la retira de este producto; conserva el original en la biblioteca de imágenes.</p>
      {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </section>
  )
}
