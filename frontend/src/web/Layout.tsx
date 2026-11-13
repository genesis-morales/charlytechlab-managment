import { Link } from 'react-router-dom'
import logoUrl from '../img/logo-1.webp'
import { MessageCircle, MapPin, Menu, X } from 'lucide-react'
import { useState } from 'react'

// Instagram y Facebook no están en lucide-react — SVGs inline
function IgIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  )
}

function FbIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  )
}

const WA_BASE = 'https://wa.me/50670134952'

function waLink(msg: string) {
  return `${WA_BASE}?text=${encodeURIComponent(msg)}`
}

export const WA_EQUIPO = waLink('Hola, vi esta laptop en la página de Charly Tech Lab y quisiera conocer más detalles.')
export const WA_SERVICIO = waLink('Hola, quisiera consultar por un servicio técnico para mi computadora.')
export const WA_GENERAL = waLink('Hola, quisiera obtener más información sobre Charly Tech Lab.')

// ---- WhatsApp SVG (no está en Lucide) ----
export function WaIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`fill-current ${className}`} xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}

// ---- Navbar ----
export function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoUrl} alt="Charly Tech Lab" className="h-9 w-auto" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-700">
          <Link to="/" className="hover:text-brand-600 transition-colors">Inicio</Link>
          <Link to="/equipos" className="hover:text-brand-600 transition-colors">Equipos</Link>
          <Link to="/servicios" className="hover:text-brand-600 transition-colors">Servicios</Link>
          <Link to="/nosotros" className="hover:text-brand-600 transition-colors">Nosotros</Link>
          <Link to="/contacto" className="hover:text-brand-600 transition-colors">Contacto</Link>
        </nav>

        <div className="flex items-center gap-2">
          <a href={WA_GENERAL} target="_blank" rel="noopener noreferrer"
            className="btn-primary py-2 px-4 text-sm hidden sm:inline-flex">
            <WaIcon /> Consultar
          </a>
          {/* Mobile menu button */}
          <button className="md:hidden p-2 rounded-lg text-gray-600 hover:text-brand-600" onClick={() => setOpen(!open)}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-3 text-sm font-medium text-gray-700">
          {[['/', 'Inicio'], ['/equipos', 'Equipos'], ['/servicios', 'Servicios'], ['/nosotros', 'Nosotros'], ['/contacto', 'Contacto']].map(([to, label]) => (
            <Link key={to} to={to} onClick={() => setOpen(false)} className="block py-2 hover:text-brand-600">{label}</Link>
          ))}
          <a href={WA_GENERAL} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}
            className="btn-primary w-full justify-center mt-2">
            <WaIcon /> Consultar por WhatsApp
          </a>
        </div>
      )}
    </header>
  )
}

// ---- Footer ----
export function Footer() {
  return (
    <footer className="bg-brand-950 text-white pt-12 pb-6">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-4 gap-8 pb-8 border-b border-brand-800">
        <div className="md:col-span-2">
          <img src={logoUrl} alt="Charly Tech Lab" className="h-10 w-auto mb-3 brightness-0 invert" />
          <p className="text-brand-300 text-sm leading-relaxed max-w-xs">
            Tecnología clara, soluciones honestas. Laptops seleccionadas y servicios técnicos en Quepos, Costa Rica.
          </p>
          <div className="flex gap-3 mt-4">
            <a href="https://www.instagram.com/charly.techlab" target="_blank" rel="noopener noreferrer"
              className="w-9 h-9 rounded-full bg-brand-800 hover:bg-brand-600 flex items-center justify-center transition-colors">
              <IgIcon size={16} />
            </a>
            <a href="https://www.facebook.com/share/1CLJKSdViA/" target="_blank" rel="noopener noreferrer"
              className="w-9 h-9 rounded-full bg-brand-800 hover:bg-brand-600 flex items-center justify-center transition-colors">
              <FbIcon size={16} />
            </a>
            <a href={WA_GENERAL} target="_blank" rel="noopener noreferrer"
              className="w-9 h-9 rounded-full bg-brand-800 hover:bg-green-600 flex items-center justify-center transition-colors">
              <WaIcon />
            </a>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-white mb-3">Navegación</h4>
          <ul className="space-y-2 text-sm text-brand-300">
            {[['/', 'Inicio'], ['/equipos', 'Equipos'], ['/servicios', 'Servicios'], ['/nosotros', 'Nosotros'], ['/contacto', 'Contacto']].map(([to, label]) => (
              <li key={to}><Link to={to} className="hover:text-white transition-colors">{label}</Link></li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-white mb-3">Contacto</h4>
          <ul className="space-y-2 text-sm text-brand-300">
            <li className="flex items-center gap-2">
              <MapPin size={14} className="shrink-0" /> Quepos, Puntarenas, CR
            </li>
            <li>
              <a href={WA_GENERAL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-white transition-colors">
                <MessageCircle size={14} className="shrink-0" /> 7013-4952
              </a>
            </li>
            <li>
              <a href="https://www.instagram.com/charly.techlab" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-white transition-colors">
                <IgIcon size={14} /> @charly.techlab
              </a>
            </li>
            <li>
              <a href="https://www.facebook.com/share/1CLJKSdViA/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-white transition-colors">
                <FbIcon size={14} /> Charly Tech Lab
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-brand-400">
        <span>© {new Date().getFullYear()} Charly Tech Lab. Todos los derechos reservados.</span>
        <span>Quepos, Costa Rica</span>
      </div>
    </footer>
  )
}

export { MessageCircle, MapPin }
