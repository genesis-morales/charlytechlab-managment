import { useState } from 'react'
import {
  useInventoryItems,
  useCreateInventoryItem,
  useAddMovement,
  useAdjustStock,
  CATEGORY_LABELS,
  MOVEMENT_TYPE_LABELS,
  type InventoryCategory,
  type InventoryMovementType,
} from '../../api/inventory'

function fmtMoney(n: string | number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-CR', {
    style: 'currency', currency: 'CRC', maximumFractionDigits: 0,
  }).format(Number(n))
}

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as InventoryCategory[]
const OUTBOUND_TYPES: InventoryMovementType[] = ['CONSUMPTION', 'SALE', 'WRITE_OFF']

// ---- Formulario nuevo artículo ----
function NewItemForm({ onClose }: { onClose: () => void }) {
  const create = useCreateInventoryItem()
  const [form, setForm] = useState({
    name: '', category: 'SPARE_PART' as InventoryCategory,
    description: '', sku: '', minQuantity: '0',
    costPrice: '', salePrice: '', quantity: '0',
    // Specs para RAM/SSD
    capacity: '', memType: '', formFactor: '', speed: '',
  })

  const isRamSsd = form.category === 'COMPONENT_RAM' || form.category === 'COMPONENT_SSD'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const specs = isRamSsd
      ? { capacity: form.capacity, type: form.memType, formFactor: form.formFactor, speed: form.speed }
      : undefined

    await create.mutateAsync({
      name: form.name,
      category: form.category,
      description: form.description || undefined,
      sku: form.sku || undefined,
      minQuantity: Number(form.minQuantity),
      costPrice: form.costPrice ? Number(form.costPrice) : undefined,
      salePrice: form.salePrice ? Number(form.salePrice) : undefined,
      quantity: Number(form.quantity),
      specs: specs as Record<string, string> | undefined,
    })
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="border rounded-lg p-4 space-y-4 bg-gray-50 mb-4">
      <h4 className="font-semibold text-sm">Nuevo artículo</h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="col-span-2 sm:col-span-2">
          <label className="text-xs text-gray-500">Nombre *</label>
          <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500">Categoría *</label>
          <select required value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as InventoryCategory }))}
            className="w-full border rounded px-2 py-1.5 text-sm">
            {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">SKU (opcional)</label>
          <input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
            className="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500">Stock inicial</label>
          <input type="number" min="0" step="1" value={form.quantity}
            onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
            className="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500">Alerta stock mínimo</label>
          <input type="number" min="0" step="1" value={form.minQuantity}
            onChange={(e) => setForm((f) => ({ ...f, minQuantity: e.target.value }))}
            className="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500">Precio costo ₡</label>
          <input type="number" min="0" step="100" value={form.costPrice}
            onChange={(e) => setForm((f) => ({ ...f, costPrice: e.target.value }))}
            className="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500">Precio venta ₡</label>
          <input type="number" min="0" step="100" value={form.salePrice}
            onChange={(e) => setForm((f) => ({ ...f, salePrice: e.target.value }))}
            className="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
      </div>

      {/* Specs RAM/SSD */}
      {isRamSsd && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2 uppercase">Especificaciones de compatibilidad</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className="text-xs text-gray-400">Capacidad</label>
              <input value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                placeholder="8GB" className="w-full border rounded px-2 py-1 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-400">Tipo</label>
              <input value={form.memType} onChange={(e) => setForm((f) => ({ ...f, memType: e.target.value }))}
                placeholder="DDR4 / NVMe" className="w-full border rounded px-2 py-1 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-400">Factor de forma</label>
              <input value={form.formFactor} onChange={(e) => setForm((f) => ({ ...f, formFactor: e.target.value }))}
                placeholder="SO-DIMM / M.2" className="w-full border rounded px-2 py-1 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-400">Velocidad</label>
              <input value={form.speed} onChange={(e) => setForm((f) => ({ ...f, speed: e.target.value }))}
                placeholder="3200MHz" className="w-full border rounded px-2 py-1 text-sm" />
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="text-xs px-3 py-1.5 border rounded">Cancelar</button>
        <button type="submit" disabled={create.isPending}
          className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded disabled:opacity-50">
          {create.isPending ? 'Guardando…' : 'Crear artículo'}
        </button>
      </div>
    </form>
  )
}

import { InventoryItem } from '../../api/inventory'

// ---- Fila de artículo con acciones inline ----
function ItemRow({ item }: { item: InventoryItem }) {
  const [showMovement, setShowMovement] = useState(false)
  const [showAdjust, setShowAdjust] = useState(false)
  const [movForm, setMovForm] = useState({ type: 'ENTRY' as InventoryMovementType, quantity: '1', unitCost: '', notes: '' })
  const [adjustForm, setAdjustForm] = useState({ newQuantity: String(item.quantity), reason: '' })

  const addMovement = useAddMovement()
  const adjust = useAdjustStock()

  const isLowStock = item.minQuantity > 0 && item.quantity <= item.minQuantity

  async function handleMovement(e: React.FormEvent) {
    e.preventDefault()
    await addMovement.mutateAsync({
      itemId: item.id,
      type: movForm.type,
      quantity: Number(movForm.quantity),
      unitCost: movForm.unitCost ? Number(movForm.unitCost) : undefined,
      notes: movForm.notes || undefined,
    })
    setShowMovement(false)
    setMovForm({ type: 'ENTRY', quantity: '1', unitCost: '', notes: '' })
  }

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault()
    await adjust.mutateAsync({ itemId: item.id, newQuantity: Number(adjustForm.newQuantity), reason: adjustForm.reason })
    setShowAdjust(false)
  }

  // Specs para RAM/SSD
  const specs = item.specs as Record<string, string> | null
  const specsStr = specs
    ? [specs.capacity, specs.type, specs.formFactor, specs.speed].filter(Boolean).join(' · ')
    : null

  return (
    <>
      <tr className={`hover:bg-gray-50 ${isLowStock ? 'bg-orange-50' : ''}`}>
        <td className="px-3 py-2">
          <p className="font-medium text-sm">{item.name}</p>
          {specsStr && <p className="text-xs text-gray-400">{specsStr}</p>}
          {item.sku && <p className="text-xs text-gray-400">SKU: {item.sku}</p>}
        </td>
        <td className="px-3 py-2 text-xs text-gray-500">{CATEGORY_LABELS[item.category]}</td>
        <td className="px-3 py-2 text-center">
          <span className={`font-bold tabular-nums ${isLowStock ? 'text-orange-600' : 'text-gray-800'}`}>
            {item.quantity}
          </span>
          {isLowStock && <span className="block text-xs text-orange-500">⚠ bajo</span>}
          <span className="text-xs text-gray-400 block">mín {item.minQuantity}</span>
        </td>
        <td className="px-3 py-2 text-right text-sm tabular-nums">{fmtMoney(item.costPrice)}</td>
        <td className="px-3 py-2 text-right text-sm tabular-nums">{fmtMoney(item.salePrice)}</td>
        <td className="px-3 py-2 text-right">
          <div className="flex justify-end gap-2 text-xs">
            <button onClick={() => { setShowMovement((v) => !v); setShowAdjust(false) }}
              className="text-blue-600 hover:underline">Movimiento</button>
            <button onClick={() => { setShowAdjust((v) => !v); setShowMovement(false) }}
              className="text-gray-500 hover:underline">Ajustar</button>
          </div>
        </td>
      </tr>

      {/* Panel de movimiento */}
      {showMovement && (
        <tr>
          <td colSpan={6} className="px-3 py-0 pb-2">
            <form onSubmit={handleMovement} className="border rounded-md p-3 space-y-2 bg-blue-50">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="text-xs text-gray-500">Tipo *</label>
                  <select required value={movForm.type}
                    onChange={(e) => setMovForm((f) => ({ ...f, type: e.target.value as InventoryMovementType }))}
                    className="w-full border rounded px-2 py-1 text-sm">
                    {(Object.keys(MOVEMENT_TYPE_LABELS) as InventoryMovementType[]).map((t) => (
                      <option key={t} value={t}>{MOVEMENT_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Cantidad *</label>
                  <input type="number" min="1" step="1" required value={movForm.quantity}
                    onChange={(e) => setMovForm((f) => ({ ...f, quantity: e.target.value }))}
                    className="w-full border rounded px-2 py-1 text-sm" />
                </div>
                {!OUTBOUND_TYPES.includes(movForm.type) && (
                  <div>
                    <label className="text-xs text-gray-500">Costo unit. ₡</label>
                    <input type="number" min="0" step="100" value={movForm.unitCost}
                      onChange={(e) => setMovForm((f) => ({ ...f, unitCost: e.target.value }))}
                      className="w-full border rounded px-2 py-1 text-sm" />
                  </div>
                )}
                <div>
                  <label className="text-xs text-gray-500">Notas</label>
                  <input value={movForm.notes}
                    onChange={(e) => setMovForm((f) => ({ ...f, notes: e.target.value }))}
                    className="w-full border rounded px-2 py-1 text-sm" />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowMovement(false)}
                  className="text-xs px-2 py-1 border rounded">Cancelar</button>
                <button type="submit" disabled={addMovement.isPending}
                  className="text-xs px-2 py-1 bg-blue-600 text-white rounded disabled:opacity-50">
                  {addMovement.isPending ? '…' : 'Registrar'}
                </button>
              </div>
            </form>
          </td>
        </tr>
      )}

      {/* Panel de ajuste */}
      {showAdjust && (
        <tr>
          <td colSpan={6} className="px-3 py-0 pb-2">
            <form onSubmit={handleAdjust} className="border rounded-md p-3 space-y-2 bg-yellow-50">
              <p className="text-xs text-gray-500">
                Ajuste por conteo físico. Stock actual: <strong>{item.quantity}</strong>
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500">Nueva cantidad real *</label>
                  <input type="number" min="0" step="1" required value={adjustForm.newQuantity}
                    onChange={(e) => setAdjustForm((f) => ({ ...f, newQuantity: e.target.value }))}
                    className="w-full border rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Motivo *</label>
                  <input required value={adjustForm.reason}
                    onChange={(e) => setAdjustForm((f) => ({ ...f, reason: e.target.value }))}
                    placeholder="Conteo físico, merma…"
                    className="w-full border rounded px-2 py-1 text-sm" />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowAdjust(false)}
                  className="text-xs px-2 py-1 border rounded">Cancelar</button>
                <button type="submit" disabled={adjust.isPending}
                  className="text-xs px-2 py-1 bg-yellow-600 text-white rounded disabled:opacity-50">
                  {adjust.isPending ? '…' : 'Guardar ajuste'}
                </button>
              </div>
            </form>
          </td>
        </tr>
      )}
    </>
  )
}

// ---- Vista principal ----
export default function InventoryList() {
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [lowStock, setLowStock] = useState(false)
  const [page, setPage] = useState(1)
  const [showNewForm, setShowNewForm] = useState(false)

  const { data, isLoading, isError } = useInventoryItems({
    q: search || undefined,
    category: category || undefined,
    lowStock: lowStock ? 'true' : undefined,
    page,
    limit: 50,
  })

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(q)
    setPage(1)
  }

  return (
    <div className="space-y-4">
      {/* Controles */}
      <div className="flex flex-wrap gap-2">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <input type="text" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar artículo…"
            className="flex-1 border rounded-md px-3 py-2 text-sm" />
          <button type="submit" className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md">
            Buscar
          </button>
        </form>
        <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }}
          className="border rounded-md px-3 py-2 text-sm">
          <option value="">Todas las categorías</option>
          {(Object.keys(CATEGORY_LABELS) as InventoryCategory[]).map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm cursor-pointer border rounded-md px-3 py-2">
          <input type="checkbox" checked={lowStock} onChange={(e) => { setLowStock(e.target.checked); setPage(1) }} />
          Solo stock bajo
        </label>
        <button onClick={() => setShowNewForm((v) => !v)}
          className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">
          + Nuevo artículo
        </button>
      </div>

      {showNewForm && <NewItemForm onClose={() => setShowNewForm(false)} />}

      {isLoading && <p className="text-sm text-gray-500">Cargando inventario…</p>}
      {isError && <p className="text-sm text-red-500">Error al cargar inventario.</p>}

      {data && (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Artículo</th>
                  <th className="px-3 py-2 font-medium">Categoría</th>
                  <th className="px-3 py-2 font-medium text-center">Stock</th>
                  <th className="px-3 py-2 font-medium text-right">Costo</th>
                  <th className="px-3 py-2 font-medium text-right">Venta</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.data.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      {search || category || lowStock ? 'Sin resultados.' : 'Inventario vacío.'}
                    </td>
                  </tr>
                )}
                {data.data.map((item) => (
                  <ItemRow key={item.id} item={item} />
                ))}
              </tbody>
            </table>
          </div>

          {data.meta.pages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>{(page - 1) * 50 + 1}–{Math.min(page * 50, data.meta.total)} de {data.meta.total}</span>
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
