import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useShipments, useCreateShipment, useImportSummary, SHIPMENT_STATUS_LABELS, SHIPMENT_STATUS_COLORS } from '../../api/imports'

function fmt(d: string) {
  return new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium' }).format(new Date(d))
}
function fmtMoney(n: string | number | null | undefined) {
  if (n == null || n === '') return '—'
  return new Intl.NumberFormat('es-CR', {
    style: 'currency', currency: 'CRC', maximumFractionDigits: 0,
  }).format(Number(n))
}

export default function ShipmentList() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState({
    trackingNumber: '', origin: 'eBay US', notes: '',
    purchasedAt: '', estimatedArrival: '',
  })

  const { data, isLoading } = useShipments({ q: search || undefined, page, limit: 20 })
  const { data: summary } = useImportSummary()
  const create = useCreateShipment()

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(q)
    setPage(1)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const result = await create.mutateAsync({
      trackingNumber: newForm.trackingNumber || undefined,
      origin: newForm.origin || undefined,
      notes: newForm.notes || undefined,
      purchasedAt: newForm.purchasedAt ? new Date(newForm.purchasedAt).toISOString() : undefined,
      estimatedArrival: newForm.estimatedArrival ? new Date(newForm.estimatedArrival).toISOString() : undefined,
    })
    setShowNew(false)
    setNewForm({ trackingNumber: '', origin: 'eBay US', notes: '', purchasedAt: '', estimatedArrival: '' })
    navigate(`/importaciones/${result.id}`)
  }

  return (
    <div className="space-y-4">
      {/* Resumen de envíos activos */}
      {summary && summary.totalInTransit > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-orange-700">{summary.totalInTransit}</p>
            <p className="text-xs text-orange-600">Envíos activos</p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-700">{summary.totalItemsPending}</p>
            <p className="text-xs text-blue-600">Artículos en camino</p>
          </div>
          <div className="bg-gray-50 border rounded-lg p-3 text-center">
            <p className="text-sm font-bold text-gray-700 tabular-nums">
              {fmtMoney(
                String(Number(summary.pendingCosts.shipping) +
                Number(summary.pendingCosts.customs) +
                Number(summary.pendingCosts.handling))
              )}
            </p>
            <p className="text-xs text-gray-500">Costos de import pendientes</p>
          </div>
        </div>
      )}

      {/* Controles */}
      <div className="flex gap-2">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <input type="text" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por tracking o origen…"
            className="flex-1 border rounded-md px-3 py-2 text-sm" />
          <button type="submit" className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md">Buscar</button>
        </form>
        <button onClick={() => setShowNew((v) => !v)}
          className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">
          + Nuevo envío
        </button>
      </div>

      {/* Formulario nuevo envío */}
      {showNew && (
        <form onSubmit={handleCreate} className="border rounded-lg p-4 space-y-3 bg-gray-50">
          <h4 className="font-semibold text-sm">Nuevo envío / importación</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500">Origen</label>
              <input value={newForm.origin} onChange={(e) => setNewForm((f) => ({ ...f, origin: e.target.value }))}
                placeholder="eBay US, Amazon…"
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Tracking (opcional)</label>
              <input value={newForm.trackingNumber} onChange={(e) => setNewForm((f) => ({ ...f, trackingNumber: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Fecha de compra</label>
              <input type="date" value={newForm.purchasedAt}
                onChange={(e) => setNewForm((f) => ({ ...f, purchasedAt: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Llegada estimada</label>
              <input type="date" value={newForm.estimatedArrival}
                onChange={(e) => setNewForm((f) => ({ ...f, estimatedArrival: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500">Notas</label>
              <input value={newForm.notes} onChange={(e) => setNewForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowNew(false)}
              className="text-xs px-3 py-1.5 border rounded">Cancelar</button>
            <button type="submit" disabled={create.isPending}
              className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded disabled:opacity-50">
              {create.isPending ? 'Creando…' : 'Crear envío'}
            </button>
          </div>
        </form>
      )}

      {/* Tabla */}
      {isLoading && <p className="text-sm text-gray-500">Cargando envíos…</p>}
      {data && (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Envío</th>
                  <th className="px-3 py-2 font-medium">Origen</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium text-center">Arts.</th>
                  <th className="px-3 py-2 font-medium text-right">Costo total</th>
                  <th className="px-3 py-2 font-medium">Estimado</th>
                  <th className="px-3 py-2 font-medium">Creado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.data.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                      Sin envíos registrados.
                    </td>
                  </tr>
                )}
                {data.data.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <Link to={`/importaciones/${s.id}`} className="font-medium text-blue-700 hover:underline">
                        #{s.id.slice(-6).toUpperCase()}
                      </Link>
                      {s.trackingNumber && (
                        <p className="text-xs text-gray-400">{s.trackingNumber}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{s.origin ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${SHIPMENT_STATUS_COLORS[s.status]}`}>
                        {SHIPMENT_STATUS_LABELS[s.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums">{s._count?.items ?? s.items.length}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(s.totalCostCRC)}</td>
                    <td className="px-3 py-2 text-gray-500">
                      {s.estimatedArrival ? fmt(s.estimatedArrival) : '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{fmt(s.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.meta.pages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>{(page - 1) * 20 + 1}–{Math.min(page * 20, data.meta.total)} de {data.meta.total}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50">← Anterior</button>
                <button onClick={() => setPage((p) => Math.min(data.meta.pages, p + 1))} disabled={page === data.meta.pages}
                  className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50">Siguiente →</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
