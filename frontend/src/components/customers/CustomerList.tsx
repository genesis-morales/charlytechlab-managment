import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCustomers, useDeactivateCustomer } from '../../api/customers'

export default function CustomerList() {
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const navigate = useNavigate()

  const { data, isLoading, isError } = useCustomers({ q: search || undefined, page, limit: 20 })
  const deactivate = useDeactivateCustomer()

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(q)
    setPage(1)
  }

  async function handleDeactivate(id: string, name: string) {
    if (!confirm(`¿Desactivar al cliente "${name}"? No se eliminan sus datos.`)) return
    await deactivate.mutateAsync(id)
  }

  return (
    <div>
      {/* Barra de búsqueda */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, teléfono, correo u orden…"
          className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
        >
          Buscar
        </button>
        {search && (
          <button
            type="button"
            onClick={() => { setSearch(''); setQ(''); setPage(1) }}
            className="px-3 py-2 text-sm border rounded-md hover:bg-gray-50"
          >
            Limpiar
          </button>
        )}
      </form>

      {/* Tabla */}
      {isLoading && <p className="text-sm text-gray-500">Cargando clientes…</p>}
      {isError && <p className="text-sm text-red-500">Error al cargar clientes.</p>}

      {data && (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Teléfono</th>
                  <th className="px-4 py-3 font-medium">Correo</th>
                  <th className="px-4 py-3 font-medium text-center">Órdenes</th>
                  <th className="px-4 py-3 font-medium text-center">Cotiz.</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.data.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                      {search ? 'Sin resultados para esa búsqueda.' : 'Aún no hay clientes registrados.'}
                    </td>
                  </tr>
                )}
                {data.data.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        to={`/clientes/${c.id}`}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{c.phone}</td>
                    <td className="px-4 py-3 text-gray-500">{c.email ?? '—'}</td>
                    <td className="px-4 py-3 text-center tabular-nums">
                      {c._count?.workOrders ?? 0}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">
                      {c._count?.quotes ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {c.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => navigate(`/clientes/${c.id}/editar`)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Editar
                        </button>
                        {c.isActive && (
                          <button
                            onClick={() => handleDeactivate(c.id, c.name)}
                            className="text-xs text-red-500 hover:underline"
                          >
                            Desactivar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginacion */}
          {data.meta.pages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
              <span>
                {(page - 1) * 20 + 1}–{Math.min(page * 20, data.meta.total)} de {data.meta.total} clientes
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
                >
                  ← Anterior
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(data.meta.pages, p + 1))}
                  disabled={page === data.meta.pages}
                  className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
                >
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
