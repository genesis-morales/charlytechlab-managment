import { Link, useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import {
  ArrowRight,
  Laptop,
  Search,
  MessageSquare,
  MapPin,
  ShieldCheck,
  GraduationCap,
  Briefcase,
  Home,
  Code2,
  Store,
  Globe,
  Zap,
  Wrench,
  MemoryStick,
  HardDrive,
  Monitor,
  KeyRound,
  Target,
  Microscope,
  HandshakeIcon,
  CheckCircle2,
  CircleDot,
  RefreshCw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Navbar, Footer, WA_EQUIPO, WA_GENERAL, WaIcon } from '../web/Layout'
import { usePublicProducts, type PublicProduct } from '../api/public'

function fmtMoney(n: number | string) {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency', currency: 'CRC', maximumFractionDigits: 0,
  }).format(Number(n))
}

// ---- Badge de estado ----
function StatusBadge({ status }: { status: PublicProduct['status'] }) {
  if (status === 'AVAILABLE') return (
    <span className="badge-available">
      <CheckCircle2 size={12} /> Disponible
    </span>
  )
  return (
    <span className="badge-coming">
      <CircleDot size={12} /> Próximamente
    </span>
  )
}

// ---- Tarjeta de producto ----
function ProductCard({ product }: { product: PublicProduct }) {
  const photo = product.photos?.[0]?.url
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null)
  const waMsg = encodeURIComponent(`Hola, quisiera consultar por este equipo de Charly Tech Lab: ${product.title}`)
  const waUrl = `https://wa.me/50670134952?text=${waMsg}`
  const isAvailable = product.status === 'AVAILABLE'

  return (
    <article className="product-card group">
      <div className="relative bg-zinc-900 h-52 flex items-center justify-center overflow-hidden">
        {photo && failedPhoto !== photo ? (
          <img src={photo} alt={product.title} loading="lazy" decoding="async" onError={() => setFailedPhoto(photo)} className="h-full w-full object-contain p-4" />
        ) : (
          <div className="flex flex-col items-center text-brand-300">
            <Laptop size={56} strokeWidth={1} />
            <span className="text-xs mt-2 text-zinc-400">Fotografía no disponible</span>
          </div>
        )}
        <div className="absolute top-3 left-3">
          <StatusBadge status={product.status} />
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-zinc-100 text-sm leading-snug mb-2 line-clamp-2">{product.title}</h3>

        {product.displaySpecs && Object.keys(product.displaySpecs).length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {Object.entries(product.displaySpecs).slice(0, 4).map(([k, v]) => (
              <span key={k} className="text-xs bg-zinc-800 text-zinc-300 rounded-full px-2 py-0.5">{v}</span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-3 items-center justify-between mt-2">
          <span className="text-lg font-bold text-brand-300">{fmtMoney(product.askingPriceCRC)}</span>
          {isAvailable ? (
            <a href={waUrl} target="_blank" rel="noopener noreferrer" aria-label={`Consultar por ${product.title} en WhatsApp`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 px-3 py-2 rounded-lg transition-colors">
              <WaIcon className="w-3.5 h-3.5" /> Consultar
            </a>
          ) : (
            <span className="text-xs text-zinc-400">
              Próximamente
            </span>
          )}
        </div>
      </div>
    </article>
  )
}

function CatalogError({ retry, retrying }: { retry: () => void; retrying: boolean }) {
  return (
    <div role="alert" className="rounded-2xl border border-zinc-700 bg-zinc-900 px-6 py-10 text-center">
      <AlertCircle size={28} className="mx-auto mb-3 text-brand-300" aria-hidden="true" />
      <p className="text-lg font-semibold text-zinc-100">No pudimos cargar los equipos</p>
      <p className="mt-2 text-sm text-zinc-400">Intentá de nuevo o consultanos por WhatsApp.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={retry} disabled={retrying} className="btn-outline text-sm">
          <RefreshCw size={16} aria-hidden="true" /> {retrying ? 'Consultando…' : 'Volver a intentar'}
        </button>
        <a href={WA_EQUIPO} target="_blank" rel="noopener noreferrer" className="btn-whatsapp text-sm"><WaIcon /> Consultar</a>
      </div>
    </div>
  )
}

function CatalogSkeleton() {
  return (
    <div role="status" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <span className="sr-only">Cargando equipos</span>
      {[1, 2, 3].map((n) => (
        <div key={n} aria-hidden="true" className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden motion-safe:animate-pulse">
          <div className="h-52 bg-zinc-800" />
          <div className="p-4 space-y-2">
            <div className="h-4 bg-zinc-800 rounded w-3/4" />
            <div className="h-3 bg-zinc-800 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ======================================================
// SECCIONES
// ======================================================

function HeroSection() {
  const { data } = usePublicProducts({ limit: 6 })
  const featured = data?.data.find((product) => product.status === 'AVAILABLE' && product.photos?.[0]?.url)
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null)
  const photo = featured?.photos[0]?.url
  return (
    <section className="bg-zinc-950 text-white">
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <span className="inline-flex items-center gap-1.5 bg-brand-600/15 text-brand-200 text-xs font-semibold tracking-widest uppercase px-3 py-1.5 rounded-full mb-4">
            <MapPin size={12} /> Quepos · Costa Rica
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight tracking-tight mb-5">
            Computadoras<br />
            <span className="text-brand-300">reacondicionadas.</span>
          </h1>
          <p className="text-brand-200 text-lg leading-relaxed mb-8 max-w-md">
            Laptops y computadoras revisadas, con sus especificaciones y precio a la vista. También ofrecemos mantenimiento, reparación y mejoras de equipos en Quepos.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/equipos" className="btn-primary text-sm">
              Ver catálogo de equipos <ArrowRight size={16} />
            </Link>
            <a href={WA_GENERAL} target="_blank" rel="noopener noreferrer" className="btn-whatsapp text-sm">
              <WaIcon /> Escribinos
            </a>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          {featured && photo && failedPhoto !== photo ? (
            <>
              <img src={photo} alt={featured.title} onError={() => setFailedPhoto(photo)} className="w-full h-64 sm:h-80 object-contain p-6" />
              <div className="border-t border-zinc-800 p-6">
                <StatusBadge status={featured.status} />
                <p className="text-lg font-semibold mt-3">{featured.title}</p>
                <div className="mt-4 flex flex-wrap justify-between items-center gap-3">
                  <span className="text-xl font-bold text-brand-300">{fmtMoney(featured.askingPriceCRC)}</span>
                  <Link to="/equipos" className="inline-flex items-center gap-2 text-sm text-brand-300 hover:text-white">Ver catálogo <ArrowRight size={16} /></Link>
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 sm:p-10">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-300">Charly Tech Lab · Quepos</p>
              <h2 className="text-2xl font-semibold mt-6 mb-6">Equipos y servicio técnico</h2>
              <div className="space-y-6 text-sm text-zinc-300">
                <p className="border-t border-zinc-700 pt-5"><strong className="block text-white mb-2">Para tu próxima computadora</strong>Consultá disponibilidad, especificaciones y precio en nuestro catálogo.</p>
                <p className="border-t border-zinc-700 pt-5"><strong className="block text-white mb-2">Para el equipo que ya tenés</strong>Mantenimiento, diagnóstico y ampliaciones según su compatibilidad.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Barra diferenciadores */}
      <div className="relative border-t border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { Icon: Search, label: 'Selección técnica', sub: 'Cada equipo revisado' },
            { Icon: MessageSquare, label: 'Atención honesta', sub: 'Sin presión comercial' },
            { Icon: MapPin, label: 'Base en Quepos', sub: 'Consultá opciones de envío' },
            { Icon: ShieldCheck, label: 'Garantías', sub: 'Consultá cobertura por equipo' },
          ].map(({ Icon, label, sub }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                <Icon size={16} className="text-brand-200" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{label}</p>
                <p className="text-xs text-brand-300">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CatalogPreview() {
  const { data, isPending, isError, isFetching, refetch } = usePublicProducts({ limit: 6 })
  const preview = data?.data ?? []

  return (
    <section id="equipos" className="py-20 bg-zinc-950">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <span className="text-brand-300 text-sm font-semibold uppercase tracking-widest">Catálogo</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-zinc-100 mt-2 mb-3">Nuestro catálogo</h2>
          <p className="text-zinc-400 max-w-lg mx-auto">
            Consultá las características y el estado de cada equipo. Los precios están en colones costarricenses.
          </p>
        </div>

        {isPending && <CatalogSkeleton />}
        {isError && <CatalogError retry={() => { void refetch() }} retrying={isFetching} />}

        {!isPending && !isError && preview.length === 0 && (
          <div className="text-center py-16 text-zinc-400">
            <Laptop size={56} strokeWidth={1} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium text-zinc-300">No hay equipos publicados por el momento</p>
            <p className="text-sm mt-1">Podés consultar disponibilidad por WhatsApp.</p>
            <a href={WA_EQUIPO} target="_blank" rel="noopener noreferrer" className="btn-whatsapp mt-6 text-sm inline-flex">
              <WaIcon /> Consultar disponibilidad
            </a>
          </div>
        )}

        {!isPending && !isError && preview.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {preview.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
            {(data?.meta.total ?? 0) > 6 && (
              <div className="text-center mt-10">
                <Link to="/equipos" className="btn-outline">
                  Ver todos los equipos <ArrowRight size={16} />
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

function UsoCasesSection() {
  const cases = [
    { Icon: GraduationCap, label: 'Estudios', desc: 'Equipo con buena fluidez para tareas, presentaciones y videoconferencias.' },
    { Icon: Briefcase, label: 'Trabajo de oficina', desc: 'Ideal para hojas de cálculo, correos, documentos y reuniones virtuales.' },
    { Icon: Home, label: 'Teletrabajo', desc: 'Consultá por un equipo compatible con las aplicaciones que usás desde casa.' },
    { Icon: Code2, label: 'Programación', desc: 'Revisamos procesador y memoria según tus herramientas de desarrollo.' },
    { Icon: Store, label: 'Pequeño negocio', desc: 'Administración, facturación y comunicación diaria sin complicaciones.' },
    { Icon: Globe, label: 'Uso general', desc: 'Navegar, ver contenido, redes sociales y comunicación cotidiana.' },
  ]

  return (
    <section className="py-20 bg-zinc-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <span className="text-brand-300 text-sm font-semibold uppercase tracking-widest">¿Qué necesitás?</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-zinc-100 mt-2 mb-3">Hay un equipo para cada uso</h2>
          <p className="text-zinc-400 max-w-lg mx-auto">
            No todos necesitan lo mismo. Cuando consultás, te recomendamos según tu uso real.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {cases.map(({ Icon, label, desc }) => (
            <div key={label} className="bg-zinc-900 rounded-2xl p-5 hover:bg-zinc-800 transition-colors group">
              <div className="w-10 h-10 rounded-xl bg-zinc-800 group-hover:bg-zinc-700 flex items-center justify-center mb-3 transition-colors">
                <Icon size={20} className="text-brand-300" />
              </div>
              <h3 className="font-semibold text-zinc-100 mb-1">{label}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-10">
          <a href={WA_EQUIPO} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm">
            <WaIcon /> Asesoría sin compromiso por WhatsApp
          </a>
        </div>
      </div>
    </section>
  )
}

function ServiciosSection({ standalone = false }: { standalone?: boolean }) {
  const Heading = standalone ? 'h1' : 'h2'
  const servicios = [
    { Icon: Zap, title: 'Optimización de equipo', desc: 'Ajustes de software para que tu computadora responda mejor y aproveche bien sus recursos.' },
    { Icon: Wrench, title: 'Mantenimiento preventivo', desc: 'Limpieza interna y cuidado de componentes para conservar el equipo en buenas condiciones.' },
    { Icon: MemoryStick, title: 'Cambio o ampliación de RAM', desc: 'Más memoria para trabajar con más aplicaciones al mismo tiempo, si el modelo lo permite.' },
    { Icon: HardDrive, title: 'Instalación de SSD', desc: 'Almacenamiento más rápido para arranques y respuesta general del sistema notablemente mejores.' },
    { Icon: Monitor, title: 'Instalación de Windows', desc: 'Instalación de Windows 10 u 11, compatible con las características de tu equipo.' },
    { Icon: KeyRound, title: 'Activación de Windows', desc: 'Activación del sistema operativo con licencia válida.' },
  ]

  return (
    <section id="servicios" className="py-20 section-purple">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <span className="text-brand-200 text-sm font-semibold uppercase tracking-widest">Servicios técnicos</span>
          <Heading className="text-3xl sm:text-4xl font-bold text-white mt-2 mb-3">Servicio técnico en Quepos</Heading>
          <p className="text-brand-200 max-w-lg mx-auto">
            Disponibles en Quepos y alrededores. Si tenés dudas sobre si podemos ayudarte, consultanos primero.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {servicios.map(({ Icon, title, desc }) => (
            <div key={title} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-600 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center mb-3">
                <Icon size={20} className="text-brand-200" />
              </div>
              <h3 className="font-semibold text-white mb-2">{title}</h3>
              <p className="text-sm text-brand-200 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-10">
          <p className="text-brand-200 text-sm mb-4">¿Necesitás algo que no está en la lista? Consultanos, valoramos tu caso.</p>
          <a href={`https://wa.me/50670134952?text=${encodeURIComponent('Hola, quisiera consultar por un servicio técnico para mi computadora.')}`}
            target="_blank" rel="noopener noreferrer" className="btn-whatsapp">
            <WaIcon /> Consultar por servicio
          </a>
        </div>
      </div>
    </section>
  )
}

function NosotrosSection({ standalone = false }: { standalone?: boolean }) {
  const Heading = standalone ? 'h1' : 'h2'
  return (
    <section id="nosotros" className="py-20 bg-zinc-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <span className="text-brand-300 text-sm font-semibold uppercase tracking-widest">Sobre nosotros</span>
          <Heading className="text-3xl sm:text-4xl font-bold text-zinc-100 mt-2 mb-5">Charly Tech Lab</Heading>
          <p className="text-zinc-300 leading-relaxed mb-4">
            Charly Tech Lab nació en Quepos, Puntarenas, de una pasión por la tecnología y el deseo de ofrecer soluciones accesibles y honestas.
          </p>
          <p className="text-zinc-300 leading-relaxed mb-4">
            Nuestra prioridad no es vender por vender. Queremos entender qué necesita cada persona y ofrecerle una alternativa que tenga sentido para su presupuesto y sus expectativas.
          </p>
          <p className="text-zinc-300 leading-relaxed mb-6">
            Creemos que detrás de cada computadora hay alguien que necesita estudiar, trabajar, emprender o cumplir una meta.
          </p>
          <div className="flex flex-col gap-4">
            {[
              { Icon: Target, title: 'Honestidad', desc: 'Explicamos las características reales sin ocultar detalles.' },
              { Icon: Microscope, title: 'Criterio técnico', desc: 'Seleccionamos y recomendamos según necesidades reales.' },
              { Icon: HandshakeIcon, title: 'Cercanía', desc: 'Trato respetuoso y sin presión comercial.' },
            ].map(({ Icon, title, desc }) => (
              <div key={title} className="flex gap-3 items-start">
                <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon size={18} className="text-brand-300" />
                </div>
                <div>
                  <span className="font-semibold text-zinc-100">{title}: </span>
                  <span className="text-zinc-400 text-sm">{desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
          <blockquote className="text-xl font-semibold text-zinc-100 leading-relaxed mb-6">
            "Queremos que nuestros clientes encuentren algo más que una computadora: un lugar al que puedan acudir cuando necesiten ayuda con su tecnología."
          </blockquote>
          <div className="border-t border-zinc-700 pt-5 grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-brand-300">CR</p>
              <p className="text-xs text-brand-300">Costa Rica</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-brand-300">Quepos</p>
              <p className="text-xs text-brand-300">Sede principal</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function ContactoSection({ standalone = false }: { standalone?: boolean }) {
  const Heading = standalone ? 'h1' : 'h2'
  return (
    <section id="contacto" className="py-20 bg-zinc-950">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
        <span className="text-brand-300 text-sm font-semibold uppercase tracking-widest">Contacto</span>
        <Heading className="text-3xl sm:text-4xl font-bold text-zinc-100 mt-2 mb-3">Hablemos de tu equipo</Heading>
        <p className="text-zinc-400 mb-8">
          WhatsApp es nuestro canal principal. Respondemos con honestidad y sin presión.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
          <a href={WA_EQUIPO} target="_blank" rel="noopener noreferrer" className="btn-whatsapp text-sm">
            <WaIcon /> Consultar sobre un equipo
          </a>
          <a href={`https://wa.me/50670134952?text=${encodeURIComponent('Hola, quisiera consultar por un servicio técnico para mi computadora.')}`}
            target="_blank" rel="noopener noreferrer" className="btn-outline text-sm">
            Consultar sobre un servicio
          </a>
        </div>
        <div className="flex justify-center gap-6 text-sm text-zinc-400">
          <a href="https://www.instagram.com/charly.techlab" target="_blank" rel="noopener noreferrer" className="hover:text-brand-300 transition-colors flex items-center gap-1">
            @charly.techlab
          </a>
          <span>·</span>
          <a href="https://www.facebook.com/share/1CLJKSdViA/" target="_blank" rel="noopener noreferrer" className="hover:text-brand-300 transition-colors">
            Facebook
          </a>
        </div>
      </div>
    </section>
  )
}

// ======================================================
// PÁGINAS EXPORTADAS
// ======================================================

export function WebHomePage() {
  return (
    <div className="public-site min-h-screen flex flex-col bg-zinc-950 text-zinc-100">
      <Navbar />
      <main id="contenido-publico" tabIndex={-1} className="flex-1">
        <HeroSection />
        <CatalogPreview />
        <UsoCasesSection />
        <ServiciosSection />
        <NosotrosSection />
        <ContactoSection />
      </main>
      <Footer />
    </div>
  )
}

export function WebEquiposPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = [
    { value: 'todos', label: 'Todos', status: undefined },
    { value: 'disponibles', label: 'Disponibles', status: 'AVAILABLE' },
    { value: 'proximamente', label: 'Próximamente', status: 'COMING_SOON' },
  ] as const
  const filter = filters.find(({ value }) => value === searchParams.get('estado')) ?? filters[0]
  const requestedPage = Number(searchParams.get('pagina') ?? 1)
  const page = Number.isInteger(requestedPage) && requestedPage > 0 && requestedPage <= 1_000_000 ? requestedPage : 1
  const { data, isPending, isError, isFetching, refetch } = usePublicProducts({ page, status: filter.status })
  const products = data?.data ?? []
  const changePage = (nextPage: number, nextFilter: string = filter.value) => {
    const next = new URLSearchParams(searchParams)
    if (nextFilter === 'todos') next.delete('estado')
    else next.set('estado', nextFilter)
    if (nextPage === 1) next.delete('pagina')
    else next.set('pagina', String(nextPage))
    setSearchParams(next, { preventScrollReset: true })
  }

  return (
    <div className="public-site min-h-screen flex flex-col bg-zinc-950 text-zinc-100">
      <Navbar />
      <main id="contenido-publico" tabIndex={-1} className="flex-1 py-12 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-zinc-100 mb-2">Catálogo de equipos</h1>
            <p className="text-zinc-400">Laptops y computadoras seleccionadas con criterio técnico.</p>
          </div>
          <div className="flex flex-wrap gap-2 mb-8">
            {filters.map(({ value, label }) => (
              <button key={value} type="button" onClick={() => changePage(1, value)} aria-pressed={filter.value === value}
                className={`min-h-11 px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                  filter.value === value
                    ? 'bg-brand-600 border-brand-600 text-white'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-brand-400'
                }`}>
                {label}
              </button>
            ))}
          </div>

          {isPending && <CatalogSkeleton />}
          {isError && <CatalogError retry={() => { void refetch() }} retrying={isFetching} />}

          {!isPending && !isError && products.length === 0 && (
            <div className="text-center py-20 text-zinc-400">
              <Laptop size={48} strokeWidth={1} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg text-zinc-300">{page > 1 ? 'No hay equipos en esta página.' : 'No hay equipos en esta categoría por el momento.'}</p>
              {page > 1 && <button type="button" onClick={() => changePage(1)} className="btn-outline mt-4 mx-auto">Ir a la primera página</button>}
              <a href={WA_EQUIPO} target="_blank" rel="noopener noreferrer" className="btn-whatsapp mt-4 inline-flex text-sm">
                <WaIcon /> Consultar disponibilidad
              </a>
            </div>
          )}

          {!isPending && !isError && products.length > 0 && data && (
            <>
              <p role="status" className="text-sm text-zinc-400 mb-5">
                {data.meta.total} {data.meta.total === 1 ? 'equipo' : 'equipos'} · Página {page} de {data.meta.pages}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" aria-busy={isFetching}>
                {products.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
            </>
          )}
          {!isPending && !isError && data && data.meta.total > 0 && (data.meta.pages > 1 || page > 1) && (
            <nav aria-label="Páginas del catálogo" className="flex flex-wrap items-center justify-between gap-4 border-t border-zinc-800 mt-10 pt-6">
              <button type="button" onClick={() => changePage(Math.max(1, page - 1))} disabled={page <= 1 || isFetching} className="btn-outline text-sm">
                <ChevronLeft size={16} aria-hidden="true" /> Anterior
              </button>
              <button type="button" onClick={() => changePage(page + 1)} disabled={page >= data.meta.pages || isFetching} className="btn-outline text-sm">
                Siguiente <ChevronRight size={16} aria-hidden="true" />
              </button>
            </nav>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}

export function WebServiciosPage() {
  return (
    <div className="public-site min-h-screen flex flex-col bg-zinc-950 text-zinc-100">
      <Navbar />
      <main id="contenido-publico" tabIndex={-1} className="flex-1">
        <ServiciosSection standalone />
        <ContactoSection />
      </main>
      <Footer />
    </div>
  )
}

export function WebNosotrosPage() {
  return (
    <div className="public-site min-h-screen flex flex-col bg-zinc-950 text-zinc-100">
      <Navbar />
      <main id="contenido-publico" tabIndex={-1} className="flex-1">
        <NosotrosSection standalone />
        <ContactoSection />
      </main>
      <Footer />
    </div>
  )
}

export function WebContactoPage() {
  return (
    <div className="public-site min-h-screen flex flex-col bg-zinc-950 text-zinc-100">
      <Navbar />
      <main id="contenido-publico" tabIndex={-1} className="flex-1">
        <ContactoSection standalone />
      </main>
      <Footer />
    </div>
  )
}
