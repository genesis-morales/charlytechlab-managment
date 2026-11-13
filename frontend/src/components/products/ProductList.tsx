import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  useProducts,
  usePublishProduct,
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUS_COLORS,
  type ProductStatus,
} from '../../api/products'

function fmtMoney(n: string | number) {
  return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(Number(n))
}

export default function ProductList() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('')
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useProducts({
    status: statusFilter || undefined, q: search || undefined, page, limit: 20,
  })
  const publish = usePublishProduct()

  const ALL_STATUSES: ProductStatus[] = ['COMING_SOON', 'AVAILABLE', 'RESERVED', 'SOLD']

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (setSearch(q), setPage(1))}
          placeholder="Buscar producto…"
          className="flex-1 border rounded-md px-3 py-2 text-sm" />
        <div className="flex gap-1">
          <button onClick={() => { setStatusFilter(''); setPage(1) }}
            className={`px-3 py-1.5 text-sm rounded-md border ${!statusFilter ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50'}`}>
            Todos
          </button>
          {ALL_STATUSES.map((s) => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1) }}
              className={`px-3 py-1.5 text-sm rounded-md border ${statusFilter === s ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50'}`}>
              {PRODUCT_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <button onClick={() => navigate('/productos/nuevo')}
          className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">
          + Publicar producto
        </button>
      </div>

      {isLoading && <p className="text-sm text-gray-500">Cargando productos…</p>}

      {data && (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Producto</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium text-right">Precio</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.data.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Sin productos.</td></tr>
                )}
                {data.data.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to={`/productos/${p.id}`} className="font-medium text-blue-700 hover:underline">
                        {p.title}
                      </Link>
                      {p.device && (
                        <p className="text-xs text-gray-400">
                          {p.device.brand} {p.device.model} · {p.device.ram} · {p.device.storage}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${PRODUCT_STATUS_COLORS[p.status]}`}>
                        {PRODUCT_STATUS_LABELS[p.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{fmtMoney(p.askingPriceCRC)}</td>
                    <td className="px-4 py-3 text-right">
                      {p.status === 'COMING_SOON' && (
                        <button onClick={() => publish.mutate(p.id)}
                          disabled={publish.isPending}
                          className="text-xs text-green-600 hover:underline disabled:opacity-50">
                          Publicar
                        </button>
                      )}
                    </td>
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
