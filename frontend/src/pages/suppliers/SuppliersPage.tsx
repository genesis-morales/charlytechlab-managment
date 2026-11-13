import { Routes, Route, useNavigate } from 'react-router-dom'
import SupplierList from '../../components/suppliers/SupplierList'
import SupplierDetail from '../../components/suppliers/SupplierDetail'
import PurchaseList from '../../components/suppliers/PurchaseList'
import PurchaseForm from '../../components/suppliers/PurchaseForm'

function SupplierDetailPage() {
  const navigate = useNavigate()
  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/proveedores')} className="text-sm text-gray-500 hover:underline">
          ← Proveedores
        </button>
      </div>
      <div className="bg-white rounded-lg border p-6">
        <SupplierDetail />
      </div>
    </>
  )
}

function NewPurchasePage() {
  const navigate = useNavigate()
  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/proveedores/compras')} className="text-sm text-gray-500 hover:underline">
          ← Compras
        </button>
        <h1 className="text-2xl font-bold">Nueva compra</h1>
      </div>
      <div className="bg-white rounded-lg border p-6 max-w-3xl">
        <PurchaseForm />
      </div>
    </>
  )
}

export default function SuppliersPage() {
  const navigate = useNavigate()

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Routes>
        <Route
          path="/"
          element={
            <>
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Proveedores</h1>
                <div className="flex gap-2">
                  <button onClick={() => navigate('/proveedores/compras')}
                    className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50">
                    Ver compras
                  </button>
                  <button onClick={() => navigate('/proveedores/compras/nueva')}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">
                    + Nueva compra
                  </button>
                </div>
              </div>
              <SupplierList />
            </>
          }
        />
        <Route path="/:id" element={<SupplierDetailPage />} />
        <Route
          path="/compras"
          element={
            <>
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Compras</h1>
                <button onClick={() => navigate('/proveedores/compras/nueva')}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">
                  + Nueva compra
                </button>
              </div>
              <PurchaseList />
            </>
          }
        />
        <Route path="/compras/nueva" element={<NewPurchasePage />} />
      </Routes>
    </div>
  )
}
