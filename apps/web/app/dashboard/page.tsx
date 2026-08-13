'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

export default function DashboardPage() {
  const router = useRouter()
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadProducts = async () => {
    try {
      const data = await api.listProducts()
      setProducts(data.products || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadProducts() }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return
    await api.deleteProduct(id)
    loadProducts()
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Topbar */}
      <nav className="bg-[#0a1628] px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')} className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-400 rounded-lg flex items-center justify-center font-black text-white text-sm">G</div>
            <span className="text-white font-semibold">GEO Platform</span>
          </button>
          <span className="text-white/20">›</span>
          <span className="text-white/60 text-sm">Dashboard</span>
        </div>
        <button
          onClick={() => router.push('/products/new')}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          + Add Product
        </button>
      </nav>

      <div className="max-w-6xl mx-auto px-8 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Product Dashboard</h1>
          <p className="text-gray-500">Track AI surfacing scores across all your products</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-center">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{borderWidth: '3px'}} />
              <p className="text-gray-500 text-sm">Loading products...</p>
            </div>
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <div className="text-5xl mb-4">🚀</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No products yet</h2>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">Add your first product to start auditing its AI visibility across ChatGPT, Gemini, Claude, and Perplexity.</p>
            <button
              onClick={() => router.push('/products/new')}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
            >
              Add Your First Product
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onView={() => router.push(`/products/${product.id}`)}
                onDelete={() => handleDelete(product.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ProductCard({ product, onView, onDelete }: any) {
  const [score, setScore] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getAnalytics(product.id)
      .then((data) => {
        if (data.has_data) setScore(data.overall_surfacing_score)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [product.id])

  const scoreColor = score === null ? 'text-gray-400' : score < 30 ? 'text-red-500' : score < 60 ? 'text-yellow-500' : 'text-green-500'
  const scoreBg = score === null ? 'bg-gray-100' : score < 30 ? 'bg-red-50' : score < 60 ? 'bg-yellow-50' : 'bg-green-50'

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 flex items-center gap-6 hover:shadow-md transition-shadow">
      {/* Score circle */}
      <div className={`w-20 h-20 rounded-2xl ${scoreBg} flex flex-col items-center justify-center flex-shrink-0`}>
        {loading ? (
          <div className="w-5 h-5 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <span className={`text-2xl font-black ${scoreColor}`}>
              {score !== null ? `${score}%` : '—'}
            </span>
            <span className="text-xs text-gray-400 mt-0.5">Score</span>
          </>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-gray-900 text-lg truncate">{product.name}</h3>
        <p className="text-gray-500 text-sm">{product.brand_name} · {product.category}</p>
        <div className="flex gap-4 mt-2">
          <span className="text-xs text-gray-400">{(product.ingredients || []).length} ingredients</span>
          <span className="text-xs text-gray-400">{(product.personas || []).length} personas</span>
          <span className="text-xs text-gray-400">{product.pricing_tier || 'Unclassified'}</span>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-3">
        {score === null && !loading && (
          <span className="text-xs bg-orange-100 text-orange-600 font-medium px-3 py-1 rounded-full">
            Audit Needed
          </span>
        )}
        {score !== null && (
          <span className="text-xs bg-blue-100 text-blue-600 font-medium px-3 py-1 rounded-full">
            Audited
          </span>
        )}
        <button
          onClick={onView}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          View Analytics
        </button>
        <button
          onClick={onDelete}
          className="text-gray-400 hover:text-red-500 p-2 rounded-lg transition-colors text-xs"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
