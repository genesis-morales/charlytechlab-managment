import { useState } from 'react'
import {
  useFinancialSummary,
  useAccounts,
  useFunds,
  useCreateAccount,
  useCreateFund,
  useTransfer,
} from '../../api/financial'

function fmtMoney(n: number | string) {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency', currency: 'CRC', maximumFractionDigits: 0,
  }).format(Number(n))
}

// ---- Targeta de saldo ----
function BalanceCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <p className="text-xs text-gray-500 uppercase mb-1">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{fmtMoney(value)}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ---- Panel de cuentas ----
function AccountsPanel() {
  const { data } = useAccounts()
  const create = useCreateAccount()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    await create.mutateAsync(form)
    setShowForm(false)
    setForm({ name: '', description: '' })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-800">Cuentas</h3>
        <button onClick={() => setShowForm((v) => !v)} className="text-xs text-blue-600 hover:underline">
          + Nueva cuenta
        </button>
      </div>
      {showForm && (
        <form onSubmit={handleCreate} className="border rounded-md p-3 space-y-2 mb-2 bg-blue-50">
          <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Nombre de la cuenta *" className="w-full border rounded px-2 py-1.5 text-sm" />
          <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Descripción (opcional)" className="w-full border rounded px-2 py-1.5 text-sm" />
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="text-xs px-2 py-1 border rounded">Cancelar</button>
            <button type="submit" disabled={create.isPending}
              className="text-xs px-2 py-1 bg-blue-600 text-white rounded disabled:opacity-50">
              {create.isPending ? 'Guardando…' : 'Crear'}
            </button>
          </div>
        </form>
      )}
      <div className="space-y-1">
        {data?.data.map((a) => (
          <div key={a.id} className="flex justify-between items-center border rounded-md px-3 py-2 text-sm">
            <div>
              <span className="font-medium">{a.name}</span>
              {a.description && <span className="text-xs text-gray-400 ml-2">{a.description}</span>}
              {!a.isActive && <span className="ml-2 text-xs text-gray-400">(inactiva)</span>}
            </div>
            <span className={`tabular-nums font-medium ${Number(a.balance) < 0 ? 'text-red-600' : 'text-gray-800'}`}>
              {fmtMoney(a.balance)}
            </span>
          </div>
        ))}
        {!data?.data.length && (
          <p className="text-sm text-gray-400">Sin cuentas registradas.</p>
        )}
      </div>
    </div>
  )
}

// ---- Panel de fondos ----
function FundsPanel() {
  const { data } = useFunds()
  const create = useCreateFund()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    await create.mutateAsync(form)
    setShowForm(false)
    setForm({ name: '', description: '' })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-800">Fondos</h3>
        <button onClick={() => setShowForm((v) => !v)} className="text-xs text-blue-600 hover:underline">
          + Nuevo fondo
        </button>
      </div>
      {showForm && (
        <form onSubmit={handleCreate} className="border rounded-md p-3 space-y-2 mb-2 bg-yellow-50">
          <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Nombre del fondo *" className="w-full border rounded px-2 py-1.5 text-sm" />
          <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Descripción (opcional)" className="w-full border rounded px-2 py-1.5 text-sm" />
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="text-xs px-2 py-1 border rounded">Cancelar</button>
            <button type="submit" disabled={create.isPending}
              className="text-xs px-2 py-1 bg-yellow-600 text-white rounded disabled:opacity-50">
              {create.isPending ? 'Guardando…' : 'Crear'}
            </button>
          </div>
        </form>
      )}
      <div className="space-y-1">
        {data?.data.map((f) => (
          <div key={f.id} className="flex justify-between items-center border rounded-md px-3 py-2 text-sm">
            <div>
              <span className="font-medium">{f.name}</span>
              {f.description && <span className="text-xs text-gray-400 ml-2">{f.description}</span>}
            </div>
            <span className="tabular-nums font-medium">{fmtMoney(f.balance)}</span>
          </div>
        ))}
        {!data?.data.length && (
          <p className="text-sm text-gray-400">Sin fondos registrados.</p>
        )}
      </div>
    </div>
  )
}

// ---- Panel de transferencia ----
function TransferPanel() {
  const { data: acctData } = useAccounts()
  const transfer = useTransfer()
  const [show, setShow] = useState(false)
  const [form, setForm] = useState({ fromAccountId: '', toAccountId: '', amount: '', description: '' })
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await transfer.mutateAsync({
        fromAccountId: form.fromAccountId,
        toAccountId: form.toAccountId,
        amount: Number(form.amount),
        description: form.description,
      })
      setShow(false)
      setForm({ fromAccountId: '', toAccountId: '', amount: '', description: '' })
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e?.response?.data?.error ?? 'Error al transferir')
    }
  }

  const accounts = acctData?.data ?? []

  return (
    <div>
      <button onClick={() => setShow((v) => !v)}
        className="text-sm px-3 py-1.5 border rounded-md hover:bg-gray-50">
        ↔ Transferir entre cuentas
      </button>
      {show && (
        <form onSubmit={handleSubmit} className="mt-3 border rounded-md p-4 space-y-3 bg-gray-50">
          <h4 className="font-medium text-sm">Transferencia entre cuentas</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Desde *</label>
              <select required value={form.fromAccountId}
                onChange={(e) => setForm((f) => ({ ...f, fromAccountId: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm">
                <option value="">Seleccionar…</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({fmtMoney(a.balance)})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Hacia *</label>
              <select required value={form.toAccountId}
                onChange={(e) => setForm((f) => ({ ...f, toAccountId: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm">
                <option value="">Seleccionar…</option>
                {accounts.filter((a) => a.id !== form.fromAccountId).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Monto ₡ *</label>
              <input type="number" min="1" step="100" required value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Descripción *</label>
              <input required value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setShow(false)} className="text-xs px-2 py-1 border rounded">Cancelar</button>
            <button type="submit" disabled={transfer.isPending}
              className="text-xs px-2 py-1 bg-blue-600 text-white rounded disabled:opacity-50">
              {transfer.isPending ? 'Procesando…' : 'Confirmar transferencia'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

export default function FinancialOverview() {
  const { data: summary } = useFinancialSummary()

  return (
    <div className="space-y-6">
      {/* Tarjetas de resumen */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <BalanceCard label="Saldo total" value={summary.totalBalance} />
          <BalanceCard label="Fondos reservados" value={summary.totalFunds} />
          <BalanceCard
            label="Deuda con propietaria"
            value={summary.totalOwnerDebt}
            sub={Number(summary.totalOwnerDebt) > 0 ? 'Pendiente de devolución' : 'Al día'}
          />
          <BalanceCard label="Movimientos este mes" value={summary.monthlyMovements} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AccountsPanel />
        <FundsPanel />
      </div>

      <TransferPanel />
    </div>
  )
}
