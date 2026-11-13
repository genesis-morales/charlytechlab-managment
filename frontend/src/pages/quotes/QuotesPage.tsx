import { Routes, Route, useParams, useNavigate } from 'react-router-dom'
import QuoteList from '../../components/quotes/QuoteList'
import QuoteDetail from '../../components/quotes/QuoteDetail'
import QuoteForm from '../../components/quotes/QuoteForm'

function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/cotizaciones')} className="text-sm text-gray-500 hover:underline">
          ← Cotizaciones
        </button>
      </div>
      <div className="bg-white rounded-lg border p-6">
        <QuoteDetail quoteId={id!} />
      </div>
    </>
  )
}

function NewQuotePage() {
  const navigate = useNavigate()
  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/cotizaciones')} className="text-sm text-gray-500 hover:underline">
          ← Cotizaciones
        </button>
        <h1 className="text-2xl font-bold">Nueva cotización</h1>
      </div>
      <div className="bg-white rounded-lg border p-6 max-w-3xl">
        <QuoteForm />
      </div>
    </>
  )
}

export default function QuotesPage() {
  const navigate = useNavigate()

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Routes>
        <Route
          path="/"
          element={
            <>
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Cotizaciones</h1>
                <button
                  onClick={() => navigate('/cotizaciones/nueva')}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                >
                  + Nueva cotización
                </button>
              </div>
              <QuoteList />
            </>
          }
        />
        <Route path="/nueva" element={<NewQuotePage />} />
        <Route path="/:id" element={<QuoteDetailPage />} />
      </Routes>
    </div>
  )
}
