import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth.store'

// CRM (privado)
import AdminLayout from './components/AdminLayout'
import LoginPage from './pages/auth/LoginPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import CustomersPage from './pages/customers/CustomersPage'
import WorkOrdersPage from './pages/workorders/WorkOrdersPage'
import QuotesPage from './pages/quotes/QuotesPage'
import InventoryPage from './pages/inventory/InventoryPage'
import FinancialPage from './pages/financial/FinancialPage'
import ImportsPage from './pages/imports/ImportsPage'
import ProductsPage from './pages/products/ProductsPage'
import SuppliersPage from './pages/suppliers/SuppliersPage'

// Web pública (sin autenticación)
import {
  WebHomePage,
  WebEquiposPage,
  WebServiciosPage,
  WebNosotrosPage,
  WebContactoPage,
} from './web/WebPages'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      {/* ---- Web pública ---- */}
      <Route path="/" element={<WebHomePage />} />
      <Route path="/equipos" element={<WebEquiposPage />} />
      <Route path="/servicios" element={<WebServiciosPage />} />
      <Route path="/nosotros" element={<WebNosotrosPage />} />
      <Route path="/contacto" element={<WebContactoPage />} />

      {/* ---- CRM (privado) ---- */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
      <Route
        element={
          <PrivateRoute>
            <AdminLayout />
          </PrivateRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/clientes/*" element={<CustomersPage />} />
        <Route path="/ordenes/*" element={<WorkOrdersPage />} />
        <Route path="/cotizaciones/*" element={<QuotesPage />} />
        <Route path="/inventario/*" element={<InventoryPage />} />
        <Route path="/financiero/*" element={<FinancialPage />} />
        <Route path="/importaciones/*" element={<ImportsPage />} />
        <Route path="/productos/*" element={<ProductsPage />} />
        <Route path="/proveedores/*" element={<SuppliersPage />} />
      </Route>
    </Routes>
  )
}
