import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useQuote,
  useQuotePayments,
  useSendQuote,
  useApproveQuote,
  useRejectQuote,
  useAddPayment,
  useVoidPayment,
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_COLORS,
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from '../../api/quotes'

function fmt(d: string) {
  return new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium' }).format(new Date(d))
}
function fmtMoney(n: number | string) {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency', currency: 'CRC', maximumFractionDigits: 0,
  }).format(Number(n))
}

const ITEM_TYPE_LABELS: Record<string, string> = {
  part: 'Repuesto', labor: 'Mano de obra', service: 'Servicio', other: 'Otro',
}

// ---- Generacion de texto para WhatsApp ----
function buildWhatsAppText(quote: ReturnType<typeof useQuote>['data'], balance: string): string {
  if (!quote) return ''
  const lines: string[] = [
    `*Cotización ${quote.number} — Charly Tech Lab*`,
    '',
  ]
  if (quote.customer) lines.push(`Cliente: ${quote.customer.name}`)
  if (quote.workOrder) lines.push(`Orden: ${quote.workOrder.number}`)
  lines.push('')
  lines.push('*Detalle:*')
  quote.items.forEach((it) => {
    const sub = Number(it.subtotal)
    lines.push(
      `• ${it.description} (${ITEM_TYPE_LABELS[it.itemType] ?? it.itemType}) x${it.quantity} = ${fmtMoney(sub)}`,
    )
  })
  lines.push('')
  lines.push(`*Total: ${fmtMoney(Number(quote.total))}*`)
  if (Number(balance) > 0 && Number(balance) < Number(quote.total)) {
    lines.push(`Saldo pendiente: ${fmtMoney(Number(balance))}`)
  }
  if (quote.validUntil) lines.push(`Válida hasta: ${fmt(quote.validUntil)}`)
  if (quote.notes) lines.push(`\n_${quote.notes}_`)
  if (quote.terms) lines.push(`\n${quote.terms}`)
  return lines.join('\n')
}

function whatsappUrl(phone: string, text: string): string {
  const clean = phone.replace(/\D/g, '')
  const num = clean.startsWith('506') ? clean : `506${clean}`
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`
}

// ---- Panel de pagos ----
function PaymentPanel({ quoteId }: { quoteId: string }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ amount: '', method: 'CASH' as PaymentMethod, reference: '', notes: '' })
  const { data, isLoading } = useQuotePayments(quoteId)
  const addPayment = useAddPayment()
  const voidPayment = useVoidPayment()

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    await addPayment.mutateAsync({
      quoteId,
      amount: Number(form.amount),
      method: form.method,
      reference: form.reference || undefined,
      notes: form.notes || undefined,
    })
    setShowForm(false)
    setForm({ amount: '', method: 'CASH', reference: '', notes: '' })
  }

  if (isLoading) return <p className="text-xs text-gray-400">Cargando pagos…</p>
  if (!data) return null

  const { summary } = data

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-800">Pagos</h3>
        {!summary.isPaidInFull && (
          <button onClick={() => setShowForm((v) => !v)}
            className="text-sm text-blue-600 hover:underline">
            + Registrar pago
          </button>
        )}
      </div>

      {/* Resumen financiero */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { label: 'Total', value: fmtMoney(summary.total) },
          { label: 'Pagado', value: fmtMoney(summary.paid) },
          { label: 'Saldo', value: fmtMoney(summary.balance), highlight: Number(summary.balance) > 0 },
        ].map(({ label, value, highlight }) => (
          <div key={label} className={`rounded-md border p-2 text-center ${highlight ? 'border-orange-200 bg-orange-50' : ''}`}>
            <p className="text-xs text-gray-500">{label}</p>
            <p className="font-bold tabular-nums text-sm">{value}</p>
          </div>
        ))}
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="border rounded-md p-3 space-y-2 mb-3 bg-green-50">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500">Monto ₡ *</label>
              <input
                type="number" min="1" step="100" required
                value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder={`Máx ${fmtMoney(summary.balance)}`}
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Método *</label>
              <select value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value as PaymentMethod }))}
                className="w-full border rounded px-2 py-1.5 text-sm">
                {(Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <input type="text" value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
            placeholder="Referencia (número SINPE, confirmación, etc.)"
            className="w-full border rounded px-2 py-1.5 text-sm" />
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="text-xs px-2 py-1 border rounded">Cancelar</button>
            <button type="submit" disabled={addPayment.isPending}
              className="text-xs px-2 py-1 bg-green-600 text-white rounded disabled:opacity-50">
              {addPayment.isPending ? 'Guardando…' : 'Registrar'}
            </button>
          </div>
        </form>
      )}

      {data.data.length === 0 && !showForm && (
        <p className="text-sm text-gray-400">Sin pagos registrados.</p>
      )}

      {data.data.map((p) => (
        <div key={p.id} className={`flex items-center justify-between border rounded-md p-2 mb-1 text-sm ${p.isVoided ? 'opacity-40 line-through' : ''}`}>
          <div>
            <span className="font-medium tabular-nums">{fmtMoney(p.amount)}</span>
            <span className="ml-2 text-gray-500">{PAYMENT_METHOD_LABELS[p.method]}</span>
            {p.reference && <span className="ml-2 text-xs text-gray-400">#{p.reference}</span>}
            <span className="ml-2 text-xs text-gray-400">{fmt(p.paidAt)}</span>
          </div>
          {!p.isVoided && (
            <button
              onClick={async () => {
                const reason = prompt('Motivo de anulación:')
                if (!reason) return
                await voidPayment.mutateAsync({ quoteId, paymentId: p.id, reason })
              }}
              className="text-xs text-red-400 hover:text-red-600"
            >
              Anular
            </button>
          )}
          {p.isVoided && p.voidReason && (
            <span className="text-xs text-red-400 no-underline" style={{ textDecoration: 'none' }}>
              {p.voidReason}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

// ---- Detalle principal ----
export default function QuoteDetail({ quoteId }: { quoteId: string }) {
  const navigate = useNavigate()
  const { data: quote, isLoading, isError } = useQuote(quoteId)
  const { data: payData } = useQuotePayments(quoteId)
  const send = useSendQuote()
  const approve = useApproveQuote()
  const reject = useRejectQuote()

  if (isLoading) return <p className="text-sm text-gray-500 p-4">Cargando cotización…</p>
  if (isError || !quote) return <p className="text-sm text-red-500 p-4">Cotización no encontrada.</p>

  const balance = payData?.summary.balance ?? String(quote.total)
  const waText = buildWhatsAppText(quote, balance)
  const waUrl = quote.customer?.phone ? whatsappUrl(quote.customer.phone, waText) : null

  // ---- PDF simple usando ventana de impresión ----
  function handlePrint() {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html><head><title>${quote!.number}</title>
      <style>
        body{font-family:sans-serif;padding:2rem;max-width:700px;margin:0 auto}
        h1{font-size:1.4rem;margin-bottom:0.2rem}
        p.sub{color:#666;margin-top:0}
        table{width:100%;border-collapse:collapse;margin-top:1rem}
        th{text-align:left;border-bottom:2px solid #ddd;padding:6px 8px;font-size:0.85rem}
        td{padding:6px 8px;border-bottom:1px solid #eee;font-size:0.85rem}
        .right{text-align:right}
        .total{font-size:1.1rem;font-weight:bold;text-align:right;margin-top:1rem}
        .footer{margin-top:2rem;font-size:0.8rem;color:#999}
      </style></head><body>
      <h1>Cotización ${quote!.number}</h1>
      <p class="sub">
        ${quote!.customer ? `<strong>${quote!.customer.name}</strong> · ${quote!.customer.phone}` : ''}
        ${quote!.workOrder ? ` · Orden ${quote!.workOrder.number}` : ''}
        <br>Fecha: ${fmt(quote!.createdAt)}
        ${quote!.validUntil ? ` · Válida hasta: ${fmt(quote!.validUntil)}` : ''}
      </p>
      <table>
        <tr><th>Descripción</th><th>Tipo</th><th class="right">Cant.</th><th class="right">Precio</th><th class="right">Subtotal</th></tr>
        ${quote!.items.map((it) => `
          <tr>
            <td>${it.description}${it.notes ? `<br><small style="color:#999">${it.notes}</small>` : ''}</td>
            <td>${ITEM_TYPE_LABELS[it.itemType] ?? it.itemType}</td>
            <td class="right">${it.quantity}</td>
            <td class="right">${fmtMoney(it.unitPrice)}</td>
            <td class="right">${fmtMoney(it.subtotal)}</td>
          </tr>`).join('')}
      </table>
      <p class="total">Total: ${fmtMoney(quote!.total)}</p>
      ${quote!.notes ? `<p style="margin-top:1rem;color:#555">${quote!.notes}</p>` : ''}
      ${quote!.terms ? `<p style="color:#555">${quote!.terms}</p>` : ''}
      <div class="footer">Charly Tech Lab · Quepos, Costa Rica</div>
      </body></html>
    `)
    win.document.close()
    win.print()
  }

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">{quote.number}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${QUOTE_STATUS_COLORS[quote.status]}`}>
              {QUOTE_STATUS_LABELS[quote.status]}
            </span>
            {quote.customer && (
              <button onClick={() => navigate(`/clientes/${quote.customer!.id}`)}
                className="text-sm text-blue-700 hover:underline">
                {quote.customer.name}
              </button>
            )}
            {quote.workOrder && (
              <button onClick={() => navigate(`/ordenes/${quote.workOrder!.id}`)}
                className="text-sm text-gray-500 hover:underline">
                {quote.workOrder.number}
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">{fmt(quote.createdAt)}{quote.validUntil && ` · válida hasta ${fmt(quote.validUntil)}`}</p>
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap gap-2">
          {/* Exportar PDF */}
          <button onClick={handlePrint}
            className="text-sm px-3 py-1.5 border rounded-md hover:bg-gray-50">
            📄 Imprimir / PDF
          </button>

          {/* Enviar por WhatsApp */}
          {waUrl && (
            <a href={waUrl} target="_blank" rel="noopener noreferrer"
              className="text-sm px-3 py-1.5 border border-green-300 text-green-700 rounded-md hover:bg-green-50">
              💬 Enviar por WhatsApp
            </a>
          )}

          {/* Flujo de estados */}
          {quote.status === 'DRAFT' && (
            <button onClick={() => send.mutate(quote.id)}
              disabled={send.isPending}
              className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
              Marcar como enviada
            </button>
          )}
          {(quote.status === 'SENT' || quote.status === 'AWAITING_APPROVAL') && (
            <>
              <button
                onClick={async () => {
                  const by = prompt('¿Quién aprobó? (nombre o medio de confirmación)')
                  if (!by) return
                  await approve.mutateAsync({ id: quote.id, approvedBy: by })
                }}
                className="text-sm px-3 py-1.5 bg-teal-600 text-white rounded-md hover:bg-teal-700">
                ✓ Registrar aprobación
              </button>
              <button
                onClick={async () => {
                  const reason = prompt('Motivo del rechazo:')
                  if (!reason) return
                  await reject.mutateAsync({ id: quote.id, reason })
                }}
                className="text-sm px-3 py-1.5 border border-red-200 text-red-600 rounded-md hover:bg-red-50">
                ✗ Registrar rechazo
              </button>
            </>
          )}

          {quote.status === 'DRAFT' && (
            <button onClick={() => navigate(`/cotizaciones/${quote.id}/editar`)}
              className="text-sm px-3 py-1.5 border rounded-md hover:bg-gray-50">
              Editar
            </button>
          )}
        </div>
      </div>

      {/* Info de aprobacion/rechazo */}
      {quote.status === 'APPROVED' && quote.approvedBy && (
        <div className="rounded-md bg-teal-50 border border-teal-100 p-3 text-sm text-teal-800">
          ✓ Aprobada por <strong>{quote.approvedBy}</strong>
          {quote.approvedAt && <> el {fmt(quote.approvedAt)}</>}
        </div>
      )}
      {quote.status === 'REJECTED' && quote.rejectedReason && (
        <div className="rounded-md bg-red-50 border border-red-100 p-3 text-sm text-red-800">
          ✗ Rechazada: {quote.rejectedReason}
          {quote.rejectedAt && <span className="ml-1 text-xs">({fmt(quote.rejectedAt)})</span>}
        </div>
      )}

      {/* Tabla de items */}
      <div>
        <h3 className="font-semibold text-gray-800 mb-2">Ítems</h3>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Descripción</th>
                <th className="px-4 py-2 text-left font-medium">Tipo</th>
                <th className="px-4 py-2 text-right font-medium">Cant.</th>
                <th className="px-4 py-2 text-right font-medium">Precio unit.</th>
                <th className="px-4 py-2 text-right font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {quote.items.map((it) => (
                <tr key={it.id}>
                  <td className="px-4 py-2">
                    {it.description}
                    {it.notes && <p className="text-xs text-gray-400">{it.notes}</p>}
                  </td>
                  <td className="px-4 py-2 text-gray-500">{ITEM_TYPE_LABELS[it.itemType] ?? it.itemType}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{it.quantity}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmtMoney(it.unitPrice)}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">{fmtMoney(it.subtotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50">
                <td colSpan={4} className="px-4 py-2 text-right font-semibold text-gray-700">Total</td>
                <td className="px-4 py-2 text-right font-bold text-lg tabular-nums">{fmtMoney(quote.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Notas y terminos */}
      {(quote.notes || quote.terms) && (
        <div className="text-sm text-gray-600 space-y-1">
          {quote.notes && <p>{quote.notes}</p>}
          {quote.terms && <p className="text-gray-400 text-xs">{quote.terms}</p>}
        </div>
      )}

      {/* Pagos */}
      <PaymentPanel quoteId={quote.id} />
    </div>
  )
}
