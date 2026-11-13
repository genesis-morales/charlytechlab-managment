import { useNavigate, useParams } from 'react-router-dom'
import { useCustomer, useDeactivateCustomer } from '../../api/customers'

const STATUS_LABELS: Record<string, string> = {
  RECEIVED: 'Recibido',
  DIAGNOSING: 'En diagnóstico',
  QUOTED: 'Cotizado',
  AWAITING_APPROVAL: 'Esperando aprobación',
  APPROVED: 'Aprobado',
  WAITING_PARTS: 'Esperando repuestos',
  REPAIRING: 'En reparación',
  QUALITY_CHECK: 'Control de calidad',
  READY_FOR_DELIVERY: 'Listo para entrega',
  DELIVERED: 'Entregado',
  REJECTED_BY_CUSTOMER: 'Rechazado',
  CANCELLED: 'Cancelado',
  WARRANTY_CLAIM: 'Garantía',
  CLOSED: 'Cerrado',
}

const QUOTE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  SENT: 'Enviada',
  AWAITING_APPROVAL: 'Esperando aprobación',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  CONVERTED: 'Convertida',
  EXPIRED: 'Expirada',
}

function fmt(dateStr: string) {
  return new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium' }).format(new Date(dateStr))
}

function fmtMoney(amount: number) {
  return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(amount)
}

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: customer, isLoading, isError } = useCustomer(id!)
  const deactivate = useDeactivateCustomer()

  if (isLoading) return <p className="text-sm text-gray-500 p-4">Cargando ficha…</p>
  if (isError || !customer) return <p className="text-sm text-red-500 p-4">Cliente no encontrado.</p>

  async function handleDeactivate() {
    if (!confirm(`¿Desactivar a "${customer!.name}"?`)) return
    await deactivate.mutateAsync(customer!.id)
    navigate('/clientes')
  }

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold">{customer.name}</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            {customer.phone}
            {customer.email && <> · {customer.email}</>}
            {customer.address && <> · {customer.address}</>}
          </p>
          {!customer.isActive && (
            <span className="mt-1 inline-block rounded-full bg-gray-100 text-gray-500 text-xs px-2 py-0.5">
              Inactivo
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/clientes/${customer.id}/editar`)}
            className="text-sm px-3 py-1.5 border rounded-md hover:bg-gray-50"
          >
            Editar
          </button>
          {customer.isActive && (
            <button
              onClick={handleDeactivate}
              className="text-sm px-3 py-1.5 border border-red-200 text-red-600 rounded-md hover:bg-red-50"
            >
              Desactivar
            </button>
          )}
        </div>
      </div>

      {customer.notes && (
        <div className="rounded-md bg-yellow-50 border border-yellow-100 p-3 text-sm text-yellow-800">
          <span className="font-medium">Notas internas:</span> {customer.notes}
        </div>
      )}

      {/* Ordenes de trabajo */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-800">Órdenes de trabajo</h3>
          <button
            onClick={() => navigate(`/ordenes/nueva?clienteId=${customer.id}`)}
            className="text-xs text-blue-600 hover:underline"
          >
            + Nueva orden
          </button>
        </div>
        {customer.workOrders.length === 0 ? (
          <p className="text-sm text-gray-400">Sin órdenes registradas.</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Número</th>
                  <th className="px-4 py-2 font-medium">Equipos</th>
                  <th className="px-4 py-2 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {customer.workOrders.map((wo) => (
                  <tr key={wo.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <button
                        onClick={() => navigate(`/ordenes/${wo.id}`)}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {wo.number}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {wo.devices.map((d, i) => (
                        <span key={i} className="block">
                          {d.device.brand} {d.device.model} —{' '}
                          <span className="text-xs text-gray-400">
                            {STATUS_LABELS[d.status] ?? d.status}
                          </span>
                        </span>
                      ))}
                    </td>
                    <td className="px-4 py-2 text-gray-500">{fmt(wo.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Cotizaciones */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-800">Cotizaciones</h3>
          <button
            onClick={() => navigate(`/cotizaciones/nueva?clienteId=${customer.id}`)}
            className="text-xs text-blue-600 hover:underline"
          >
            + Nueva cotización
          </button>
        </div>
        {customer.quotes.length === 0 ? (
          <p className="text-sm text-gray-400">Sin cotizaciones registradas.</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Número</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                  <th className="px-4 py-2 font-medium text-right">Total</th>
                  <th className="px-4 py-2 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {customer.quotes.map((q) => (
                  <tr key={q.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <button
                        onClick={() => navigate(`/cotizaciones/${q.id}`)}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {q.number}
                      </button>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs text-gray-500">
                        {QUOTE_STATUS_LABELS[q.status] ?? q.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmtMoney(q.total)}</td>
                    <td className="px-4 py-2 text-gray-500">{fmt(q.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Garantias */}
      {customer.warranties.length > 0 && (
        <section>
          <h3 className="font-semibold text-gray-800 mb-2">Garantías</h3>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Producto</th>
                  <th className="px-4 py-2 font-medium">Inicio</th>
                  <th className="px-4 py-2 font-medium">Vence</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {customer.warranties.map((w) => (
                  <tr key={w.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">{w.product.title}</td>
                    <td className="px-4 py-2 text-gray-500">{fmt(w.startsAt)}</td>
                    <td className="px-4 py-2 text-gray-500">{fmt(w.expiresAt)}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`text-xs rounded-full px-2 py-0.5 ${
                          w.isActive && new Date(w.expiresAt) > new Date()
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {w.isActive && new Date(w.expiresAt) > new Date() ? 'Vigente' : 'Expirada'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
