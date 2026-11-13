import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCreateQuote } from '../../api/quotes'
import { useCustomers } from '../../api/customers'

type ItemType = 'part' | 'labor' | 'service' | 'other'

const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  part: 'Repuesto', labor: 'Mano de obra', service: 'Servicio', other: 'Otro',
}

interface ItemRow {
  description: string
  itemType: ItemType
  quantity: string
  unitPrice: string
  notes: string
}

const EMPTY_ITEM: ItemRow = {
  description: '', itemType: 'part', quantity: '1', unitPrice: '', notes: '',
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency', currency: 'CRC', maximumFractionDigits: 0,
  }).format(n)
}

export default function QuoteForm() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const presetClienteId = params.get('clienteId') ?? ''
  const presetOrdenId = params.get('ordenId') ?? ''

  const [customerId, setCustomerId] = useState(presetClienteId)
  const [customerSearch, setCustomerSearch] = useState('')
  const [workOrderId] = useState(presetOrdenId)
  const [notes, setNotes] = useState('')
  const [terms, setTerms] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [items, setItems] = useState<ItemRow[]>([{ ...EMPTY_ITEM }])
  const [error, setError] = useState('')

  const create = useCreateQuote()
  const { data: customersData } = useCustomers({ q: customerSearch || undefined, limit: 8 })

  function updateItem(idx: number, field: keyof ItemRow, val: string) {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it))
  }

  function addItem() { setItems((prev) => [...prev, { ...EMPTY_ITEM }]) }
  function removeItem(idx: number) {
    if (items.length === 1) return
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const total = items.reduce((acc, it) => {
    const qty = parseFloat(it.quantity) || 0
    const price = parseFloat(it.unitPrice) || 0
    return acc + qty * price
  }, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!customerId && !presetOrdenId) {
      setError('Seleccione un cliente o ingrese desde una orden de trabajo')
      return
    }
    try {
      const result = await create.mutateAsync({
        customerId: customerId || undefined,
        workOrderId: workOrderId || undefined,
        notes: notes || undefined,
        terms: terms || undefined,
        validUntil: validUntil ? new Date(validUntil).toISOString() : undefined,
        items: items.map((it, idx) => ({
          description: it.description,
          itemType: it.itemType,
          quantity: parseFloat(it.quantity) || 1,
          unitPrice: parseFloat(it.unitPrice) || 0,
          notes: it.notes || undefined,
          position: idx,
        })),
      })
      navigate(`/cotizaciones/${result.id}`)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: unknown } } }
      const raw = e?.response?.data?.error
      setError(typeof raw === 'string' ? raw : 'Error al crear la cotización')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Cliente */}
      {!presetOrdenId && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cliente <span className="text-red-500">*</span>
          </label>
          {presetClienteId ? (
            <p className="text-sm text-gray-600 border rounded-md px-3 py-2 bg-gray-50">
              Cliente preseleccionado (ID: {presetClienteId})
            </p>
          ) : (
            <>
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Buscar cliente…"
                className="w-full border rounded-md px-3 py-2 text-sm mb-1"
              />
              {customersData && customersData.data.length > 0 && !customerId && (
                <div className="border rounded-md divide-y max-h-36 overflow-y-auto">
                  {customersData.data.map((c) => (
                    <button key={c.id} type="button"
                      onClick={() => { setCustomerId(c.id); setCustomerSearch(`${c.name} — ${c.phone}`) }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50">
                      {c.name} — {c.phone}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
      {presetOrdenId && (
        <div className="rounded-md bg-blue-50 border border-blue-100 p-3 text-sm text-blue-800">
          Cotización vinculada a orden <strong>{presetOrdenId}</strong>
        </div>
      )}

      {/* Notas y vigencia */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Válida hasta</label>
          <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm"
            placeholder="Plazo sujeto a disponibilidad de piezas…" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Términos / condiciones</label>
        <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={2}
          className="w-full border rounded-md px-3 py-2 text-sm"
          placeholder="Garantía de 30 días en mano de obra…" />
      </div>

      {/* Items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-800">Ítems</h3>
          <button type="button" onClick={addItem} className="text-sm text-blue-600 hover:underline">
            + Agregar ítem
          </button>
        </div>

        <div className="space-y-2">
          {/* Encabezado */}
          <div className="hidden sm:grid sm:grid-cols-12 gap-2 text-xs text-gray-500 px-1">
            <span className="col-span-4">Descripción</span>
            <span className="col-span-2">Tipo</span>
            <span className="col-span-1 text-right">Cant.</span>
            <span className="col-span-2 text-right">Precio unit. ₡</span>
            <span className="col-span-2 text-right">Subtotal</span>
            <span className="col-span-1" />
          </div>

          {items.map((it, idx) => {
            const sub = (parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0)
            return (
              <div key={idx} className="grid grid-cols-12 gap-2 items-start border rounded-md p-2 bg-gray-50">
                <input
                  required
                  value={it.description}
                  onChange={(e) => updateItem(idx, 'description', e.target.value)}
                  placeholder="Descripción *"
                  className="col-span-12 sm:col-span-4 border rounded px-2 py-1.5 text-sm bg-white"
                />
                <select
                  value={it.itemType}
                  onChange={(e) => updateItem(idx, 'itemType', e.target.value)}
                  className="col-span-6 sm:col-span-2 border rounded px-2 py-1.5 text-sm bg-white"
                >
                  {(Object.entries(ITEM_TYPE_LABELS) as [ItemType, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <input
                  type="number" min="0.01" step="0.01"
                  value={it.quantity}
                  onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                  className="col-span-3 sm:col-span-1 border rounded px-2 py-1.5 text-sm text-right bg-white"
                />
                <input
                  type="number" min="0" step="100"
                  required
                  value={it.unitPrice}
                  onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)}
                  placeholder="0"
                  className="col-span-3 sm:col-span-2 border rounded px-2 py-1.5 text-sm text-right bg-white"
                />
                <span className="col-span-10 sm:col-span-2 text-sm text-right pt-2 tabular-nums">
                  {sub > 0 ? fmtMoney(sub) : '—'}
                </span>
                <button
                  type="button" onClick={() => removeItem(idx)}
                  disabled={items.length === 1}
                  className="col-span-2 sm:col-span-1 text-xs text-red-400 hover:text-red-600 disabled:opacity-30 text-right"
                >
                  ✕
                </button>
                {it.notes !== undefined && (
                  <input
                    value={it.notes}
                    onChange={(e) => updateItem(idx, 'notes', e.target.value)}
                    placeholder="Nota del ítem (opcional)"
                    className="col-span-12 border rounded px-2 py-1 text-xs bg-white"
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Total */}
        <div className="flex justify-end mt-3">
          <div className="text-right">
            <span className="text-sm text-gray-500">Total estimado</span>
            <p className="text-2xl font-bold tabular-nums">{fmtMoney(total)}</p>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={() => navigate(-1)}
          className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50">
          Cancelar
        </button>
        <button type="submit" disabled={create.isPending}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
          {create.isPending ? 'Creando…' : 'Crear cotización'}
        </button>
      </div>
    </form>
  )
}
