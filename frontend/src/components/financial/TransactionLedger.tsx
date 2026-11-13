import { useState } from 'react'
import {
  useTransactions,
  useCreateTransaction,
  useConfirmTransaction,
  useVoidTransaction,
  useAccounts,
  useFunds,
  useCategories,
  TX_TYPE_LABELS,
  CREDIT_TYPES,
  type TransactionType,
} from '../../api/financial'

function fmt(d: string) {
  return new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium' }).format(new Date(d))
}
function fmtMoney(n: string | number) {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency', currency: 'CRC', maximumFractionDigits: 0,
  }).format(Number(n))
}

const ALL_TYPES = Object.keys(TX_TYPE_LABELS) as TransactionType[]
const MANUAL_TYPES = ALL_TYPES.filter((type) => !['TRANSFER', 'OWNER_LOAN', 'OWNER_LOAN_REPAYMENT'].includes(type))

export default function TransactionLedger() {
  const [filters, setFilters] = useState({
    accountId: '', fundId: '', type: '', confirmed: '',
    from: '', to: '', page: 1,
  })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    type: 'INCOME' as TransactionType,
    amount: '',
    description: '',
    accountId: '',
    fundId: '',
    categoryId: '',
    reference: '',
    notes: '',
    transactedAt: '',
  })

  const { data, isLoading } = useTransactions({
    accountId: filters.accountId || undefined,
    fundId: filters.fundId || undefined,
    type: filters.type || undefined,
    confirmed: filters.confirmed || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    page: filters.page,
    limit: 40,
  })
  const { data: accounts } = useAccounts()
  const { data: funds } = useFunds()
  const { data: cats } = useCategories()

  const createTx = useCreateTransaction()
  const confirmTx = useConfirmTransaction()
  const voidTx = useVoidTransaction()

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    await createTx.mutateAsync({
      type: form.type,
      amount: Number(form.amount),
      description: form.description,
      accountId: form.accountId || undefined,
      fundId: form.fundId || undefined,
      categoryId: form.categoryId || undefined,
      reference: form.reference || undefined,
      notes: form.notes || undefined,
      transactedAt: form.transactedAt ? new Date(form.transactedAt).toISOString() : undefined,
    })
    setShowForm(false)
    setForm({ type: 'INCOME', amount: '', description: '', accountId: '', fundId: '', categoryId: '', reference: '', notes: '', transactedAt: '' })
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <select value={filters.accountId} onChange={(e) => setFilters((f) => ({ ...f, accountId: e.target.value, page: 1 }))}
          className="border rounded px-2 py-1.5 text-sm">
          <option value="">Todas las cuentas</option>
          {accounts?.data.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value, page: 1 }))}
          className="border rounded px-2 py-1.5 text-sm">
          <option value="">Todos los tipos</option>
          {ALL_TYPES.map((t) => <option key={t} value={t}>{TX_TYPE_LABELS[t]}</option>)}
        </select>
        <select value={filters.confirmed} onChange={(e) => setFilters((f) => ({ ...f, confirmed: e.target.value, page: 1 }))}
          className="border rounded px-2 py-1.5 text-sm">
          <option value="">Todos</option>
          <option value="true">Confirmados</option>
          <option value="false">Pendientes</option>
        </select>
        <input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value, page: 1 }))}
          className="border rounded px-2 py-1.5 text-sm" />
        <input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value, page: 1 }))}
          className="border rounded px-2 py-1.5 text-sm" />
        <button onClick={() => setShowForm((v) => !v)}
          className="ml-auto px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">
          + Registrar movimiento
        </button>
      </div>

      {/* Formulario de nuevo movimiento */}
      {showForm && (
        <form onSubmit={handleCreate} className="border rounded-lg p-4 space-y-3 bg-gray-50">
          <h4 className="font-semibold text-sm">Nuevo movimiento</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500">Tipo *</label>
              <select required value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as TransactionType }))}
                className="w-full border rounded px-2 py-1.5 text-sm">
                {MANUAL_TYPES.map((t) => (
                  <option key={t} value={t}>{TX_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Monto ₡ *</label>
              <input type="number" min="1" step="100" required value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Fecha</label>
              <input type="date" value={form.transactedAt}
                onChange={(e) => setForm((f) => ({ ...f, transactedAt: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div className="col-span-2 sm:col-span-3">
              <label className="text-xs text-gray-500">Descripción *</label>
              <input required value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Cuenta</label>
              <select value={form.accountId}
                onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm">
                <option value="">Sin cuenta</option>
                {accounts?.data.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Fondo</label>
              <select value={form.fundId}
                onChange={(e) => setForm((f) => ({ ...f, fundId: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm">
                <option value="">Sin fondo</option>
                {funds?.data.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Categoría</label>
              <select value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm">
                <option value="">Sin categoría</option>
                {cats?.data.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Referencia</label>
              <input value={form.reference}
                onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                placeholder="# factura, recibo…"
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)}
              className="text-xs px-2 py-1 border rounded">Cancelar</button>
            <button type="submit" disabled={createTx.isPending}
              className="text-xs px-2 py-1 bg-blue-600 text-white rounded disabled:opacity-50">
              {createTx.isPending ? 'Guardando…' : 'Registrar (como pendiente)'}
            </button>
          </div>
        </form>
      )}

      {/* Tabla */}
      {isLoading && <p className="text-sm text-gray-500">Cargando movimientos…</p>}
      {data && (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Descripción</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Cuenta</th>
                  <th className="px-3 py-2 font-medium text-right">Monto</th>
                  <th className="px-3 py-2 font-medium text-center">Estado</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.data.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                      Sin movimientos con los filtros aplicados.
                    </td>
                  </tr>
                )}
                {data.data.map((tx) => {
                  const isCredit = tx.type === 'TRANSFER' ? tx.transferDirection === 'IN' : CREDIT_TYPES.has(tx.type)
                  return (
                    <tr key={tx.id} className={`hover:bg-gray-50 ${tx.isVoided ? 'opacity-40 line-through' : ''}`}>
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{fmt(tx.transactedAt)}</td>
                      <td className="px-3 py-2">
                        <span>{tx.description}</span>
                        {tx.reference && <span className="text-xs text-gray-400 block">Ref: {tx.reference}</span>}
                        {tx.fund && <span className="text-xs text-yellow-600 block">Fondo: {tx.fund.name}</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {TX_TYPE_LABELS[tx.type]}
                        {tx.category && <span className="block text-gray-400">{tx.category.name}</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-500">{tx.account?.name ?? '—'}</td>
                      <td className={`px-3 py-2 text-right font-medium tabular-nums ${isCredit ? 'text-green-700' : 'text-red-600'}`}>
                        {isCredit ? '+' : '-'}{fmtMoney(tx.amount)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {tx.isVoided ? (
                          <span className="text-xs text-gray-400">Anulado</span>
                        ) : tx.isConfirmed ? (
                          <span className="text-xs text-green-600">✓ Confirmado</span>
                        ) : (
                          <span className="text-xs text-orange-500">Pendiente</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {!tx.isVoided && !tx.isConfirmed && (
                          <button
                            onClick={() => confirmTx.mutate(tx.id)}
                            disabled={confirmTx.isPending}
                            className="text-xs text-teal-600 hover:underline"
                          >
                            Confirmar
                          </button>
                        )}
                        {!tx.isVoided && !['OWNER_LOAN', 'OWNER_LOAN_REPAYMENT'].includes(tx.type) && (tx.type !== 'TRANSFER' || tx.transferId) && (
                          <button
                            onClick={async () => {
                              const r = prompt(tx.transferId ? 'Se revertirán ambas cuentas de la transferencia. Motivo de anulación:' : 'Motivo de anulación:')
                              if (!r) return
                              await voidTx.mutateAsync({ id: tx.id, reason: r })
                            }}
                            className="text-xs text-red-400 hover:underline ml-2"
                            disabled={voidTx.isPending}
                          >
                            Anular
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {data.meta.pages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>
                {(filters.page - 1) * 40 + 1}–{Math.min(filters.page * 40, data.meta.total)} de {data.meta.total}
              </span>
              <div className="flex gap-2">
                <button onClick={() => setFilters((f) => ({ ...f, page: Math.max(1, f.page - 1) }))}
                  disabled={filters.page === 1}
                  className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50">
                  ← Anterior
                </button>
                <button onClick={() => setFilters((f) => ({ ...f, page: Math.min(data.meta.pages, f.page + 1) }))}
                  disabled={filters.page === data.meta.pages}
                  className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50">
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
