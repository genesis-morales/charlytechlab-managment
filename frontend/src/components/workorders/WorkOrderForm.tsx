import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCreateWorkOrder } from '../../api/workorders'
import { useCustomers } from '../../api/customers'

interface DeviceRow {
  deviceType: string
  brand: string
  model: string
  serialNumber: string
  processor: string
  ram: string
  storage: string
  physicalCondition: string
  accessories: string
  notes: string
  problem: string
}

const EMPTY_DEVICE: DeviceRow = {
  deviceType: 'laptop', brand: '', model: '', serialNumber: '',
  processor: '', ram: '', storage: '', physicalCondition: '',
  accessories: '', notes: '', problem: '',
}

export default function WorkOrderForm() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const presetCustomerId = params.get('clienteId') ?? ''

  const [customerId, setCustomerId] = useState(presetCustomerId)
  const [customerSearch, setCustomerSearch] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [devices, setDevices] = useState<DeviceRow[]>([{ ...EMPTY_DEVICE }])
  const [error, setError] = useState('')

  const create = useCreateWorkOrder()
  const { data: customersData } = useCustomers({ q: customerSearch || undefined, limit: 10 })

  function updateDevice(idx: number, field: keyof DeviceRow, val: string) {
    setDevices((prev) => prev.map((d, i) => i === idx ? { ...d, [field]: val } : d))
  }

  function addDevice() {
    setDevices((prev) => [...prev, { ...EMPTY_DEVICE }])
  }

  function removeDevice(idx: number) {
    if (devices.length === 1) return
    setDevices((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!customerId) { setError('Seleccione un cliente'); return }
    try {
      const result = await create.mutateAsync({
        customerId,
        notes: orderNotes || undefined,
        devices: devices.map((d) => ({
          deviceType: d.deviceType,
          brand: d.brand || undefined,
          model: d.model || undefined,
          serialNumber: d.serialNumber || undefined,
          processor: d.processor || undefined,
          ram: d.ram || undefined,
          storage: d.storage || undefined,
          physicalCondition: d.physicalCondition || undefined,
          accessories: d.accessories || undefined,
          notes: d.notes || undefined,
          problem: d.problem,
        })),
      })
      navigate(`/ordenes/${result.id}`)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: unknown } } }
      const raw = e?.response?.data?.error
      setError(typeof raw === 'string' ? raw : 'Error al crear la orden')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Cliente */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Cliente <span className="text-red-500">*</span>
        </label>
        {presetCustomerId ? (
          <p className="text-sm text-gray-600 border rounded-md px-3 py-2 bg-gray-50">
            Cliente preseleccionado (ID: {presetCustomerId})
          </p>
        ) : (
          <>
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="Buscar cliente por nombre o teléfono…"
              className="w-full border rounded-md px-3 py-2 text-sm mb-1"
            />
            {customersData && customersData.data.length > 0 && !customerId && (
              <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
                {customersData.data.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setCustomerId(c.id); setCustomerSearch(`${c.name} — ${c.phone}`) }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50"
                  >
                    {c.name} — {c.phone}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notas de la orden</label>
        <textarea
          value={orderNotes}
          onChange={(e) => setOrderNotes(e.target.value)}
          rows={2}
          className="w-full border rounded-md px-3 py-2 text-sm"
        />
      </div>

      {/* Equipos */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Equipos</h3>
          <button type="button" onClick={addDevice} className="text-sm text-blue-600 hover:underline">
            + Agregar equipo
          </button>
        </div>

        {devices.map((d, idx) => (
          <div key={idx} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Equipo {idx + 1}</span>
              {devices.length > 1 && (
                <button type="button" onClick={() => removeDevice(idx)} className="text-xs text-red-500 hover:underline">
                  Quitar
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">Tipo *</label>
                <select
                  value={d.deviceType}
                  onChange={(e) => updateDevice(idx, 'deviceType', e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                >
                  {['laptop', 'desktop', 'celular', 'tablet', 'otro'].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">Marca</label>
                <input value={d.brand} onChange={(e) => updateDevice(idx, 'brand', e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm" placeholder="HP, Dell…" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">Modelo</label>
                <input value={d.model} onChange={(e) => updateDevice(idx, 'model', e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">RAM</label>
                <input value={d.ram} onChange={(e) => updateDevice(idx, 'ram', e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm" placeholder="8GB DDR4" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">Almacenamiento</label>
                <input value={d.storage} onChange={(e) => updateDevice(idx, 'storage', e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm" placeholder="256GB SSD" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">N° serie / IMEI</label>
                <input value={d.serialNumber} onChange={(e) => updateDevice(idx, 'serialNumber', e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Estado físico</label>
              <input value={d.physicalCondition} onChange={(e) => updateDevice(idx, 'physicalCondition', e.target.value)}
                className="w-full border rounded px-2 py-1.5 text-sm"
                placeholder="Rayones en tapa, pantalla sin grietas…" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Accesorios entregados</label>
              <input value={d.accessories} onChange={(e) => updateDevice(idx, 'accessories', e.target.value)}
                className="w-full border rounded px-2 py-1.5 text-sm"
                placeholder="Cargador, mochila…" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">
                Problema reportado por el cliente <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                value={d.problem}
                onChange={(e) => updateDevice(idx, 'problem', e.target.value)}
                rows={2}
                className="w-full border rounded px-2 py-1.5 text-sm"
                placeholder="No enciende, pantalla azul, teclado dañado…"
              />
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={() => navigate('/ordenes')}
          className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50">
          Cancelar
        </button>
        <button type="submit" disabled={create.isPending}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
          {create.isPending ? 'Creando…' : 'Crear orden'}
        </button>
      </div>
    </form>
  )
}
