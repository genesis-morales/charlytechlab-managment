import { useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  useProduct,
  usePublishProduct,
  useReserveProduct,
  useCancelReservation,
  useSellProduct,
  useCreateWarrantyClaim,
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUS_COLORS,
} from '../../api/products'

function fmt(d: string) {
  return new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium' }).format(new Date(d))
}
function fmtMoney(n: string | number) {
  return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(Number(n))
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: product, isLoading, isError } = useProduct(id!)
  const publish = usePublishProduct()
  const reserve = useReserveProduct()
  const cancelRes = useCancelReservation()
  const sell = useSellProduct()
  const createClaim = useCreateWarrantyClaim()

  const [showReserve, setShowReserve] = useState(false)
  const [resForm, setResForm] = useState({ name: '', phone: '', email: '', notes: '' })
  const [showSell, setShowSell] = useState(false)
  const [sellForm, setSellForm] = useState({ customerId: '', warrantyMonths: '6' })
  const [claimText, setClaimText] = useState('')

  if (isLoading) return <p className="text-sm text-gray-500 p-4">Cargando producto…</p>
  if (isError || !product) return <p className="text-sm text-red-500 p-4">Producto no encontrado.</p>

  const specs = product.displaySpecs as Record<string, string> | null

  async function handleReserve(e: React.FormEvent) {
    e.preventDefault()
    await reserve.mutateAsync({
      id: product!.id,
      name: resForm.name,
      phone: resForm.phone,
      email: resForm.email || undefined,
      notes: resForm.notes || undefined,
    })
    setShowReserve(false)
    setResForm({ name: '', phone: '', email: '', notes: '' })
  }

  async function handleSell(e: React.FormEvent) {
    e.preventDefault()
    await sell.mutateAsync({
      id: product!.id,
      customerId: sellForm.customerId || undefined,
      warrantyMonths: Number(sellForm.warrantyMonths),
    })
    setShowSell(false)
  }

  async function handleClaim(e: React.FormEvent) {
    e.preventDefault()
    await createClaim.mutateAsync({ productId: product!.id, description: claimText })
    setClaimText('')
  }

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">{product.title}</h2>
          {product.device && (
            <p className="text-sm text-gray-500 mt-0.5">
              {product.device.brand} {product.device.model} · {product.device.deviceType}
            </p>
          )}
        </div>
        <span className={`text-sm font-medium rounded-full px-3 py-1 ${PRODUCT_STATUS_COLORS[product.status]}`}>
          {PRODUCT_STATUS_LABELS[product.status]}
        </span>
      </div>

      {/* Precio */}
      <div className="text-2xl font-bold tabular-nums">{fmtMoney(product.askingPriceCRC)}</div>

      {/* Descripción */}
      {product.description && (
        <div className="text-sm text-gray-600 whitespace-pre-wrap">{product.description}</div>
      )}

      {/* Specs */}
      {specs && Object.keys(specs).length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-800 mb-2">Especificaciones</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {Object.entries(specs).map(([k, v]) => (
              <div key={k} className="flex justify-between border-b pb-1">
                <dt className="text-gray-500">{k}</dt>
                <dd className="font-medium text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Datos del equipo */}
      {product.device && (
        <div>
          <h3 className="font-semibold text-gray-800 mb-2">Datos del equipo</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            {product.device.processor && <div><span className="text-gray-400">CPU</span> {product.device.processor}</div>}
            {product.device.ram && <div><span className="text-gray-400">RAM</span> {product.device.ram}</div>}
            {product.device.storage && <div><span className="text-gray-400">Almac.</span> {product.device.storage}</div>}
          </div>
        </div>
      )}

      {/* Acciones según estado */}
      <div className="flex flex-wrap gap-2">
        {product.status === 'COMING_SOON' && (
          <button onClick={() => publish.mutate(product.id)} disabled={publish.isPending}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50">
            Publicar (disponible)
          </button>
        )}
        {product.status === 'AVAILABLE' && (
          <button onClick={() => setShowReserve((v) => !v)}
            className="px-4 py-2 text-sm border border-orange-300 text-orange-700 rounded-md hover:bg-orange-50">
            Reservar
          </button>
        )}
        {product.status === 'RESERVED' && (
          <button onClick={() => { if (confirm('¿Cancelar reserva?')) cancelRes.mutate(product.id) }}
            className="px-4 py-2 text-sm border border-red-200 text-red-600 rounded-md hover:bg-red-50">
            Cancelar reserva
          </button>
        )}
        {(product.status === 'AVAILABLE' || product.status === 'RESERVED') && (
          <button onClick={() => setShowSell((v) => !v)}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
            Marcar como vendido
          </button>
        )}
      </div>

      {/* Reserva activa */}
      {product.reservations && product.reservations.length > 0 && (
        <div className="rounded-lg border p-4 bg-orange-50">
          <h3 className="font-semibold text-orange-800 mb-2">Reserva activa</h3>
          {product.reservations.map((r) => (
            <div key={r.id} className="text-sm">
              <p><strong>{r.name}</strong> · {r.phone}{r.email && ` · ${r.email}`}</p>
              {r.notes && <p className="text-gray-500">{r.notes}</p>}
              <p className="text-xs text-orange-600 mt-1">Expira: {fmt(r.expiresAt)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Formulario de reserva */}
      {showReserve && (
        <form onSubmit={handleReserve} className="border rounded-lg p-4 space-y-3 bg-orange-50">
          <h4 className="font-medium text-sm">Reservar producto</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Nombre *</label>
              <input required value={resForm.name} onChange={(e) => setResForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Teléfono *</label>
              <input required value={resForm.phone} onChange={(e) => setResForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Correo</label>
              <input value={resForm.email} onChange={(e) => setResForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Notas</label>
              <input value={resForm.notes} onChange={(e) => setResForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowReserve(false)}
              className="text-xs px-2 py-1 border rounded">Cancelar</button>
            <button type="submit" disabled={reserve.isPending}
              className="text-xs px-2 py-1 bg-orange-600 text-white rounded disabled:opacity-50">
              {reserve.isPending ? '…' : 'Confirmar reserva'}
            </button>
          </div>
        </form>
      )}

      {/* Formulario de venta */}
      {showSell && (
        <form onSubmit={handleSell} className="border rounded-lg p-4 space-y-3 bg-blue-50">
          <h4 className="font-medium text-sm">Registrar venta</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">ID del cliente (opcional)</label>
              <input value={sellForm.customerId} onChange={(e) => setSellForm((f) => ({ ...f, customerId: e.target.value }))}
                placeholder="cuid del cliente"
                className="w-full border rounded px-2 py-1.5 text-sm font-mono" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Meses de garantía</label>
              <input type="number" min="1" max="24" required value={sellForm.warrantyMonths}
                onChange={(e) => setSellForm((f) => ({ ...f, warrantyMonths: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Si se especifica un cliente, se crea la garantía automáticamente.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowSell(false)}
              className="text-xs px-2 py-1 border rounded">Cancelar</button>
            <button type="submit" disabled={sell.isPending}
              className="text-xs px-2 py-1 bg-blue-600 text-white rounded disabled:opacity-50">
              {sell.isPending ? '…' : 'Confirmar venta'}
            </button>
          </div>
        </form>
      )}

      {/* Garantía */}
      {product.warranty && (
        <div className="rounded-lg border p-4">
          <h3 className="font-semibold text-gray-800 mb-2">Garantía</h3>
          <div className="flex items-center gap-4 text-sm mb-3">
            <span>Inicio: <strong>{fmt(product.warranty.startsAt)}</strong></span>
            <span>Vence: <strong>{fmt(product.warranty.expiresAt)}</strong></span>
            <span className={`text-xs rounded-full px-2 py-0.5 ${
              product.warranty.isActive && new Date(product.warranty.expiresAt) > new Date()
                ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {product.warranty.isActive && new Date(product.warranty.expiresAt) > new Date() ? 'Vigente' : 'Expirada'}
            </span>
          </div>

          {/* Reclamos */}
          <div className="mt-3">
            <h4 className="text-sm font-medium text-gray-700 mb-1">Reclamos de garantía</h4>
            {product.warranty.claims.length > 0 && (
              <div className="space-y-1 mb-2">
                {product.warranty.claims.map((c) => (
                  <div key={c.id} className="text-sm border rounded p-2">
                    <p>{c.description}</p>
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>{fmt(c.claimedAt)}</span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5">{c.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {product.warranty.isActive && new Date(product.warranty.expiresAt) > new Date() && (
              <form onSubmit={handleClaim} className="flex gap-2">
                <input required value={claimText} onChange={(e) => setClaimText(e.target.value)}
                  placeholder="Describir problema…"
                  className="flex-1 border rounded px-2 py-1.5 text-sm" />
                <button type="submit" disabled={createClaim.isPending}
                  className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded disabled:opacity-50">
                  {createClaim.isPending ? '…' : 'Registrar reclamo'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Consultas recibidas */}
      {product.inquiries && product.inquiries.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-800 mb-2">Consultas recibidas</h3>
          <div className="space-y-1">
            {product.inquiries.map((inq) => (
              <div key={inq.id} className="text-sm border rounded p-2">
                <p><strong>{inq.name}</strong> · {inq.phone}{inq.email && ` · ${inq.email}`}</p>
                {inq.message && <p className="text-gray-500 text-xs mt-0.5">{inq.message}</p>}
                <p className="text-xs text-gray-400 mt-0.5">{fmt(inq.createdAt)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
