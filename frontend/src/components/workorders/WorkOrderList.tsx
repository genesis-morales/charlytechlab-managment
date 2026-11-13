import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useWorkOrders, STATUS_LABELS, STATUS_COLORS, type WorkOrderDeviceStatus } from '../../api/workorders'

function fmt(d: string) {
  return new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium' }).format(new Date(d))
}

// Estado "más urgente" de la lista de dispositivos de una orden
function aggregateStatus(statuses: WorkOrderDeviceStatus[]): WorkOrderDeviceStatus {
  const priority: WorkOrderDeviceStatus[] = [
    'WAITING_PARTS', 'REPAIRING', 'QUALITY_CHECK', 'AWAITING_APPROVAL',
    'DIAGNOSING', 'READY_FOR_DELIVERY', 'QUOTED', 'APPROVED',
    'RECEIVED', 'WARRANTY_CLAIM', 'DELIVERED', 'CANCELLED', 'REJECTED_BY_CUSTOMER', 'CLOSED',
  ]
  for (const p of priority) {
    if (statuses.includes(p)) return p
  }
  return statuses[0] ?? 'RECEIVED'
}

export default function WorkOrderList() {
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading, isError } = useWorkOrders({ q: search || undefined, page, limit: 20 })

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(q)
    setPage(1)
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por número de orden o nombre del cliente…"
          className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">
          Buscar
        </button>
        {search && (
          <button type="button" onClick={() => { setSearch(''); setQ(''); setPage(1) }}
            className="px-3 py-2 text-sm border rounded-md hover:bg-gray-50">
            Limpiar
          </button>
        )}
      </form>

      {isLoading && <p className="text-sm text-gray-500">Cargando órdenes…</p>}
      {isError && <p className="text-sm text-red-500">Error al cargar órdenes.</p>}

      {data && (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Orden</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Equipos</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.data.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                      {search ? 'Sin resultados.' : 'Aún no hay órdenes registradas.'}
                    </td>
                  </tr>
                )}
                {data.data.map((o) => {
                  const statuses = o.devices.map((d) => d.status)
                  const agg = aggregateStatus(statuses)
                  return (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link to={`/ordenes/${o.id}`} className="font-medium text-blue-700 hover:underline">
                          {o.number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/clientes/${o.customer.id}`} className="hover:underline text-gray-800">
                          {o.customer.name}
                        </Link>
                        <span className="text-gray-400 ml-1 text-xs">{o.customer.phone}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {o.devices.map((d, i) => (
                          <span key={d.id} className={i > 0 ? 'block' : ''}>
                            {d.device.brand} {d.device.model || d.device.deviceType}
                          </span>
                        ))}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[agg]}`}>
                          {STATUS_LABELS[agg]}
                        </span>
                        {statuses.length > 1 && (
                          <span className="ml-1 text-xs text-gray-400">({statuses.length} equipos)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{fmt(o.createdAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {data.meta.pages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
              <span>
                {(page - 1) * 20 + 1}–{Math.min(page * 20, data.meta.total)} de {data.meta.total} órdenes
              </span>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50">
                  ← Anterior
                </button>
                <button onClick={() => setPage((p) => Math.min(data.meta.pages, p + 1))} disabled={page === data.meta.pages}
                  className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50">
                  Siguiente →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
