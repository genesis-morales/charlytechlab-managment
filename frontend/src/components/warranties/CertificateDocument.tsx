import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import logo from '../../img/logo-1.webp'
import { CERTIFICATE_STATES, certificateDate, type CertificateSnapshot, type WarrantyCertificate } from '../../api/warranties'
import './certificate.css'

interface Props {
  snapshot: CertificateSnapshot
  certificate?: WarrantyCertificate
  onClose: () => void
  onIssue?: () => void
  issuing?: boolean
  error?: string
}

export default function CertificateDocument({ snapshot, certificate, onClose, onIssue, issuing, error }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const [logoReady, setLogoReady] = useState(false)
  const [logoError, setLogoError] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const draft = !certificate
  const verificationUrl = certificate ? window.location.origin + certificate.verificationPath : ''
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousTitle = document.title
    document.title = certificate?.number ?? 'Vista previa del certificado'
    document.body.classList.add('certificate-document-open')
    container.current?.focus()
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !issuing) onClose()
      if (event.key === 'Tab') {
        const elements = container.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled)')
        if (!elements?.length) return
        const first = elements[0], last = elements[elements.length - 1]
        if (event.shiftKey && (document.activeElement === first || document.activeElement === container.current)) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === container.current)) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', keyboard)
    return () => {
      document.removeEventListener('keydown', keyboard)
      document.body.classList.remove('certificate-document-open')
      document.title = previousTitle
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [certificate?.number, issuing, onClose])

  return createPortal(
    <div ref={container} className="certificate-dialog-layer" role="dialog" aria-modal="true" aria-label={draft ? 'Vista previa del certificado sin emitir' : 'Certificado de garantía'} tabIndex={-1}>
      <div className="certificate-toolbar">
        <div className="flex flex-wrap gap-3 items-center">
          <button type="button" disabled={!logoReady || issuing} onClick={() => window.print()} className="px-4 py-2 rounded bg-purple-700 text-white disabled:opacity-50">Imprimir / Guardar como PDF</button>
          <button type="button" disabled={issuing} onClick={onClose} className="px-4 py-2 rounded border bg-white text-gray-800">Cerrar</button>
          {certificate && <span className="text-sm">{CERTIFICATE_STATES[certificate.state]}</span>}
        </div>
        {draft && onIssue && <div className="mt-3 flex flex-wrap gap-3 items-center">
          <label className="text-sm flex items-start gap-2"><input type="checkbox" checked={confirmed} disabled={issuing} onChange={event => setConfirmed(event.target.checked)} /> Revisé los datos y las condiciones de esta operación.</label>
          <button type="button" disabled={!confirmed || issuing || !logoReady} onClick={onIssue} className="px-4 py-2 rounded bg-green-700 text-white disabled:opacity-50">{issuing ? 'Emitiendo…' : 'Confirmar emisión'}</button>
        </div>}
        {logoError && <p role="alert" className="mt-2 text-red-700">No se pudo cargar el logo. Cerrá la vista e intentá nuevamente.</p>}
        {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
      </div>
      <article className="certificate-sheet">
        {draft && <p className="certificate-draft">VISTA PREVIA · DOCUMENTO SIN EMITIR · NO VÁLIDO</p>}
        {certificate?.revokedAt && <p className="certificate-draft">EMISIÓN ANULADA · {certificateDate(certificate.revokedAt)}</p>}
        <header className="certificate-masthead">
          <div className="certificate-brand-lockup">
            <img src={logo} alt="Logo de Charly Tech Lab" width="66" height="66" onLoad={() => setLogoReady(true)} onError={() => setLogoError(true)} />
            <div><p className="certificate-brand">{snapshot.issuer.name}</p><p className="certificate-contact">{snapshot.issuer.location}<br />WhatsApp {snapshot.issuer.phone} · {snapshot.issuer.instagram}</p></div>
          </div>
          <div className="certificate-issuer">Constancia comercial<br />emitida por el negocio</div>
        </header>
        <div className="certificate-title">
          <div><p className="certificate-eyebrow">Registro de cobertura</p><h1>Certificado de garantía</h1></div>
          <div className="certificate-code">{draft ? 'Código asignado al emitir' : snapshot.number}<br />{draft ? 'Emisión pendiente' : `Emisión: ${certificateDate(snapshot.issuedAt)} · Versión ${snapshot.version}`}</div>
        </div>
        <section><h2>01 · Cliente y operación</h2><div className="certificate-grid">
          <div className="certificate-full"><span className="certificate-label">Cliente</span><p>{snapshot.customer.name}</p></div>
          <div><span className="certificate-label">Tipo de operación</span><p>{snapshot.kind === 'sale' ? 'Venta de equipo' : 'Reparación'}</p></div>
          <div><span className="certificate-label">Referencia de la operación</span><p>{snapshot.operation.reference}</p></div>
          <div><span className="certificate-label">Fecha de venta o entrega</span><p>{certificateDate(snapshot.operation.date)}</p></div>
          <div><span className="certificate-label">Referencia del comprobante</span><p>{snapshot.paymentReference}</p></div>
        </div></section>
        <section><h2>02 · Equipo o servicio cubierto</h2><div className="certificate-grid">
          <div><span className="certificate-label">Equipo</span><p>{snapshot.device.title}</p></div>
          <div><span className="certificate-label">Número de serie</span><p>{snapshot.device.serialNumber ?? 'No aplica (confirmado al emitir)'}</p></div>
          <div className="certificate-full"><span className="certificate-label">Detalle del equipo o trabajo realizado</span><p className="certificate-prose">{snapshot.device.description}</p></div>
        </div></section>
        <section className="certificate-dates"><div><span className="certificate-label">Inicio de cobertura</span><strong>{certificateDate(snapshot.startsAt)}</strong></div><div><span className="certificate-label">Vencimiento</span><strong>{certificateDate(snapshot.expiresAt)}</strong></div></section>
        <section><h2>03 · Cobertura específica</h2><p className="certificate-prose">{snapshot.coverage}</p></section>
        <section><h2>04 · Condiciones aplicables</h2><p className="certificate-prose">{snapshot.conditions}</p></section>
        <section className="certificate-verify"><div><strong>Consulta de la constancia</strong>{certificate ? <p><a href={verificationUrl} target="_blank" rel="noopener noreferrer">{verificationUrl}</a></p> : <p>El enlace de verificación se asignará al emitir.</p>}</div><div><strong>Contacto del negocio</strong><p>WhatsApp {snapshot.issuer.phone}</p></div></section>
        <footer><p>Conservá el certificado y el comprobante de la operación.</p>{draft && <p>Esta vista previa no acredita una garantía emitida.</p>}</footer>
      </article>
    </div>, document.body,
  )
}
