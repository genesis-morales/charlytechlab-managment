import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useWorkOrder,
  useTransitionDevice,
  useAddDiagnosis,
  useAddPartRequest,
  useTransitionPart,
  useUpdateHours,
  STATUS_LABELS,
  STATUS_COLORS,
  PART_STATUS_LABELS,
  type WorkOrderDevice,
  type WorkOrderDeviceStatus,
  type PartRequestStatus,
} from '../../api/workorders'

function fmt(d: string) {
  return new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d))
}
function fmtMoney(n: number) {
  return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(n)
}

// ---- Dialogo de transicion de estado ----
function TransitionDialog({
  wod,
  orderId,
  onClose,
}: { wod: WorkOrderDevice; orderId: string; onClose: () => void }) {
  const [toStatus, setToStatus] = useState<WorkOrderDeviceStatus | ''>('')
  const [notes, setNotes] = useState('')
  const transition = useTransitionDevice()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!toStatus) return
    await transition.mutateAsync({ orderId, wodId: wod.id, toStatus, notes: notes || undefined })
    onClose()
  }

  // Opciones disponibles las trae el backend en el 422; aqui las calculamos tambien del lado del cliente
  const ALLOWED: Record<WorkOrderDeviceStatus, WorkOrderDeviceStatus[]> = {
    RECEIVED: ['DIAGNOSING', 'CANCELLED'],
    DIAGNOSING: ['QUOTED', 'CANCELLED'],
    QUOTED: ['AWAITING_APPROVAL', 'CANCELLED'],
    AWAITING_APPROVAL: ['APPROVED', 'REJECTED_BY_CUSTOMER', 'CANCELLED'],
    APPROVED: ['WAITING_PARTS', 'REPAIRING', 'CANCELLED'],
    WAITING_PARTS: ['REPAIRING', 'CANCELLED'],
    REPAIRING: ['QUALITY_CHECK', 'WAITING_PARTS', 'CANCELLED'],
    QUALITY_CHECK: ['READY_FOR_DELIVERY', 'REPAIRING'],
    READY_FOR_DELIVERY: ['DELIVERED', 'WARRANTY_CLAIM', 'CANCELLED'],
    DELIVERED: ['CLOSED', 'WARRANTY_CLAIM'],
    WARRANTY_CLAIM: ['REPAIRING', 'CLOSED'],
    REJECTED_BY_CUSTOMER: ['CLOSED'],
    CANCELLED: ['CLOSED'],
    CLOSED: [],
  }

  const options = ALLOWED[wod.status] ?? []

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm">
        <h3 className="font-semibold mb-1">Cambiar estado</h3>
        <p className="text-sm text-gray-500 mb-4">
          {wod.device.brand} {wod.device.model} — actualmente:{' '}
          <span className="font-medium">{STATUS_LABELS[wod.status]}</span>
        </p>
        <form onSubmit={submit} className="space-y-3">
          <select
            value={toStatus}
            onChange={(e) => setToStatus(e.target.value as WorkOrderDeviceStatus)}
            required
            className="w-full border rounded-md px-3 py-2 text-sm"
          >
            <option value="">Seleccionar nuevo estado…</option>
            {options.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas (opcional)"
            rows={2}
            className="w-full border rounded-md px-3 py-2 text-sm"
          />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm border rounded-md">Cancelar</button>
            <button
              type="submit"
              disabled={!toStatus || transition.isPending}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {transition.isPending ? 'Guardando…' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---- Panel de un dispositivo ----
function DevicePanel({ wod, orderId }: { wod: WorkOrderDevice; orderId: string }) {
  const [showTransition, setShowTransition] = useState(false)
  const [showDiagForm, setShowDiagForm] = useState(false)
  const [showPartForm, setShowPartForm] = useState(false)
  const [diagForm, setDiagForm] = useState({ diagnosis: '', findings: '', hasCost: false, diagnosticCost: '' })
  const [partForm, setPartForm] = useState({ description: '', priceCRC: '', purchaseLink: '', estimatedArrival: '', notes: '' })

  const addDiag = useAddDiagnosis()
  const addPart = useAddPartRequest()
  const transitionPart = useTransitionPart()
  const updateHours = useUpdateHours()
  const [hours, setHours] = useState(wod.hoursWorked?.toString() ?? '')

  async function submitDiag(e: React.FormEvent) {
    e.preventDefault()
    await addDiag.mutateAsync({
      orderId,
      wodId: wod.id,
      diagnosis: diagForm.diagnosis,
      findings: diagForm.findings || undefined,
      hasCost: diagForm.hasCost,
      diagnosticCost: diagForm.hasCost && diagForm.diagnosticCost ? Number(diagForm.diagnosticCost) : undefined,
    })
    setShowDiagForm(false)
    setDiagForm({ diagnosis: '', findings: '', hasCost: false, diagnosticCost: '' })
  }

  async function submitPart(e: React.FormEvent) {
    e.preventDefault()
    await addPart.mutateAsync({
      orderId,
      wodId: wod.id,
      description: partForm.description,
      priceCRC: partForm.priceCRC ? Number(partForm.priceCRC) : undefined,
      purchaseLink: partForm.purchaseLink || undefined,
      estimatedArrival: partForm.estimatedArrival || undefined,
      notes: partForm.notes || undefined,
    })
    setShowPartForm(false)
    setPartForm({ description: '', priceCRC: '', purchaseLink: '', estimatedArrival: '', notes: '' })
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Cabecera del dispositivo */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
        <div>
          <span className="font-medium">
            {wod.device.brand} {wod.device.model || wod.device.deviceType}
          </span>
          <span className="ml-2 text-sm text-gray-500 capitalize">{wod.device.deviceType}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${STATUS_COLORS[wod.status]}`}>
            {STATUS_LABELS[wod.status]}
          </span>
          {wod.status !== 'CLOSED' && wod.status !== 'DELIVERED' && (
            <button
              onClick={() => setShowTransition(true)}
              className="text-xs text-blue-600 hover:underline"
            >
              Cambiar estado
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Problema reportado */}
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase mb-1">Problema reportado</p>
          <p className="text-sm">{wod.problem}</p>
        </div>

        {/* Datos del equipo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {wod.device.processor && <span><span className="text-gray-400">CPU</span> {wod.device.processor}</span>}
          {wod.device.ram && <span><span className="text-gray-400">RAM</span> {wod.device.ram}</span>}
          {wod.device.storage && <span><span className="text-gray-400">Almac.</span> {wod.device.storage}</span>}
          {wod.device.physicalCondition && <span><span className="text-gray-400">Estado físico</span> {wod.device.physicalCondition}</span>}
        </div>

        {/* Horas trabajadas */}
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-gray-500 uppercase">Horas trabajadas</p>
          <input
            type="number"
            min="0"
            step="0.5"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            onBlur={() => {
              const val = parseFloat(hours)
              if (!isNaN(val) && val !== wod.hoursWorked) {
                updateHours.mutate({ orderId, wodId: wod.id, hoursWorked: val })
              }
            }}
            className="w-20 border rounded px-2 py-1 text-xs"
          />
          <span className="text-xs text-gray-400">(opcional)</span>
        </div>

        {/* Diagnosticos */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-gray-500 uppercase">Diagnóstico</p>
            <button onClick={() => setShowDiagForm((v) => !v)} className="text-xs text-blue-600 hover:underline">
              + Agregar
            </button>
          </div>
          {showDiagForm && (
            <form onSubmit={submitDiag} className="border rounded-md p-3 space-y-2 mb-2 bg-blue-50">
              <textarea
                required
                value={diagForm.diagnosis}
                onChange={(e) => setDiagForm((f) => ({ ...f, diagnosis: e.target.value }))}
                placeholder="Diagnóstico *"
                rows={2}
                className="w-full border rounded px-2 py-1 text-sm"
              />
              <textarea
                value={diagForm.findings}
                onChange={(e) => setDiagForm((f) => ({ ...f, findings: e.target.value }))}
                placeholder="Hallazgos (opcional)"
                rows={2}
                className="w-full border rounded px-2 py-1 text-sm"
              />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={diagForm.hasCost} onChange={(e) => setDiagForm((f) => ({ ...f, hasCost: e.target.checked }))} />
                El diagnóstico tiene costo
              </label>
              {diagForm.hasCost && (
                <input
                  type="number" min="0" step="100"
                  value={diagForm.diagnosticCost}
                  onChange={(e) => setDiagForm((f) => ({ ...f, diagnosticCost: e.target.value }))}
                  placeholder="Costo diagnóstico ₡"
                  className="w-full border rounded px-2 py-1 text-sm"
                />
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowDiagForm(false)} className="text-xs px-2 py-1 border rounded">Cancelar</button>
                <button type="submit" disabled={addDiag.isPending} className="text-xs px-2 py-1 bg-blue-600 text-white rounded disabled:opacity-50">
                  {addDiag.isPending ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </form>
          )}
          {wod.diagnoses.length === 0 && !showDiagForm && (
            <p className="text-xs text-gray-400">Sin diagnóstico registrado.</p>
          )}
          {wod.diagnoses.map((d) => (
            <div key={d.id} className="text-sm border rounded p-2 mb-1 bg-white">
              <p>{d.diagnosis}</p>
              {d.findings && <p className="text-gray-500 text-xs mt-0.5">{d.findings}</p>}
              {d.hasCost && d.diagnosticCost != null && (
                <p className="text-xs text-orange-600 mt-0.5">Costo diagnóstico: {fmtMoney(d.diagnosticCost)}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">{fmt(d.createdAt)}</p>
            </div>
          ))}
        </div>

        {/* Repuestos */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-gray-500 uppercase">Repuestos</p>
            <button onClick={() => setShowPartForm((v) => !v)} className="text-xs text-blue-600 hover:underline">
              + Agregar
            </button>
          </div>
          {showPartForm && (
            <form onSubmit={submitPart} className="border rounded-md p-3 space-y-2 mb-2 bg-purple-50">
              <input
                required value={partForm.description}
                onChange={(e) => setPartForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Descripción del repuesto *"
                className="w-full border rounded px-2 py-1 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number" min="0" step="100"
                  value={partForm.priceCRC}
                  onChange={(e) => setPartForm((f) => ({ ...f, priceCRC: e.target.value }))}
                  placeholder="Precio estimado ₡"
                  className="border rounded px-2 py-1 text-sm"
                />
                <input
                  type="date" value={partForm.estimatedArrival}
                  onChange={(e) => setPartForm((f) => ({ ...f, estimatedArrival: e.target.value }))}
                  className="border rounded px-2 py-1 text-sm"
                />
              </div>
              <input
                type="url" value={partForm.purchaseLink}
                onChange={(e) => setPartForm((f) => ({ ...f, purchaseLink: e.target.value }))}
                placeholder="Enlace de compra (opcional)"
                className="w-full border rounded px-2 py-1 text-sm"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowPartForm(false)} className="text-xs px-2 py-1 border rounded">Cancelar</button>
                <button type="submit" disabled={addPart.isPending} className="text-xs px-2 py-1 bg-purple-600 text-white rounded disabled:opacity-50">
                  {addPart.isPending ? 'Guardando…' : 'Agregar'}
                </button>
              </div>
            </form>
          )}
          {wod.partRequests.length === 0 && !showPartForm && (
            <p className="text-xs text-gray-400">Sin solicitudes de repuesto.</p>
          )}
          {wod.partRequests.map((p) => (
            <div key={p.id} className="text-sm border rounded p-2 mb-1 bg-white flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{p.description}</p>
                <div className="flex flex-wrap gap-x-3 text-xs text-gray-500 mt-0.5">
                  {p.priceCRC != null && <span>{fmtMoney(p.priceCRC)}</span>}
                  {p.estimatedArrival && <span>Llega: {new Date(p.estimatedArrival).toLocaleDateString('es-CR')}</span>}
                  {p.supplier && <span>{p.supplier.name}</span>}
                </div>
                {p.purchaseLink && (
                  <a href={p.purchaseLink} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline truncate block mt-0.5">
                    {p.purchaseLink}
                  </a>
                )}
              </div>
              <div className="flex-shrink-0 flex flex-col items-end gap-1">
                <span className="text-xs rounded-full px-2 py-0.5 bg-purple-100 text-purple-700">
                  {PART_STATUS_LABELS[p.status]}
                </span>
                <select
                  defaultValue=""
                  onChange={async (e) => {
                    if (!e.target.value) return
                    await transitionPart.mutateAsync({
                      orderId, wodId: wod.id, partId: p.id, toStatus: e.target.value as PartRequestStatus,
                    })
                    e.target.value = ''
                  }}
                  className="text-xs border rounded px-1 py-0.5"
                >
                  <option value="">Cambiar estado…</option>
                  {(Object.keys(PART_STATUS_LABELS) as PartRequestStatus[])
                    .filter((s) => s !== p.status)
                    .map((s) => (
                      <option key={s} value={s}>{PART_STATUS_LABELS[s]}</option>
                    ))}
                </select>
              </div>
            </div>
          ))}
        </div>

        {/* Historial de cambios */}
        {wod.history.length > 0 && (
          <details className="text-xs">
            <summary className="text-gray-400 cursor-pointer hover:text-gray-600">Historial de estados ({wod.history.length})</summary>
            <div className="mt-1 space-y-0.5">
              {wod.history.map((h) => (
                <div key={h.id} className="flex gap-2 text-gray-500">
                  <span className="text-gray-300">{fmt(h.createdAt)}</span>
                  {h.fromStatus && <span>{STATUS_LABELS[h.fromStatus as WorkOrderDeviceStatus]} →</span>}
                  <span className="font-medium text-gray-700">{STATUS_LABELS[h.toStatus as WorkOrderDeviceStatus]}</span>
                  {h.notes && <span className="italic">({h.notes})</span>}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {showTransition && (
        <TransitionDialog wod={wod} orderId={orderId} onClose={() => setShowTransition(false)} />
      )}
    </div>
  )
}

// ---- Vista principal de la orden ----
interface Props { orderId: string }

export default function WorkOrderDetail({ orderId }: Props) {
  const navigate = useNavigate()
  const { data: order, isLoading, isError } = useWorkOrder(orderId)

  if (isLoading) return <p className="text-sm text-gray-500 p-4">Cargando orden…</p>
  if (isError || !order) return <p className="text-sm text-red-500 p-4">Orden no encontrada.</p>

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">{order.number}</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            <button onClick={() => navigate(`/clientes/${order.customer.id}`)} className="hover:underline text-blue-700">
              {order.customer.name}
            </button>
            {' · '}{order.customer.phone}
            {order.customer.email && <>{' · '}{order.customer.email}</>}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{fmt(order.createdAt)}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/cotizaciones/nueva?ordenId=${order.id}`)}
            className="text-sm px-3 py-1.5 border rounded-md hover:bg-gray-50"
          >
            + Cotización
          </button>
        </div>
      </div>

      {order.notes && (
        <div className="rounded-md bg-yellow-50 border border-yellow-100 p-3 text-sm text-yellow-800">
          {order.notes}
        </div>
      )}

      {/* Cotizaciones asociadas */}
      {order.quotes.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm text-gray-700 mb-2">Cotizaciones</h3>
          <div className="flex flex-wrap gap-2">
            {order.quotes.map((q) => (
              <button
                key={q.id}
                onClick={() => navigate(`/cotizaciones/${q.id}`)}
                className="text-sm border rounded-md px-3 py-1.5 hover:bg-gray-50"
              >
                {q.number} · {q.status} · {fmtMoney(q.total)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Dispositivos */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-800">
          Equipos ({order.devices.length})
        </h3>
        {order.devices.map((wod) => (
          <DevicePanel key={wod.id} wod={wod} orderId={order.id} />
        ))}
      </div>
    </div>
  )
}
