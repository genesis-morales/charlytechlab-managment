import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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
  CircleOff,
} from 'lucide-react'
import { Navbar, Footer, WA_EQUIPO, WA_GENERAL, WaIcon } from '../web/Layout'
import { api } from '../lib/api'

// ---- Tipos del catálogo público ----
interface PublicProduct {
  id: string
  title: string
  description?: string | null
  askingPriceCRC: number
  status: 'AVAILABLE' | 'COMING_SOON' | 'RESERVED' | 'SOLD'
  displaySpecs?: Record<string, string> | null
  photos?: { url: string }[]
}

function fmtMoney(n: number | string) {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency', currency: 'CRC', maximumFractionDigits: 0,
  }).format(Number(n))
}

function usePublicProducts() {
  return useQuery<{ data: PublicProduct[] }>({
    queryKey: ['public-products'],
    queryFn: async () => (await api.get('/public/products')).data,
  })
}

// ---- Badge de estado ----
function StatusBadge({ status }: { status: PublicProduct['status'] }) {
  if (status === 'AVAILABLE') return (
    <span className="badge-available">
      <CheckCircle2 size={12} /> Disponible
    </span>
  )
  if (status === 'COMING_SOON') return (
    <span className="badge-coming">
      <CircleDot size={12} /> Próximamente
    </span>
  )
  if (status === 'RESERVED') return (
    <span className="badge-coming">
      <CircleDot size={12} /> Reservada
    </span>
  )
  return (
    <span className="badge-sold">
      <CircleOff size={12} /> Vendida
    </span>
  )
}

// ---- Tarjeta de producto ----
function ProductCard({ product }: { product: PublicProduct }) {
  const photo = product.photos?.[0]?.url
  const waMsg = encodeURIComponent(`Hola, vi esta laptop en la página de Charly Tech Lab y quisiera conocer más detalles: ${product.title}`)
  const waUrl = `https://wa.me/50670134952?text=${waMsg}`
  const isAvailable = product.status === 'AVAILABLE'

  return (
    <div className="product-card group">
      <div className="relative bg-gradient-to-br from-brand-50 to-brand-100 h-52 flex items-center justify-center overflow-hidden">
        {photo ? (
          <img src={photo} alt={product.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="flex flex-col items-center text-brand-300">
            <Laptop size={56} strokeWidth={1} />
            <span className="text-xs mt-2 text-brand-400">Sin foto</span>
          </div>
        )}
        <div className="absolute top-3 left-3">
          <StatusBadge status={product.status} />
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-2 line-clamp-2">{product.title}</h3>

        {product.displaySpecs && Object.keys(product.displaySpecs).length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {Object.entries(product.displaySpecs).slice(0, 4).map(([k, v]) => (
              <span key={k} className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{v}</span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-2">
          <span className="text-lg font-bold text-brand-700">{fmtMoney(product.askingPriceCRC)}</span>
          {isAvailable ? (
            <a href={waUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-white px-3 py-1.5 rounded-lg transition-colors"
              style={{ backgroundColor: '#7c3aed' }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#6d28d9')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#7c3aed')}>
              <WaIcon className="w-3.5 h-3.5" /> Consultar
            </a>
          ) : (
            <span className="text-xs text-gray-400">
              {product.status === 'COMING_SOON' ? 'Próximamente' : product.status === 'RESERVED' ? 'Reservada' : 'Vendida'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ======================================================
// SECCIONES
// ======================================================

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 text-white">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-brand-400/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <span className="inline-flex items-center gap-1.5 bg-brand-600/30 text-brand-200 text-xs font-semibold tracking-widest uppercase px-3 py-1.5 rounded-full mb-4">
            <MapPin size={12} /> Quepos · Costa Rica
          </span>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight mb-5">
            Tecnología clara,<br />
            <span className="text-brand-300">soluciones honestas.</span>
          </h1>
          <p className="text-brand-200 text-lg leading-relaxed mb-8 max-w-md">
            Laptops seleccionadas con criterio técnico. Te ayudamos a elegir el equipo que realmente necesitas, sin presión y con información transparente.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/equipos" className="btn-primary text-sm">
              Ver equipos disponibles <ArrowRight size={16} />
            </Link>
            <a href={WA_GENERAL} target="_blank" rel="noopener noreferrer" className="btn-whatsapp text-sm">
              <WaIcon /> Escribinos
            </a>
          </div>
        </div>

        {/* Decorativo */}
        <div className="hidden md:flex items-center justify-center">
          <div className="relative">
            <div className="w-72 h-72 bg-brand-600/20 rounded-full absolute -inset-8 blur-2xl" />
            <div className="relative z-10 bg-brand-800/50 backdrop-blur rounded-2xl p-8 border border-brand-600/30 shadow-2xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <div className="flex-1 bg-brand-700/50 rounded-full h-5 ml-2" />
              </div>
              <Laptop size={96} strokeWidth={0.8} className="mx-auto text-brand-300" />
              <div className="space-y-2 mt-4">
                <div className="h-2 bg-brand-600/40 rounded-full w-3/4" />
                <div className="h-2 bg-brand-600/30 rounded-full w-1/2" />
                <div className="h-2 bg-brand-600/20 rounded-full w-2/3" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Barra diferenciadores */}
      <div className="relative border-t border-brand-800/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { Icon: Search, label: 'Selección técnica', sub: 'Cada equipo revisado' },
            { Icon: MessageSquare, label: 'Atención honesta', sub: 'Sin presión comercial' },
            { Icon: MapPin, label: 'Base en Quepos', sub: 'Envíos a todo CR' },
            { Icon: ShieldCheck, label: 'Garantía incluida', sub: '6 meses en equipo propio' },
          ].map(({ Icon, label, sub }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-brand-700/50 flex items-center justify-center shrink-0">
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
  const { data, isLoading } = usePublicProducts()
  const products = data?.data ?? []
  const preview = products.filter((p) => p.status !== 'SOLD').slice(0, 6)

  return (
    <section id="equipos" className="py-20 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <span className="text-brand-600 text-sm font-semibold uppercase tracking-widest">Catálogo</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-2 mb-3">Equipos disponibles</h2>
          <p className="text-gray-500 max-w-lg mx-auto">
            Cada laptop está seleccionada y revisada. Todos los precios están en colones costarricenses.
          </p>
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
                <div className="h-52 bg-gray-200" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && preview.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Laptop size={56} strokeWidth={1} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium text-gray-600">Pronto habrá equipos disponibles</p>
            <p className="text-sm mt-1">Consultanos por WhatsApp para ver qué tenemos en este momento.</p>
            <a href={WA_EQUIPO} target="_blank" rel="noopener noreferrer" className="btn-whatsapp mt-6 text-sm inline-flex">
              <WaIcon /> Consultar disponibilidad
            </a>
          </div>
        )}

        {preview.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {preview.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
            {products.length > 6 && (
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
    { Icon: Home, label: 'Teletrabajo', desc: 'Potencia y batería suficiente para largas jornadas desde casa.' },
    { Icon: Code2, label: 'Programación', desc: 'Procesador y RAM para correr entornos de desarrollo con soltura.' },
    { Icon: Store, label: 'Pequeño negocio', desc: 'Administración, facturación y comunicación diaria sin complicaciones.' },
    { Icon: Globe, label: 'Uso general', desc: 'Navegar, ver contenido, redes sociales y comunicación cotidiana.' },
  ]

  return (
    <section className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <span className="text-brand-600 text-sm font-semibold uppercase tracking-widest">¿Qué necesitás?</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-2 mb-3">Hay un equipo para cada uso</h2>
          <p className="text-gray-500 max-w-lg mx-auto">
            No todos necesitan lo mismo. Cuando consultás, te recomendamos según tu uso real.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {cases.map(({ Icon, label, desc }) => (
            <div key={label} className="bg-brand-50 rounded-2xl p-5 hover:bg-brand-100 transition-colors group">
              <div className="w-10 h-10 rounded-xl bg-brand-100 group-hover:bg-brand-200 flex items-center justify-center mb-3 transition-colors">
                <Icon size={20} className="text-brand-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{label}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
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

function ServiciosSection() {
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
          <h2 className="text-3xl sm:text-4xl font-bold text-white mt-2 mb-3">Para sacarle más a tu equipo</h2>
          <p className="text-brand-200 max-w-lg mx-auto">
            Disponibles en Quepos y alrededores. Si tenés dudas sobre si podemos ayudarte, consultanos primero.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {servicios.map(({ Icon, title, desc }) => (
            <div key={title} className="bg-brand-800/40 backdrop-blur border border-brand-600/30 rounded-2xl p-5 hover:bg-brand-800/60 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-brand-700/50 flex items-center justify-center mb-3">
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

function NosotrosSection() {
  return (
    <section id="nosotros" className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <span className="text-brand-600 text-sm font-semibold uppercase tracking-widest">Sobre nosotros</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-2 mb-5">Un negocio construido con honestidad</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Charly Tech Lab nació en Quepos, Puntarenas, de una pasión por la tecnología y el deseo de ofrecer soluciones accesibles y honestas.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            Nuestra prioridad no es vender por vender. Queremos entender qué necesita cada persona y ofrecerle una alternativa que tenga sentido para su presupuesto y sus expectativas.
          </p>
          <p className="text-gray-600 leading-relaxed mb-6">
            Creemos que detrás de cada computadora hay alguien que necesita estudiar, trabajar, emprender o cumplir una meta.
          </p>
          <div className="flex flex-col gap-4">
            {[
              { Icon: Target, title: 'Honestidad', desc: 'Explicamos las características reales sin ocultar detalles.' },
              { Icon: Microscope, title: 'Criterio técnico', desc: 'Seleccionamos y recomendamos según necesidades reales.' },
              { Icon: HandshakeIcon, title: 'Cercanía', desc: 'Trato respetuoso y sin presión comercial.' },
            ].map(({ Icon, title, desc }) => (
              <div key={title} className="flex gap-3 items-start">
                <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon size={18} className="text-brand-600" />
                </div>
                <div>
                  <span className="font-semibold text-gray-900">{title}: </span>
                  <span className="text-gray-500 text-sm">{desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-brand-50 to-brand-100 rounded-3xl p-8">
          <blockquote className="text-xl font-semibold text-brand-900 leading-relaxed mb-6">
            "Queremos que nuestros clientes encuentren algo más que una computadora: un lugar al que puedan acudir cuando necesiten ayuda con su tecnología."
          </blockquote>
          <div className="border-t border-brand-200 pt-5 grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-brand-700">CR</p>
              <p className="text-xs text-brand-500">Costa Rica</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-brand-700">Quepos</p>
              <p className="text-xs text-brand-500">Sede principal</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function ContactoSection() {
  return (
    <section id="contacto" className="py-20 bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
        <span className="text-brand-600 text-sm font-semibold uppercase tracking-widest">Contacto</span>
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mt-2 mb-3">¿Listo para encontrar tu equipo?</h2>
        <p className="text-gray-500 mb-8">
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
        <div className="flex justify-center gap-6 text-sm text-gray-400">
          <a href="https://www.instagram.com/charly.techlab" target="_blank" rel="noopener noreferrer" className="hover:text-brand-600 transition-colors flex items-center gap-1">
            @charly.techlab
          </a>
          <span>·</span>
          <a href="https://www.facebook.com/share/1CLJKSdViA/" target="_blank" rel="noopener noreferrer" className="hover:text-brand-600 transition-colors">
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
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
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
  const { data, isLoading } = usePublicProducts()
  const [filter, setFilter] = useState<string>('all')
  const products = data?.data ?? []
  const filtered = filter === 'all' ? products : products.filter((p) => p.status === filter)

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 py-12 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Equipos disponibles</h1>
            <p className="text-gray-500">Laptops y computadoras seleccionadas con criterio técnico.</p>
          </div>
          <div className="flex flex-wrap gap-2 mb-8">
            {[
              { value: 'all', label: 'Todos' },
              { value: 'AVAILABLE', label: 'Disponibles' },
              { value: 'COMING_SOON', label: 'Próximamente' },
              { value: 'SOLD', label: 'Vendidos' },
            ].map(({ value, label }) => (
              <button key={value} onClick={() => setFilter(value)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  filter === value
                    ? 'text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-300'
                }`}
                style={filter === value ? { backgroundColor: '#7c3aed' } : undefined}>
                {label}
              </button>
            ))}
          </div>

          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
                  <div className="h-52 bg-gray-200" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="text-center py-20 text-gray-400">
              <Laptop size={48} strokeWidth={1} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg text-gray-600">No hay equipos en esta categoría por el momento.</p>
              <a href={WA_EQUIPO} target="_blank" rel="noopener noreferrer" className="btn-whatsapp mt-4 inline-flex text-sm">
                <WaIcon /> Consultar disponibilidad
              </a>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export function WebServiciosPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <ServiciosSection />
        <ContactoSection />
      </main>
      <Footer />
    </div>
  )
}

export function WebNosotrosPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <NosotrosSection />
        <ContactoSection />
      </main>
      <Footer />
    </div>
  )
}

export function WebContactoPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <ContactoSection />
      </main>
      <Footer />
    </div>
  )
}
