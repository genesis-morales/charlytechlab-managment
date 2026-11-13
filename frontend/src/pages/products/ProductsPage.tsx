import { Routes, Route, useParams, useNavigate } from 'react-router-dom'
import ProductList from '../../components/products/ProductList'
import ProductDetail from '../../components/products/ProductDetail'
import ProductForm from '../../components/products/ProductForm'

function ProductDetailPage() {
  const { id: _id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/productos')} className="text-sm text-gray-500 hover:underline">
          ← Productos
        </button>
      </div>
      <div className="bg-white rounded-lg border p-6">
        <ProductDetail />
      </div>
    </>
  )
}

function NewProductPage() {
  const navigate = useNavigate()
  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/productos')} className="text-sm text-gray-500 hover:underline">
          ← Productos
        </button>
        <h1 className="text-2xl font-bold">Publicar producto</h1>
      </div>
      <div className="bg-white rounded-lg border p-6 max-w-2xl">
        <ProductForm />
      </div>
    </>
  )
}

export default function ProductsPage() {
  const navigate = useNavigate()

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Routes>
        <Route
          path="/"
          element={
            <>
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Catálogo de productos</h1>
                <button onClick={() => navigate('/productos/nuevo')}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">
                  + Publicar producto
                </button>
              </div>
              <ProductList />
            </>
          }
        />
        <Route path="/nuevo" element={<NewProductPage />} />
        <Route path="/:id" element={<ProductDetailPage />} />
      </Routes>
    </div>
  )
}
