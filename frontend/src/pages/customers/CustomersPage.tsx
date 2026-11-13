import { useNavigate } from 'react-router-dom'
import { Routes, Route } from 'react-router-dom'
import CustomerList from '../../components/customers/CustomerList'
import CustomerDetail from '../../components/customers/CustomerDetail'
import CustomerForm from '../../components/customers/CustomerForm'
import { useCustomer } from '../../api/customers'
import { useParams } from 'react-router-dom'

function EditCustomerPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: customer, isLoading } = useCustomer(id!)
  if (isLoading) return <p className="text-sm text-gray-500 p-4">Cargando…</p>
  return (
    <CustomerForm
      customer={customer}
      onSuccess={() => navigate(`/clientes/${id}`)}
      onCancel={() => navigate(`/clientes/${id}`)}
    />
  )
}

function NewCustomerPage() {
  const navigate = useNavigate()
  return (
    <CustomerForm
      onSuccess={() => navigate('/clientes')}
      onCancel={() => navigate('/clientes')}
    />
  )
}

export default function CustomersPage() {
  const navigate = useNavigate()

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Routes>
        <Route
          path="/"
          element={
            <>
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Clientes</h1>
                <button
                  onClick={() => navigate('/clientes/nuevo')}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                >
                  + Nuevo cliente
                </button>
              </div>
              <CustomerList />
            </>
          }
        />
        <Route
          path="/nuevo"
          element={
            <>
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => navigate('/clientes')} className="text-sm text-gray-500 hover:underline">
                  ← Clientes
                </button>
                <h1 className="text-2xl font-bold">Nuevo cliente</h1>
              </div>
              <div className="bg-white rounded-lg border p-6 max-w-2xl">
                <NewCustomerPage />
              </div>
            </>
          }
        />
        <Route
          path="/:id"
          element={
            <>
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => navigate('/clientes')} className="text-sm text-gray-500 hover:underline">
                  ← Clientes
                </button>
              </div>
              <div className="bg-white rounded-lg border p-6">
                <CustomerDetail />
              </div>
            </>
          }
        />
        <Route
          path="/:id/editar"
          element={
            <>
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:underline">
                  ← Volver
                </button>
                <h1 className="text-2xl font-bold">Editar cliente</h1>
              </div>
              <div className="bg-white rounded-lg border p-6 max-w-2xl">
                <EditCustomerPage />
              </div>
            </>
          }
        />
      </Routes>
    </div>
  )
}
