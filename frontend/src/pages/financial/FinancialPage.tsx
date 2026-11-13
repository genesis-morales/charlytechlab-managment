import { useState } from 'react'
import FinancialOverview from '../../components/financial/FinancialOverview'
import TransactionLedger from '../../components/financial/TransactionLedger'
import OwnerLoansPanel from '../../components/financial/OwnerLoansPanel'

type Tab = 'overview' | 'transactions' | 'loans'

const TAB_LABELS: Record<Tab, string> = {
  overview: 'Resumen',
  transactions: 'Movimientos',
  loans: 'Préstamos propietaria',
}

export default function FinancialPage() {
  const [tab, setTab] = useState<Tab>('overview')

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Financiero</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b">
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === 'overview' && <FinancialOverview />}
      {tab === 'transactions' && <TransactionLedger />}
      {tab === 'loans' && <OwnerLoansPanel />}
    </div>
  )
}
