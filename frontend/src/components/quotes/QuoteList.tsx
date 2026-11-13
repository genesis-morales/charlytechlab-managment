import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuotes, QUOTE_STATUS_LABELS, QUOTE_STATUS_COLORS } from '../../api/quotes'

function fmt(d: string) {
  return new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium' }).format(new Date(d))
}
function fmtMoney(n: number | string) {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency', currency: 'CRC', maximumFractionDigits: 0,
  }).format(Number(n))
}

export default function QuoteList() {
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading, isError } = useQuotes({ q: search || undefined, page, limit: 20 })

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(q)
    setPage(1)
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input
          type="text" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por número o nombre del cliente…"
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

      {isLoading && <p className="text-sm text-gray-500">Cargando cotizaciones…</p>}
      {isError && <p className="text-sm text-red-500">Error al cargar cotizaciones.</p>}

      {data && (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Número</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Orden</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      {search ? 'Sin resultados.' : 'Aún no hay cotizaciones registradas.'}
                    </td>
                  </tr>
                )}
                {data.data.map((q) => (
                  <tr key={q.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to={`/cotizaciones/${q.id}`} className="font-medium text-blue-700 hover:underline">
                        {q.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {q.customer ? (
                        <Link to={`/clientes/${q.customer.id}`} className="hover:underline text-gray-800">
                          {q.customer.name}
                        </Link>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {q.workOrder ? (
                        <Link to={`/ordenes/${q.workOrder.id}`} className="text-gray-600 hover:underline">
                          {q.workOrder.number}
                        </Link>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${QUOTE_STATUS_COLORS[q.status]}`}>
                        {QUOTE_STATUS_LABELS[q.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{fmtMoney(q.total)}</td>
                    <td className="px-4 py-3 text-gray-500">{fmt(q.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.meta.pages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
              <span>
                {(page - 1) * 20 + 1}–{Math.min(page * 20, data.meta.total)} de {data.meta.total} cotizaciones
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
