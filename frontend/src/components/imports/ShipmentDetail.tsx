import { useState } from 'react'
import {
  useShipment,
  useUpdateShipment,
  useTransitionShipment,
  useAddShipmentItem,
  useUpdateShipmentItem,
  useDeleteShipmentItem,
  useRecalculateCosts,
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_STATUS_COLORS,
  SHIPMENT_TRANSITIONS,
  type ImportShipmentStatus,
  type ImportShipmentItem,
} from '../../api/imports'

function fmt(d: string) {
  return new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium' }).format(new Date(d))
}
function fmtMoney(n: string | number | null | undefined) {
  if (n == null || n === '') return '—'
  return new Intl.NumberFormat('es-CR', {
    style: 'currency', currency: 'CRC', maximumFractionDigits: 0,
  }).format(Number(n))
}

// ---- Barra de progreso logístico ----
const PIPELINE: ImportShipmentStatus[] = [
  'PENDING', 'PURCHASED', 'RECEIVED_IN_MAILBOX',
  'IN_TRANSIT', 'IN_CUSTOMS', 'RECEIVED_IN_CR', 'DELIVERED',
]

function ShipmentPipeline({ status }: { status: ImportShipmentStatus }) {
  const current = PIPELINE.indexOf(status)
  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1">
      {PIPELINE.map((s, i) => {
        const done = i < current
        const active = i === current
        return (
          <div key={s} className="flex items-center min-w-0">
            <div className={`flex flex-col items-center ${i > 0 ? '' : ''}`}>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs flex-shrink-0 ${
                done ? 'bg-green-500 border-green-500 text-white'
                : active ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white border-gray-300 text-gray-400'
              }`}>
                {done ? '✓' : i + 1}
              </div>
              <span className={`text-xs mt-0.5 whitespace-nowrap ${active ? 'text-blue-700 font-medium' : 'text-gray-400'}`}>
                {SHIPMENT_STATUS_LABELS[s]}
              </span>
            </div>
            {i < PIPELINE.length - 1 && (
              <div className={`h-0.5 w-8 flex-shrink-0 mx-0.5 mb-4 ${i < current ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---- Panel de items ----
function ItemsPanel({ shipmentId, items }: { shipmentId: string; items: ImportShipmentItem[] }) {
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ description: '', quantity: '1', pricePaidCRC: '' })
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ description: '', quantity: '1', pricePaidCRC: '' })

  const add = useAddShipmentItem()
  const update = useUpdateShipmentItem()
  const remove = useDeleteShipmentItem()
  const recalc = useRecalculateCosts()

  const totalPaid = items.reduce((acc, i) => acc + Number(i.pricePaidCRC), 0)
  const totalAllocated = items.reduce((acc, i) => acc + Number(i.allocatedCostCRC ?? 0), 0)
  const totalCostPerItem = items.map((i) => Number(i.pricePaidCRC) + Number(i.allocatedCostCRC ?? 0))

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    await add.mutateAsync({
      shipmentId,
      description: addForm.description,
      quantity: Number(addForm.quantity),
      pricePaidCRC: Number(addForm.pricePaidCRC),
    })
    setShowAdd(false)
    setAddForm({ description: '', quantity: '1', pricePaidCRC: '' })
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editId) return
    await update.mutateAsync({
      shipmentId, itemId: editId,
      description: editForm.description,
      quantity: Number(editForm.quantity),
      pricePaidCRC: Number(editForm.pricePaidCRC),
    })
    setEditId(null)
  }

  function startEdit(item: ImportShipmentItem) {
    setEditId(item.id)
    setEditForm({ description: item.description, quantity: String(item.quantity), pricePaidCRC: String(item.pricePaidCRC) })
    setShowAdd(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-800">Artículos del envío</h3>
        <div className="flex gap-2">
          <button onClick={() => recalc.mutate(shipmentId)}
            className="text-xs text-gray-500 hover:underline" title="Recalcular distribución de costos">
            ↻ Recalcular costos
          </button>
          <button onClick={() => { setShowAdd((v) => !v); setEditId(null) }}
            className="text-xs text-blue-600 hover:underline">
            + Agregar artículo
          </button>
        </div>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="border rounded-md p-3 space-y-2 mb-2 bg-blue-50">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-3 sm:col-span-1">
              <label className="text-xs text-gray-500">Descripción *</label>
              <input required value={addForm.description}
                onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Memoria RAM 8GB DDR4…"
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Cant. *</label>
              <input type="number" min="1" step="1" required value={addForm.quantity}
                onChange={(e) => setAddForm((f) => ({ ...f, quantity: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Precio pagado ₡ *</label>
              <input type="number" min="0" step="100" required value={addForm.pricePaidCRC}
                onChange={(e) => setAddForm((f) => ({ ...f, pricePaidCRC: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowAdd(false)}
              className="text-xs px-2 py-1 border rounded">Cancelar</button>
            <button type="submit" disabled={add.isPending}
              className="text-xs px-2 py-1 bg-blue-600 text-white rounded disabled:opacity-50">
              {add.isPending ? '…' : 'Agregar'}
            </button>
          </div>
        </form>
      )}

      {items.length === 0 && !showAdd ? (
        <p className="text-sm text-gray-400">Sin artículos registrados.</p>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Artículo</th>
                <th className="px-3 py-2 font-medium text-right">Cant.</th>
                <th className="px-3 py-2 font-medium text-right">Precio pagado</th>
                <th className="px-3 py-2 font-medium text-right">Import asignado</th>
                <th className="px-3 py-2 font-medium text-right">Costo total</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item, idx) => (
                editId === item.id ? (
                  <tr key={item.id}>
                    <td colSpan={6} className="px-3 py-2">
                      <form onSubmit={handleEdit} className="grid grid-cols-4 gap-2 items-end">
                        <input required value={editForm.description}
                          onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                          className="col-span-2 border rounded px-2 py-1 text-sm" />
                        <input type="number" min="1" required value={editForm.quantity}
                          onChange={(e) => setEditForm((f) => ({ ...f, quantity: e.target.value }))}
                          className="border rounded px-2 py-1 text-sm" />
                        <input type="number" min="0" required value={editForm.pricePaidCRC}
                          onChange={(e) => setEditForm((f) => ({ ...f, pricePaidCRC: e.target.value }))}
                          className="border rounded px-2 py-1 text-sm" />
                        <div className="col-span-4 flex gap-2">
                          <button type="button" onClick={() => setEditId(null)}
                            className="text-xs px-2 py-1 border rounded">Cancelar</button>
                          <button type="submit" disabled={update.isPending}
                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded disabled:opacity-50">Guardar</button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">{item.description}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(item.pricePaidCRC)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-orange-600">
                      {item.allocatedCostCRC ? fmtMoney(item.allocatedCostCRC) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {fmtMoney(totalCostPerItem[idx])}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-2 text-xs">
                        <button onClick={() => startEdit(item)} className="text-blue-600 hover:underline">Editar</button>
                        <button
                          onClick={async () => {
                            if (!confirm('¿Quitar este artículo?')) return
                            await remove.mutateAsync({ shipmentId, itemId: item.id })
                          }}
                          className="text-red-400 hover:underline">
                          Quitar
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
            {items.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 font-medium">
                  <td className="px-3 py-2 text-gray-600">Total</td>
                  <td />
                  <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(totalPaid)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-orange-600">{fmtMoney(totalAllocated)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(totalPaid + totalAllocated)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}

// ---- Vista detalle de un envío ----
export default function ShipmentDetail({ shipmentId }: { shipmentId: string }) {
  const { data: shipment, isLoading, isError } = useShipment(shipmentId)
  const update = useUpdateShipment(shipmentId)
  const transition = useTransitionShipment()
  const [editingCosts, setEditingCosts] = useState(false)
  const [costsForm, setCostsForm] = useState({
    weightLbs: '', shippingCRC: '', customsCRC: '', handlingCRC: '',
    trackingNumber: '', estimatedArrival: '',
  })

  if (isLoading) return <p className="text-sm text-gray-500 p-4">Cargando envío…</p>
  if (isError || !shipment) return <p className="text-sm text-red-500 p-4">Envío no encontrado.</p>

  const nextSteps = SHIPMENT_TRANSITIONS[shipment.status]

  async function handleSaveCosts(e: React.FormEvent) {
    e.preventDefault()
    await update.mutateAsync({
      trackingNumber: costsForm.trackingNumber || undefined,
      weightLbs: costsForm.weightLbs ? Number(costsForm.weightLbs) : undefined,
      shippingCRC: costsForm.shippingCRC ? Number(costsForm.shippingCRC) : undefined,
      customsCRC: costsForm.customsCRC ? Number(costsForm.customsCRC) : undefined,
      handlingCRC: costsForm.handlingCRC ? Number(costsForm.handlingCRC) : undefined,
      estimatedArrival: costsForm.estimatedArrival
        ? new Date(costsForm.estimatedArrival).toISOString()
        : undefined,
    })
    setEditingCosts(false)
  }

  function startEditCosts() {
    setCostsForm({
      trackingNumber: shipment!.trackingNumber ?? '',
      weightLbs: shipment!.weightLbs ?? '',
      shippingCRC: shipment!.shippingCRC ?? '',
      customsCRC: shipment!.customsCRC ?? '',
      handlingCRC: shipment!.handlingCRC ?? '',
      estimatedArrival: shipment!.estimatedArrival
        ? new Date(shipment!.estimatedArrival).toISOString().slice(0, 10)
        : '',
    })
    setEditingCosts(true)
  }

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">
            Envío #{shipment.id.slice(-6).toUpperCase()}
          </h2>
          {shipment.origin && <p className="text-sm text-gray-500">{shipment.origin}</p>}
          <p className="text-xs text-gray-400 mt-0.5">{fmt(shipment.createdAt)}</p>
        </div>
        <span className={`text-sm font-medium rounded-full px-3 py-1 ${SHIPMENT_STATUS_COLORS[shipment.status]}`}>
          {SHIPMENT_STATUS_LABELS[shipment.status]}
        </span>
      </div>

      {/* Pipeline visual */}
      <ShipmentPipeline status={shipment.status} />

      {/* Acciones de transición */}
      {nextSteps.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {nextSteps.map((s) => (
            <button
              key={s}
              onClick={async () => {
                const notes = s === 'RECEIVED_IN_CR'
                  ? prompt('Notas de llegada (opcional):') ?? undefined
                  : undefined
                await transition.mutateAsync({ id: shipmentId, toStatus: s, notes })
              }}
              className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              → {SHIPMENT_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}

      {/* Datos logísticos */}
      <div className="bg-white rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Logística y costos</h3>
          {!editingCosts && (
            <button onClick={startEditCosts} className="text-xs text-blue-600 hover:underline">
              Editar
            </button>
          )}
        </div>

        {editingCosts ? (
          <form onSubmit={handleSaveCosts} className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500">Tracking</label>
                <input value={costsForm.trackingNumber}
                  onChange={(e) => setCostsForm((f) => ({ ...f, trackingNumber: e.target.value }))}
                  className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Llegada estimada</label>
                <input type="date" value={costsForm.estimatedArrival}
                  onChange={(e) => setCostsForm((f) => ({ ...f, estimatedArrival: e.target.value }))}
                  className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Peso (lbs)</label>
                <input type="number" min="0" step="0.1" value={costsForm.weightLbs}
                  onChange={(e) => setCostsForm((f) => ({ ...f, weightLbs: e.target.value }))}
                  className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Envío ₡</label>
                <input type="number" min="0" step="100" value={costsForm.shippingCRC}
                  onChange={(e) => setCostsForm((f) => ({ ...f, shippingCRC: e.target.value }))}
                  className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Aduana ₡</label>
                <input type="number" min="0" step="100" value={costsForm.customsCRC}
                  onChange={(e) => setCostsForm((f) => ({ ...f, customsCRC: e.target.value }))}
                  className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Manejo ₡</label>
                <input type="number" min="0" step="100" value={costsForm.handlingCRC}
                  onChange={(e) => setCostsForm((f) => ({ ...f, handlingCRC: e.target.value }))}
                  className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
            </div>
            <p className="text-xs text-gray-400">
              Al guardar se recalcula la distribución de costos entre los artículos proporcionalmente al precio pagado.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditingCosts(false)}
                className="text-xs px-2 py-1 border rounded">Cancelar</button>
              <button type="submit" disabled={update.isPending}
                className="text-xs px-2 py-1 bg-blue-600 text-white rounded disabled:opacity-50">
                {update.isPending ? 'Guardando…' : 'Guardar y recalcular'}
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            {[
              { label: 'Tracking', value: shipment.trackingNumber ?? '—' },
              { label: 'Llegada estimada', value: shipment.estimatedArrival ? fmt(shipment.estimatedArrival) : '—' },
              { label: 'Peso', value: shipment.weightLbs ? `${shipment.weightLbs} lbs` : '—' },
              { label: 'Envío', value: fmtMoney(shipment.shippingCRC) },
              { label: 'Aduana', value: fmtMoney(shipment.customsCRC) },
              { label: 'Manejo', value: fmtMoney(shipment.handlingCRC) },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="font-medium">{value}</p>
              </div>
            ))}
            {shipment.totalCostCRC && (
              <div className="col-span-2 sm:col-span-3 border-t pt-2 mt-1">
                <p className="text-xs text-gray-500">Costo total del envío (artículos + importación)</p>
                <p className="text-lg font-bold tabular-nums">{fmtMoney(shipment.totalCostCRC)}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Artículos */}
      <ItemsPanel shipmentId={shipmentId} items={shipment.items} />

      {/* Historial de estados */}
      {shipment.statusHistory.length > 0 && (
        <details>
          <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
            Historial de estados ({shipment.statusHistory.length})
          </summary>
          <div className="mt-2 space-y-1 text-xs text-gray-500">
            {shipment.statusHistory.map((h) => (
              <div key={h.id} className="flex gap-2">
                <span className="text-gray-300">{fmt(h.createdAt)}</span>
                {h.fromStatus && <span>{SHIPMENT_STATUS_LABELS[h.fromStatus]} →</span>}
                <span className="font-medium text-gray-700">{SHIPMENT_STATUS_LABELS[h.toStatus]}</span>
                {h.notes && <span className="italic">({h.notes})</span>}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
