import { Routes, Route, useParams } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import WorkOrderList from '../../components/workorders/WorkOrderList'
import WorkOrderDetail from '../../components/workorders/WorkOrderDetail'
import WorkOrderForm from '../../components/workorders/WorkOrderForm'

function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/ordenes')} className="text-sm text-gray-500 hover:underline">
          ← Órdenes
        </button>
      </div>
      <div className="bg-white rounded-lg border p-6">
        <WorkOrderDetail orderId={id!} />
      </div>
    </>
  )
}

export default function WorkOrdersPage() {
  const navigate = useNavigate()

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Routes>
        <Route
          path="/"
          element={
            <>
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Órdenes de trabajo</h1>
                <button
                  onClick={() => navigate('/ordenes/nueva')}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                >
                  + Nueva orden
                </button>
              </div>
              <WorkOrderList />
            </>
          }
        />
        <Route
          path="/nueva"
          element={
            <>
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => navigate('/ordenes')} className="text-sm text-gray-500 hover:underline">
                  ← Órdenes
                </button>
                <h1 className="text-2xl font-bold">Nueva orden de trabajo</h1>
              </div>
              <div className="bg-white rounded-lg border p-6 max-w-3xl">
                <WorkOrderForm />
              </div>
            </>
          }
        />
        <Route path="/:id" element={<WorkOrderDetailPage />} />
      </Routes>
    </div>
  )
}
