import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePurchases } from '../../api/suppliers'

function fmt(d: string) {
  return new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium' }).format(new Date(d))
}
function fmtMoney(n: string | number) {
  return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(Number(n))
}

export default function PurchaseList() {
  const [page, setPage] = useState(1)
  const { data, isLoading, isError } = usePurchases({ page, limit: 20 })

  return (
    <div className="space-y-4">
      {isLoading && <p className="text-sm text-gray-500">Cargando compras…</p>}
      {isError && <p className="text-sm text-red-500">Error al cargar compras.</p>}

      {data && (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Proveedor</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium text-center">Arts.</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.data.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Sin compras registradas.</td></tr>
                )}
                {data.data.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {p.supplier ? (
                        <Link to={`/proveedores/${p.supplier.id}`} className="text-blue-700 hover:underline">
                          {p.supplier.name}
                        </Link>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{fmt(p.purchasedAt)}</td>
                    <td className="px-4 py-3 text-center tabular-nums">{p._count?.items ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{fmtMoney(p.totalCRC)}</td>
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
