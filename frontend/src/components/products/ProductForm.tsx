import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreateProduct } from '../../api/products'

function fmtMoney(n: number) {
  return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(n)
}

interface SpecRow { key: string; value: string }

export default function ProductForm() {
  const navigate = useNavigate()
  const [deviceId, setDeviceId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [askingPriceCRC, setAskingPriceCRC] = useState('')
  const [specs, setSpecs] = useState<SpecRow[]>([{ key: '', value: '' }])
  const [error, setError] = useState('')

  const create = useCreateProduct()

  function updateSpec(idx: number, field: keyof SpecRow, val: string) {
    setSpecs((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s))
  }
  function addSpec() { setSpecs((prev) => [...prev, { key: '', value: '' }]) }
  function removeSpec(idx: number) { setSpecs((prev) => prev.filter((_, i) => i !== idx)) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!deviceId.trim()) { setError('Ingrese el ID del equipo'); return }
    const displaySpecs: Record<string, string> = {}
    specs.forEach((s) => { if (s.key && s.value) displaySpecs[s.key] = s.value })
    try {
      const result = await create.mutateAsync({
        deviceId: deviceId.trim(),
        title,
        description: description || undefined,
        askingPriceCRC: Number(askingPriceCRC),
        displaySpecs: Object.keys(displaySpecs).length > 0 ? displaySpecs : undefined,
      })
      navigate(`/productos/${result.id}`)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: unknown } } }
      const raw = e?.response?.data?.error
      setError(typeof raw === 'string' ? raw : 'Error al crear el producto')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-md bg-blue-50 border border-blue-100 p-3 text-sm text-blue-800">
        Crea un producto para el catálogo público a partir de un equipo propio del taller.
        El equipo debe tener <strong>Tipo: Propio</strong> y ya debe estar registrado en el sistema.
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          ID del equipo propio <span className="text-red-500">*</span>
        </label>
        <input
          required
          value={deviceId}
          onChange={(e) => setDeviceId(e.target.value)}
          placeholder="Pega aquí el ID del equipo (cuid)"
          className="w-full border rounded-md px-3 py-2 text-sm font-mono"
        />
        <p className="text-xs text-gray-400 mt-1">
          Encuentra el ID en la ficha del equipo dentro de una orden de trabajo propia.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Título del listado <span className="text-red-500">*</span>
        </label>
        <input required value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="Ej: Laptop HP 250 G7 i5 8GB 256GB SSD"
          className="w-full border rounded-md px-3 py-2 text-sm" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
          placeholder="Estado, características destacadas, garantía incluida…"
          className="w-full border rounded-md px-3 py-2 text-sm" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Precio de venta ₡ <span className="text-red-500">*</span>
        </label>
        <input type="number" min="1" step="1000" required value={askingPriceCRC}
          onChange={(e) => setAskingPriceCRC(e.target.value)}
          className="w-full border rounded-md px-3 py-2 text-sm" />
        {askingPriceCRC && Number(askingPriceCRC) > 0 && (
          <p className="text-xs text-gray-500 mt-1">{fmtMoney(Number(askingPriceCRC))}</p>
        )}
      </div>

      {/* Specs para mostrar en catálogo público */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Especificaciones para catálogo
          </label>
          <button type="button" onClick={addSpec} className="text-xs text-blue-600 hover:underline">
            + Agregar
          </button>
        </div>
        <div className="space-y-1">
          {specs.map((s, idx) => (
            <div key={idx} className="grid grid-cols-5 gap-2">
              <input value={s.key} onChange={(e) => updateSpec(idx, 'key', e.target.value)}
                placeholder="Ej: Procesador"
                className="col-span-2 border rounded px-2 py-1.5 text-sm" />
              <input value={s.value} onChange={(e) => updateSpec(idx, 'value', e.target.value)}
                placeholder="Ej: Intel Core i5-10210U"
                className="col-span-2 border rounded px-2 py-1.5 text-sm" />
              <button type="button" onClick={() => removeSpec(idx)}
                className="text-xs text-red-400 hover:text-red-600">✕</button>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => navigate('/productos')}
          className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50">Cancelar</button>
        <button type="submit" disabled={create.isPending}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
          {create.isPending ? 'Creando…' : 'Crear producto'}
        </button>
      </div>
    </form>
  )
}
