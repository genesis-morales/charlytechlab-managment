import { useParams } from 'react-router-dom'
import { useSupplier } from '../../api/suppliers'

function fmt(d: string) {
  return new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium' }).format(new Date(d))
}
function fmtMoney(n: string | number) {
  return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(Number(n))
}

const PART_STATUS: Record<string, string> = {
  TO_BUY: 'Por comprar', PURCHASED: 'Comprado', RECEIVED_IN_MAILBOX: 'En casillero',
  IN_TRANSIT: 'En tránsito', IN_CUSTOMS: 'En aduana', RECEIVED_IN_CR: 'Recibido CR', INSPECTED: 'Inspeccionado',
}

export default function SupplierDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: supplier, isLoading, isError } = useSupplier(id!)

  if (isLoading) return <p className="text-sm text-gray-500 p-4">Cargando…</p>
  if (isError || !supplier) return <p className="text-sm text-red-500 p-4">Proveedor no encontrado.</p>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">{supplier.name}</h2>
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-xs rounded-full px-2 py-0.5 ${supplier.isLocal ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
            {supplier.isLocal ? 'Local' : 'Internacional'}
          </span>
          {supplier.country && <span className="text-sm text-gray-500">{supplier.country}</span>}
        </div>
        {(supplier.contact || supplier.website) && (
          <p className="text-sm text-gray-500 mt-1">
            {supplier.contact && <span>{supplier.contact}</span>}
            {supplier.contact && supplier.website && ' · '}
            {supplier.website && (
              <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                {supplier.website}
              </a>
            )}
          </p>
        )}
        {supplier.notes && (
          <p className="text-sm text-gray-500 mt-1">{supplier.notes}</p>
        )}
      </div>

      {/* Compras recientes */}
      <section>
        <h3 className="font-semibold text-gray-800 mb-2">Compras recientes</h3>
        {supplier.purchases.length === 0 ? (
          <p className="text-sm text-gray-400">Sin compras registradas.</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Fecha</th>
                  <th className="px-4 py-2 font-medium text-center">Artículos</th>
                  <th className="px-4 py-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {supplier.purchases.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-500">{fmt(p.purchasedAt)}</td>
                    <td className="px-4 py-2 text-center tabular-nums">{p._count.items}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium">{fmtMoney(p.totalCRC)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Solicitudes de repuesto */}
      <section>
        <h3 className="font-semibold text-gray-800 mb-2">Solicitudes de repuesto</h3>
        {supplier.partRequests.length === 0 ? (
          <p className="text-sm text-gray-400">Sin solicitudes.</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Descripción</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                  <th className="px-4 py-2 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {supplier.partRequests.map((pr) => (
                  <tr key={pr.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">{pr.description}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{PART_STATUS[pr.status] ?? pr.status}</td>
                    <td className="px-4 py-2 text-gray-500">{fmt(pr.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
