import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCreatePurchase, useSuppliers } from '../../api/suppliers'

function fmtMoney(n: number) {
  return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(n)
}

interface ItemRow {
  description: string
  quantity: string
  unitCostCRC: string
  inventoryItemId: string
}

const EMPTY_ITEM: ItemRow = { description: '', quantity: '1', unitCostCRC: '', inventoryItemId: '' }

export default function PurchaseForm() {
  const navigate = useNavigate()
  const [supplierId, setSupplierId] = useState('')
  const [purchasedAt, setPurchasedAt] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<ItemRow[]>([{ ...EMPTY_ITEM }])
  const [error, setError] = useState('')

  const create = useCreatePurchase()
  const { data: suppliersData } = useSuppliers({ limit: 100 })

  function updateItem(idx: number, field: keyof ItemRow, val: string) {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it))
  }
  function addItem() { setItems((prev) => [...prev, { ...EMPTY_ITEM }]) }
  function removeItem(idx: number) {
    if (items.length === 1) return
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const total = items.reduce((acc, it) => acc + (parseFloat(it.quantity) || 0) * (parseFloat(it.unitCostCRC) || 0), 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await create.mutateAsync({
        supplierId: supplierId || undefined,
        purchasedAt: new Date(purchasedAt).toISOString(),
        notes: notes || undefined,
        items: items.map((it) => ({
          description: it.description,
          quantity: Number(it.quantity),
          unitCostCRC: Number(it.unitCostCRC),
          inventoryItemId: it.inventoryItemId || undefined,
        })),
      })
      navigate('/proveedores/compras')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: unknown } } }
      const raw = e?.response?.data?.error
      setError(typeof raw === 'string' ? raw : 'Error al crear la compra')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm">
            <option value="">Sin proveedor</option>
            {suppliersData?.data.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de compra *</label>
          <input type="date" required value={purchasedAt}
            onChange={(e) => setPurchasedAt(e.target.value)}
            className="w-full border rounded-md px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)}
          className="w-full border rounded-md px-3 py-2 text-sm" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Artículos</h3>
          <button type="button" onClick={addItem} className="text-sm text-blue-600 hover:underline">+ Agregar</button>
        </div>
        <div className="hidden sm:grid sm:grid-cols-12 gap-2 text-xs text-gray-500 px-1">
          <span className="col-span-5">Descripción</span>
          <span className="col-span-2 text-right">Cant.</span>
          <span className="col-span-3 text-right">Costo unit. ₡</span>
          <span className="col-span-1 text-right">Subtotal</span>
          <span className="col-span-1" />
        </div>
        {items.map((it, idx) => {
          const sub = (parseFloat(it.quantity) || 0) * (parseFloat(it.unitCostCRC) || 0)
          return (
            <div key={idx} className="grid grid-cols-12 gap-2 items-start border rounded-md p-2 bg-gray-50">
              <input required value={it.description}
                onChange={(e) => updateItem(idx, 'description', e.target.value)}
                placeholder="Descripción *"
                className="col-span-12 sm:col-span-5 border rounded px-2 py-1.5 text-sm bg-white" />
              <input type="number" min="1" step="1" required value={it.quantity}
                onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                className="col-span-3 sm:col-span-2 border rounded px-2 py-1.5 text-sm text-right bg-white" />
              <input type="number" min="0" step="100" required value={it.unitCostCRC}
                onChange={(e) => updateItem(idx, 'unitCostCRC', e.target.value)}
                placeholder="0"
                className="col-span-4 sm:col-span-3 border rounded px-2 py-1.5 text-sm text-right bg-white" />
              <span className="col-span-3 sm:col-span-1 text-sm text-right pt-2 tabular-nums">{sub > 0 ? fmtMoney(sub) : '—'}</span>
              <button type="button" onClick={() => removeItem(idx)} disabled={items.length === 1}
                className="col-span-2 sm:col-span-1 text-xs text-red-400 hover:text-red-600 disabled:opacity-30 text-right">✕</button>
              <input value={it.inventoryItemId}
                onChange={(e) => updateItem(idx, 'inventoryItemId', e.target.value)}
                placeholder="ID inventario (opcional)"
                className="col-span-12 border rounded px-2 py-1 text-xs bg-white" />
            </div>
          )
        })}
      </div>

      <div className="flex justify-end">
        <div className="text-right">
          <span className="text-sm text-gray-500">Total</span>
          <p className="text-2xl font-bold tabular-nums">{fmtMoney(total)}</p>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => navigate('/proveedores/compras')}
          className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50">Cancelar</button>
        <button type="submit" disabled={create.isPending}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
          {create.isPending ? 'Creando…' : 'Crear compra'}
        </button>
      </div>
    </form>
  )
}
