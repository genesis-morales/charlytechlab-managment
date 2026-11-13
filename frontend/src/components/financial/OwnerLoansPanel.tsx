import { useState } from 'react'
import {
  useOwnerLoans,
  useCreateOwnerLoan,
  useRepayOwnerLoan,
  useAccounts,
} from '../../api/financial'

function fmt(d: string) {
  return new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium' }).format(new Date(d))
}
function fmtMoney(n: string | number) {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency', currency: 'CRC', maximumFractionDigits: 0,
  }).format(Number(n))
}

export default function OwnerLoansPanel() {
  const { data, isLoading } = useOwnerLoans()
  const { data: accounts } = useAccounts()
  const createLoan = useCreateOwnerLoan()
  const repay = useRepayOwnerLoan()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ amount: '', description: '', loanedAt: '', accountId: '' })
  const [repayForm, setRepayForm] = useState<Record<string, { amount: string; paidAt: string; accountId: string }>>({})

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    await createLoan.mutateAsync({
      amount: Number(form.amount),
      description: form.description || undefined,
      loanedAt: new Date(form.loanedAt).toISOString(),
      accountId: form.accountId || undefined,
    })
    setShowForm(false)
    setForm({ amount: '', description: '', loanedAt: '', accountId: '' })
  }

  async function handleRepay(loanId: string) {
    const r = repayForm[loanId]
    if (!r || !r.amount || !r.paidAt) return
    await repay.mutateAsync({
      loanId,
      amount: Number(r.amount),
      paidAt: new Date(r.paidAt).toISOString(),
      accountId: r.accountId || undefined,
    })
    setRepayForm((prev) => {
      const next = { ...prev }
      delete next[loanId]
      return next
    })
  }

  function initRepay(loanId: string) {
    setRepayForm((prev) => ({
      ...prev,
      [loanId]: { amount: '', paidAt: new Date().toISOString().slice(0, 10), accountId: '' },
    }))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-800">Préstamos de la propietaria</h3>
          {data && Number(data.totalPending) > 0 && (
            <p className="text-sm text-orange-600 mt-0.5">
              Saldo pendiente total: <strong>{fmtMoney(data.totalPending)}</strong>
            </p>
          )}
        </div>
        <button onClick={() => setShowForm((v) => !v)}
          className="text-sm px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700">
          + Registrar préstamo
        </button>
      </div>

      {/* Formulario nuevo préstamo */}
      {showForm && (
        <form onSubmit={handleCreate} className="border rounded-lg p-4 space-y-3 bg-purple-50">
          <h4 className="font-medium text-sm">Nuevo préstamo de la propietaria</h4>
          <p className="text-xs text-gray-500">
            Registra cuando la propietaria aporta dinero temporal al negocio (no es inversión, es un préstamo que se devuelve).
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Monto ₡ *</label>
              <input type="number" min="1" step="100" required value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Fecha del préstamo *</label>
              <input type="date" required value={form.loanedAt}
                onChange={(e) => setForm((f) => ({ ...f, loanedAt: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Descripción (opcional)</label>
            <input value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Motivo del préstamo…"
              className="w-full border rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Cuenta destino (opcional)</label>
            <select value={form.accountId}
              onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}
              className="w-full border rounded px-2 py-1.5 text-sm">
              <option value="">No registrar ingreso a cuenta</option>
              {accounts?.data.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-0.5">
              Si selecciona una cuenta, se registra el ingreso automáticamente.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)}
              className="text-xs px-2 py-1 border rounded">Cancelar</button>
            <button type="submit" disabled={createLoan.isPending}
              className="text-xs px-2 py-1 bg-purple-600 text-white rounded disabled:opacity-50">
              {createLoan.isPending ? 'Guardando…' : 'Registrar préstamo'}
            </button>
          </div>
        </form>
      )}

      {/* Lista de préstamos */}
      {isLoading && <p className="text-sm text-gray-500">Cargando préstamos…</p>}
      {data?.data.length === 0 && !isLoading && (
        <p className="text-sm text-gray-400">Sin préstamos registrados.</p>
      )}

      {data?.data.map((loan) => (
        <div key={loan.id} className={`border rounded-lg p-4 ${loan.isRepaid ? 'opacity-60' : ''}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium tabular-nums">{fmtMoney(loan.amount)}</span>
                {loan.isRepaid
                  ? <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">Pagado</span>
                  : <span className="text-xs bg-orange-100 text-orange-700 rounded-full px-2 py-0.5">Pendiente</span>}
              </div>
              {loan.description && <p className="text-sm text-gray-500 mt-0.5">{loan.description}</p>}
              <p className="text-xs text-gray-400">{fmt(loan.loanedAt)}</p>
            </div>
            <div className="text-right text-sm">
              <p className="text-gray-500">Devuelto: <span className="tabular-nums">{fmtMoney(loan.repaid)}</span></p>
              <p className={Number(loan.pending) > 0 ? 'text-orange-600 font-medium' : 'text-green-600'}>
                Pendiente: <span className="tabular-nums">{fmtMoney(loan.pending)}</span>
              </p>
            </div>
          </div>

          {/* Devoluciones */}
          {loan.repayments.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-gray-500 mb-1">Devoluciones:</p>
              {loan.repayments.map((r) => (
                <div key={r.id} className="text-xs text-gray-500 flex justify-between">
                  <span>{fmt(r.paidAt)}{r.notes ? ` — ${r.notes}` : ''}</span>
                  <span className="tabular-nums">{fmtMoney(r.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Formulario de devolución */}
          {!loan.isRepaid && Number(loan.pending) > 0 && (
            <div className="mt-3">
              {!repayForm[loan.id] ? (
                <button onClick={() => initRepay(loan.id)}
                  className="text-xs text-teal-600 hover:underline">
                  + Registrar devolución
                </button>
              ) : (
                <div className="border rounded-md p-3 bg-teal-50 space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-gray-500">Monto ₡</label>
                      <input type="number" min="1" max={Number(loan.pending)} step="100"
                        value={repayForm[loan.id].amount}
                        onChange={(e) => setRepayForm((p) => ({
                          ...p, [loan.id]: { ...p[loan.id], amount: e.target.value },
                        }))}
                        placeholder={`Máx ${fmtMoney(loan.pending)}`}
                        className="w-full border rounded px-2 py-1 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Fecha</label>
                      <input type="date" value={repayForm[loan.id].paidAt}
                        onChange={(e) => setRepayForm((p) => ({
                          ...p, [loan.id]: { ...p[loan.id], paidAt: e.target.value },
                        }))}
                        className="w-full border rounded px-2 py-1 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Cuenta origen</label>
                      <select value={repayForm[loan.id].accountId}
                        onChange={(e) => setRepayForm((p) => ({
                          ...p, [loan.id]: { ...p[loan.id], accountId: e.target.value },
                        }))}
                        className="w-full border rounded px-2 py-1 text-sm">
                        <option value="">Sin cuenta</option>
                        {accounts?.data.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setRepayForm((p) => { const n = { ...p }; delete n[loan.id]; return n })}
                      className="text-xs px-2 py-1 border rounded">Cancelar</button>
                    <button onClick={() => handleRepay(loan.id)} disabled={repay.isPending}
                      className="text-xs px-2 py-1 bg-teal-600 text-white rounded disabled:opacity-50">
                      {repay.isPending ? 'Guardando…' : 'Registrar devolución'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
