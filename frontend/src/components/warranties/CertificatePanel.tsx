import { useState } from 'react'
import { useCustomers } from '../../api/customers'
import { certificateDate, useCertificate, useCertificateSource, useIssueCertificate, useRevokeCertificate, type CertificateKind, type CertificateSnapshot, type CertificateSource, type IssueCertificate } from '../../api/warranties'
import CertificateDocument from './CertificateDocument'

function errorMessage(error: unknown) {
  const message = (error as { response?: { data?: { error?: unknown } } })?.response?.data?.error
  return typeof message === 'string' ? message : 'No se pudo confirmar la operación. Consultá el historial antes de volver a intentar'
}

function CertificateCustomer({ onChange }: { onChange: (id: string, name: string) => void }) {
  const [search, setSearch] = useState('')
  const { data, isFetching, isError } = useCustomers({ q: search, active: 'true', limit: 20 })
  return <div className="space-y-2">
    <label className="block text-sm">Buscar cliente de la venta<input value={search} maxLength={200} onChange={event => setSearch(event.target.value)} className="block w-full border rounded p-2 mt-1" placeholder="Nombre o teléfono" /></label>
    <label className="block text-sm">Cliente *<select required defaultValue="" onChange={event => {
      const selected = data?.data.find(customer => customer.id === event.target.value)
      onChange(selected?.id ?? '', selected?.name ?? '')
    }} className="block w-full border rounded p-2 mt-1"><option value="">Seleccioná el cliente real</option>{data?.data.map(customer => <option key={customer.id} value={customer.id}>{customer.name} · {customer.phone}</option>)}</select></label>
    {isFetching && <p className="text-xs text-gray-500" role="status">Buscando clientes…</p>}
    {isError && <p className="text-sm text-red-600" role="alert">No se pudieron consultar los clientes. Intentá nuevamente.</p>}
  </div>
}

function CertificateWorkspace({ source }: { source: CertificateSource }) {
  const issue = useIssueCertificate(source.kind, source.id)
  const revoke = useRevokeCertificate(source.kind, source.id)
  const [customer, setCustomer] = useState(source.customer ?? { id: '', name: '' })
  const [form, setForm] = useState({ description: source.description, coverage: '', conditions: source.conditions, paymentReference: '', paymentId: '', serialNotApplicable: false })
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<CertificateSnapshot | null>(null)
  const [documentId, setDocumentId] = useState('')
  const [revokeId, setRevokeId] = useState('')
  const [reason, setReason] = useState('')
  const [showForm, setShowForm] = useState(source.certificates.length === 0)
  const document = useCertificate(documentId)
  const activeCertificate = source.certificates.find(certificate => !certificate.revokedAt)
  const busy = issue.isPending || revoke.isPending
  const currentCustomer = source.customer ?? customer

  const issueData = (): IssueCertificate => ({
    customerId: currentCustomer.id || undefined, description: form.description.trim(), coverage: form.coverage.trim(),
    conditions: form.conditions.trim(), serialNotApplicable: !source.device.serialNumber && form.serialNotApplicable,
    paymentReference: form.paymentReference.trim() || undefined, paymentId: form.paymentId || undefined, confirmed: true,
  })

  function preview(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (!source.startsAt || !source.expiresAt || !source.operation.date || !currentCustomer.id) { setError('Completá los datos reales de la operación'); return }
    if (!source.device.serialNumber && !form.serialNotApplicable) { setError('Registrá la serie del equipo o confirmá que no corresponde'); return }
    const payment = source.payments.find(payment => payment.id === form.paymentId)
    if (!payment && !form.paymentReference.trim()) { setError('Indicá la referencia del comprobante'); return }
    setDocumentId('')
    setDraft({
      schemaVersion: 1, issuer: source.issuer, number: '', version: (source.certificates[0]?.version ?? 0) + 1,
      issuedAt: new Date().toISOString(), kind: source.kind, customer: currentCustomer,
      operation: { reference: source.operation.reference, date: source.operation.date },
      device: { ...source.device, serialNotApplicable: !source.device.serialNumber, description: form.description.trim() },
      startsAt: source.startsAt, expiresAt: source.expiresAt, coverage: form.coverage.trim(), conditions: form.conditions.trim(),
      paymentReference: payment?.reference || payment?.id || form.paymentReference.trim(), paymentId: payment?.id ?? null,
    })
  }

  async function confirmIssue() {
    setError('')
    try {
      const certificate = await issue.mutateAsync(issueData())
      setDocumentId(certificate.id)
      setDraft(null)
      setShowForm(false)
    } catch (failure) { setError(errorMessage(failure)) }
  }

  async function confirmRevoke(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    try {
      await revoke.mutateAsync({ certificateId: revokeId, reason: reason.trim() })
      setRevokeId(''); setReason(''); setShowForm(true)
    } catch (failure) { setError(errorMessage(failure)) }
  }

  return <div className="space-y-4">
    <p className="text-sm text-gray-600">Emití una constancia con los datos de esta operación. Reimprimirla conserva sus fechas y condiciones originales.</p>
    {source.startsAt && source.expiresAt && <p className="text-sm">Cobertura registrada: <strong>{certificateDate(source.startsAt)}</strong> a <strong>{certificateDate(source.expiresAt)}</strong></p>}
    {!source.eligible && <p className="text-sm text-amber-800 bg-amber-50 p-3 rounded">{source.unavailableReason}</p>}
    {!source.warrantyActive && <p className="text-sm text-amber-800">La garantía está inactiva; podés consultar sus certificados anteriores.</p>}
    {source.certificates.length > 0 && <div className="overflow-x-auto"><table className="w-full text-sm text-left">
      <thead><tr className="border-b"><th className="p-2">Certificado</th><th className="p-2">Emisión</th><th className="p-2">Acciones</th></tr></thead>
      <tbody>{source.certificates.map(certificate => <tr key={certificate.id} className="border-b">
        <td className="p-2 break-words">{certificate.number}<span className="block text-xs text-gray-500">Versión {certificate.version} · {certificate.revokedAt ? 'Emisión anulada' : 'Emitido'}</span></td>
        <td className="p-2">{certificateDate(certificate.issuedAt)}</td>
        <td className="p-2"><div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => { setError(''); setDraft(null); setDocumentId(certificate.id) }} className="text-blue-700 underline py-1">Ver / Imprimir</button>
          {!certificate.revokedAt && <button type="button" disabled={busy} onClick={() => { setRevokeId(certificate.id); setError('') }} className="text-red-700 underline py-1">Anular emisión</button>}
        </div></td>
      </tr>)}</tbody>
    </table></div>}
    {revokeId && <form onSubmit={confirmRevoke} className="bg-amber-50 border rounded p-3 space-y-3">
      <p className="text-sm">Se conservará el documento y su historial. Esta acción anula su emisión; no cancela la garantía ni cambia pagos.</p>
      <label className="block text-sm">Motivo *<textarea value={reason} required minLength={5} maxLength={1000} onChange={event => setReason(event.target.value)} className="block w-full border rounded p-2 mt-1" /></label>
      <div className="flex gap-3"><button type="submit" disabled={busy} className="px-3 py-2 bg-red-700 text-white rounded disabled:opacity-50">Confirmar anulación</button><button type="button" disabled={busy} onClick={() => setRevokeId('')} className="border rounded px-3 py-2">Cancelar</button></div>
    </form>}
    {!activeCertificate && source.eligible && source.warrantyActive && !showForm && <button type="button" onClick={() => setShowForm(true)} className="border rounded px-3 py-2 text-sm">Preparar nueva emisión</button>}
    {!activeCertificate && source.eligible && source.warrantyActive && showForm && <form onSubmit={preview} className="space-y-4">
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <legend className="sr-only">Preparar certificado de garantía</legend>
        {source.customer ? <p className="text-sm">Cliente: <strong>{source.customer.name}</strong></p> : <CertificateCustomer onChange={(id, name) => setCustomer({ id, name })} />}
        <p className="text-sm">Equipo: <strong>{source.device.title}</strong>{source.device.serialNumber && <> · Serie: {source.device.serialNumber}</>}</p>
        {!source.device.serialNumber && <label className="flex items-start gap-2 text-sm"><input type="checkbox" required checked={form.serialNotApplicable} onChange={event => setForm({ ...form, serialNotApplicable: event.target.checked })} /> Confirmo que no corresponde registrar una serie en esta constancia. Si el equipo tiene serie, registrala en su ficha antes de emitir.</label>}
        <label className="block text-sm">Detalle del equipo o trabajo realizado *<textarea required minLength={3} maxLength={2000} rows={3} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} className="block w-full border rounded p-2 mt-1" /></label>
        <label className="block text-sm">Cobertura específica *<textarea required minLength={5} maxLength={3000} rows={3} value={form.coverage} onChange={event => setForm({ ...form, coverage: event.target.value })} className="block w-full border rounded p-2 mt-1" /></label>
        <label className="block text-sm">Condiciones aplicables *<textarea required minLength={5} maxLength={5000} rows={4} value={form.conditions} onChange={event => setForm({ ...form, conditions: event.target.value })} className="block w-full border rounded p-2 mt-1" /></label>
        <p className="text-xs text-gray-500">Completá el alcance y las condiciones revisadas para esta operación. No se agregan exclusiones generales automáticamente.</p>
        {source.payments.length > 0 && <label className="block text-sm">Pago de esta orden<select value={form.paymentId} onChange={event => setForm({ ...form, paymentId: event.target.value })} className="block w-full border rounded p-2 mt-1"><option value="">Indicar referencia manual</option>{source.payments.map(payment => <option key={payment.id} value={payment.id}>{payment.reference || payment.id} · {certificateDate(payment.paidAt)} · ₡{Number(payment.amount).toLocaleString('es-CR')}</option>)}</select></label>}
        {!form.paymentId && <label className="block text-sm">Referencia real del comprobante *<input required maxLength={500} value={form.paymentReference} onChange={event => setForm({ ...form, paymentReference: event.target.value })} className="block w-full border rounded p-2 mt-1" /></label>}
        <button type="submit" className="px-4 py-2 text-sm bg-purple-700 text-white rounded disabled:opacity-50">Revisar vista previa</button>
      </fieldset>
    </form>}
    {error && !draft && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {documentId && document.isPending && <p role="status" className="text-sm text-gray-500">Cargando certificado…</p>}
    {documentId && document.isError && <div role="alert" className="text-sm text-red-700">No se pudo consultar el certificado. <button type="button" onClick={() => { void document.refetch() }} className="underline">Reintentar</button></div>}
    {(draft || (documentId && document.data)) && <CertificateDocument
      snapshot={draft ?? document.data!.snapshot} certificate={draft ? undefined : document.data}
      onClose={() => { if (!busy) { setDraft(null); setDocumentId('') } }}
      onIssue={draft ? () => { void confirmIssue() } : undefined} issuing={issue.isPending} error={error}
    />}
  </div>
}

export default function CertificatePanel({ kind, sourceId }: { kind: CertificateKind; sourceId: string }) {
  const [open, setOpen] = useState(false)
  const { data, isPending, isError, error: sourceError, refetch } = useCertificateSource(kind, sourceId, open)
  return <section className="border rounded-lg p-4 space-y-3 min-w-0">
    <h3 className="font-semibold text-gray-800">Certificados de garantía</h3>
    <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="text-sm text-purple-800 underline py-1">{open ? 'Ocultar certificados' : 'Consultar / preparar certificado'}</button>
    {open && isPending && <p role="status" className="text-sm text-gray-500">Consultando la garantía…</p>}
    {open && isError && <div role="alert" className="text-sm text-red-700">{errorMessage(sourceError)} <button type="button" onClick={() => { void refetch() }} className="underline">Reintentar</button></div>}
    {open && data && <CertificateWorkspace key={`${kind}:${sourceId}`} source={data} />}
  </section>
}
