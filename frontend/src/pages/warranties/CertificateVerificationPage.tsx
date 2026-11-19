import { Link, useLocation } from 'react-router-dom'
import { certificateDate, CERTIFICATE_STATES, useVerifyCertificate } from '../../api/warranties'
import logo from '../../img/logo-1.webp'

export default function CertificateVerificationPage() {
  const token = useLocation().hash.slice(1)
  const valid = /^[A-Za-z0-9_-]{43}$/.test(token)
  const { data, isPending, isError, refetch } = useVerifyCertificate(token)
  return <main className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-10">
    <div className="max-w-xl mx-auto space-y-8">
      <Link to="/" className="inline-flex items-center gap-3"><img src={logo} alt="" width={48} height={48} className="object-contain" /><span className="font-semibold">Charly Tech Lab</span></Link>
      <div><h1 className="text-2xl font-bold">Verificación de constancia</h1><p className="text-zinc-400 text-sm mt-2">Quepos, Puntarenas, Costa Rica</p></div>
      {!valid && <p role="alert" className="border border-zinc-700 rounded-xl p-5">El enlace no es válido. Abrí el enlace completo que aparece en el certificado.</p>}
      {valid && isPending && <p role="status">Consultando el registro…</p>}
      {valid && isError && <div role="alert" className="border border-zinc-700 rounded-xl p-5 space-y-3"><p>No pudimos verificar la constancia. Revisá el enlace o consultanos.</p><button type="button" onClick={() => { void refetch() }} className="underline text-purple-300">Volver a intentar</button></div>}
      {data && <section className="border border-zinc-700 bg-zinc-900 rounded-xl p-6 space-y-5">
        <h2 className="text-lg font-semibold text-purple-300">{CERTIFICATE_STATES[data.state]}</h2>
        <dl className="space-y-4 text-sm">
          <div><dt className="text-zinc-400">Código</dt><dd className="font-mono break-all mt-1">{data.number}</dd></div>
          <div><dt className="text-zinc-400">Operación</dt><dd>{data.kind === 'sale' ? 'Venta de equipo' : 'Reparación'} · {data.equipment}</dd></div>
          <div><dt className="text-zinc-400">Emisión</dt><dd>{certificateDate(data.issuedAt)}</dd></div>
          <div><dt className="text-zinc-400">Cobertura registrada</dt><dd>{certificateDate(data.startsAt)} a {certificateDate(data.expiresAt)}</dd></div>
        </dl>
        {data.state === 'REVOKED' && <p className="text-sm text-zinc-300">La emisión de este documento está anulada. Consultá al negocio sobre su garantía.</p>}
      </section>}
      <a href="https://wa.me/50670134952?text=Hola%2C%20quisiera%20consultar%20sobre%20un%20certificado%20de%20garant%C3%ADa." target="_blank" rel="noopener noreferrer" className="inline-block rounded-lg bg-purple-700 text-white px-5 py-3 text-sm">Consultar por WhatsApp</a>
    </div>
  </main>
}
