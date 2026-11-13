import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth.store'
import logoUrl from '../img/logo-1.webp'
import { useState } from 'react'
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  FileText,
  Package,
  DollarSign,
  Truck,
  Monitor,
  ShoppingCart,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/dashboard',      label: 'Dashboard',       icon: LayoutDashboard },
  { to: '/clientes',       label: 'Clientes',         icon: Users },
  { to: '/ordenes',        label: 'Órdenes de trabajo', icon: ClipboardList },
  { to: '/cotizaciones',   label: 'Cotizaciones',     icon: FileText },
  { to: '/inventario',     label: 'Inventario',       icon: Package },
  { to: '/productos',      label: 'Productos',        icon: Monitor },
  { to: '/proveedores',    label: 'Proveedores',      icon: ShoppingCart },
  { to: '/importaciones',  label: 'Importaciones',    icon: Truck },
  { to: '/financiero',     label: 'Financiero',       icon: DollarSign },
]

export default function AdminLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Overlay mobile */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed z-30 inset-y-0 left-0 w-64 bg-gray-900 text-white flex flex-col
          transform transition-transform duration-200 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0 md:flex`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-700 shrink-0">
          <img src={logoUrl} alt="Charly Tech Lab" className="h-8 w-auto brightness-0 invert" />
          <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <Icon size={18} className="shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User + logout */}
        <div className="shrink-0 border-t border-gray-700 p-4">
          <div className="text-xs text-gray-400 truncate mb-2">{user?.name}</div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors w-full"
          >
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="h-14 md:hidden flex items-center justify-between px-4 bg-white border-b border-gray-200 shrink-0">
          <button
            onClick={() => setOpen(true)}
            className="text-gray-600 hover:text-gray-900"
          >
            <Menu size={22} />
          </button>
          <span className="text-sm font-semibold text-gray-700">Charly Tech Lab</span>
          <ChevronRight size={16} className="text-transparent" />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
