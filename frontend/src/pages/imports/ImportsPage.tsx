import { Routes, Route, useParams, useNavigate } from 'react-router-dom'
import ShipmentList from '../../components/imports/ShipmentList'
import ShipmentDetail from '../../components/imports/ShipmentDetail'

function ShipmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/importaciones')} className="text-sm text-gray-500 hover:underline">
          ← Importaciones
        </button>
      </div>
      <div className="bg-white rounded-lg border p-6">
        <ShipmentDetail shipmentId={id!} />
      </div>
    </>
  )
}

export default function ImportsPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Routes>
        <Route
          path="/"
          element={
            <>
              <h1 className="text-2xl font-bold mb-6">Importaciones y casillero</h1>
              <ShipmentList />
            </>
          }
        />
        <Route path="/:id" element={<ShipmentDetailPage />} />
      </Routes>
    </div>
  )
}
