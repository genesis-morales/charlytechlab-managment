import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSuppliers, useCreateSupplier, useDeleteSupplier } from '../../api/suppliers'

export default function SupplierList() {
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [isLocalFilter, setIsLocalFilter] = useState('')
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '', isLocal: true, country: '', contact: '', website: '', notes: '',
  })
  const [error, setError] = useState('')

  const { data, isLoading, isError } = useSuppliers({
    q: search || undefined, isLocal: isLocalFilter || undefined, page, limit: 50,
  })
  const create = useCreateSupplier()
  const del = useDeleteSupplier()

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await create.mutateAsync({
        name: form.name,
        isLocal: form.isLocal,
        country: form.country || undefined,
        contact: form.contact || undefined,
        website: form.website || undefined,
        notes: form.notes || undefined,
      })
      setShowForm(false)
      setForm({ name: '', isLocal: true, country: '', contact: '', website: '', notes: '' })
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: unknown } } }
      const raw = e?.response?.data?.error
      setError(typeof raw === 'string' ? raw : 'Error al crear proveedor')
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar al proveedor "${name}"?`)) return
    try {
      await del.mutateAsync(id)
    } catch {
      alert('No se puede eliminar: tiene compras o solicitudes de repuesto asociadas.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input
          type="text" value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (setSearch(q), setPage(1))}
          placeholder="Buscar proveedor…"
          className="flex-1 border rounded-md px-3 py-2 text-sm"
        />
        <select value={isLocalFilter} onChange={(e) => { setIsLocalFilter(e.target.value); setPage(1) }}
          className="border rounded-md px-3 py-2 text-sm">
          <option value="">Todos</option>
          <option value="true">Locales</option>
          <option value="false">Internacionales</option>
        </select>
        <button onClick={() => setShowForm((v) => !v)}
          className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">
          + Nuevo proveedor
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="border rounded-lg p-4 space-y-3 bg-gray-50">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500">Nombre *</label>
              <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Tipo</label>
              <select value={form.isLocal ? 'true' : 'false'}
                onChange={(e) => setForm((f) => ({ ...f, isLocal: e.target.value === 'true' }))}
                className="w-full border rounded px-2 py-1.5 text-sm">
                <option value="true">Local</option>
                <option value="false">Internacional</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">País</label>
              <input value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                placeholder="Costa Rica, USA…"
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Contacto</label>
              <input value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Sitio web</label>
              <input value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div className="col-span-2 sm:col-span-3">
              <label className="text-xs text-gray-500">Notas</label>
              <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)}
              className="text-xs px-3 py-1.5 border rounded">Cancelar</button>
            <button type="submit" disabled={create.isPending}
              className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded disabled:opacity-50">
              {create.isPending ? 'Guardando…' : 'Crear'}
            </button>
          </div>
        </form>
      )}

      {isLoading && <p className="text-sm text-gray-500">Cargando proveedores…</p>}
      {isError && <p className="text-sm text-red-500">Error al cargar.</p>}

      {data && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">País</th>
                <th className="px-4 py-3 font-medium text-center">Compras</th>
                <th className="px-4 py-3 font-medium text-center">Repuestos</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.data.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Sin proveedores.</td></tr>
              )}
              {data.data.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/proveedores/${s.id}`} className="font-medium text-blue-700 hover:underline">
                      {s.name}
                    </Link>
                    {s.contact && <span className="text-xs text-gray-400 block">{s.contact}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs rounded-full px-2 py-0.5 ${s.isLocal ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      {s.isLocal ? 'Local' : 'Internacional'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{s.country ?? '—'}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{s._count?.purchases ?? 0}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{s._count?.partRequests ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(s.id, s.name)}
                      className="text-xs text-red-400 hover:text-red-600">Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
