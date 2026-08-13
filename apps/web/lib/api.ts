const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function request(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }
  return response.json()
}

export const api = {
  analyzeImages: (imageUrls: string[]) =>
    request('/api/v1/products/analyze-images', {
      method: 'POST',
      body: JSON.stringify({ image_urls: imageUrls }),
    }),

  createProduct: (data: any) =>
    request('/api/v1/products/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  listProducts: () => request('/api/v1/products/'),

  getProduct: (id: string) => request(`/api/v1/products/${id}`),

  deleteProduct: (id: string) =>
    request(`/api/v1/products/${id}`, { method: 'DELETE' }),

  startSimulation: (productId: string, targetLlms?: string[], queriesPerPersona?: number) =>
    request('/api/v1/simulations/', {
      method: 'POST',
      body: JSON.stringify({ product_id: productId, target_llms: targetLlms, queries_per_persona: queriesPerPersona }),
    }),

  getSimulationStatus: (runId: string) => request(`/api/v1/simulations/${runId}`),

  getProductSimulations: (productId: string) =>
    request(`/api/v1/simulations/product/${productId}`),

  getAnalytics: (productId: string) => request(`/api/v1/analytics/${productId}`),

  generateActionPlan: (productId: string) =>
    request('/api/v1/seeding/generate', {
      method: 'POST',
      body: JSON.stringify({ product_id: productId }),
    }),

  health: () => request('/health'),
}

export default api
