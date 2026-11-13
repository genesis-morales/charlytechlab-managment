import { useState } from 'react'
import { useInventorySummary, CATEGORY_LABELS, type InventoryCategory } from '../../api/inventory'
import InventoryList from '../../components/inventory/InventoryList'

function fmtMoney(n: string | number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-CR', {
    style: 'currency', currency: 'CRC', maximumFractionDigits: 0,
  }).format(Number(n))
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <p className="text-xs text-gray-500 uppercase mb-1">{label}</p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function InventoryPage() {
  const [tab, setTab] = useState<'list' | 'summary'>('list')
  const { data: summary } = useInventorySummary()

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Inventario</h1>

      <div className="flex gap-1 mb-6 border-b">
        {(['list', 'summary'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t === 'list' ? 'Artículos' : 'Resumen de valor'}
          </button>
        ))}
      </div>

      {tab === 'list' && <InventoryList />}

      {tab === 'summary' && summary && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard label="Unidades totales" value={String(summary.totalItems)} />
            <SummaryCard label="Valor al costo" value={fmtMoney(summary.totalCost)} />
            <SummaryCard label="Valor de venta" value={fmtMoney(summary.totalSale)} />
            <SummaryCard label="Ganancia potencial" value={fmtMoney(summary.potentialProfit)}
              sub="Si se vende todo" />
          </div>

          <div>
            <h3 className="font-semibold text-gray-800 mb-3">Por categoría</h3>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-left">
                  <tr>
                    <th className="px-4 py-2 font-medium">Categoría</th>
                    <th className="px-4 py-2 font-medium text-right">Unidades</th>
                    <th className="px-4 py-2 font-medium text-right">Valor costo</th>
                    <th className="px-4 py-2 font-medium text-right">Valor venta</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {Object.entries(summary.byCategory).map(([cat, data]) => (
                    <tr key={cat} className="hover:bg-gray-50">
                      <td className="px-4 py-2">{CATEGORY_LABELS[cat as InventoryCategory] ?? cat}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{data.count}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmtMoney(data.costValue)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmtMoney(data.saleValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
