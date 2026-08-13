'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

type Step = 'details' | 'analyzing' | 'review' | 'saving'

export default function NewProductPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('details')
  const [error, setError] = useState('')
  const [imageUrls, setImageUrls] = useState(['', '', '', ''])
  const [manualName, setManualName] = useState('')
  const [manualBrand, setManualBrand] = useState('')
  const [manualCategory, setManualCategory] = useState('Skincare')
  const [useManual, setUseManual] = useState(false)
  const [extracted, setExtracted] = useState<any>(null)
  const [editedData, setEditedData] = useState<any>(null)

  const filledUrls = imageUrls.filter(u => u.trim())

  const handleAnalyze = async () => {
    setError('')
    if (useManual) {
      if (!manualName || !manualBrand) {
        setError('Product name and brand are required')
        return
      }
      const defaultData = {
        product_name: manualName,
        brand_name: manualBrand,
        category: manualCategory,
        primary_description: `${manualName} by ${manualBrand}`,
        ingredients: [],
        key_benefits: [],
        target_demographics: { age_range: '25-40', skin_types: ['all'], primary_concerns: ['general skincare'], climate_fit: 'any' },
        pricing_tier: 'Premium',
        personas: defaultPersonas(),
      }
      setExtracted(defaultData)
      setEditedData(defaultData)
      setStep('review')
      return
    }
    if (filledUrls.length === 0) {
      setError('Please enter at least one product image URL, or switch to manual entry')
      return
    }
    setStep('analyzing')
    try {
      const result = await api.analyzeImages(filledUrls)
      setExtracted(result.data)
      setEditedData(result.data)
      setStep('review')
    } catch (e: any) {
      setError(e.message || 'Analysis failed. Please check your image URLs.')
      setStep('details')
    }
  }

  const handleConfirm = async () => {
    setStep('saving')
    try {
      const payload = {
        name: editedData.product_name,
        brand_name: editedData.brand_name,
        category: editedData.category || 'Skincare',
        description: editedData.primary_description,
        image_urls: filledUrls,
        ingredients: editedData.ingredients || [],
        key_benefits: editedData.key_benefits || [],
        target_demographics: editedData.target_demographics || {},
        pricing_tier: editedData.pricing_tier,
        personas: editedData.personas || defaultPersonas(),
      }
      const result = await api.createProduct(payload)
      router.push(`/products/${result.product_id}`)
    } catch (e: any) {
      setError(e.message || 'Failed to save product')
      setStep('review')
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <nav className="bg-[#0a1628] px-8 py-4 flex items-center gap-3">
        <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-400 rounded-lg flex items-center justify-center font-black text-white text-sm">G</div>
          <span className="text-white font-semibold">GEO Platform</span>
        </button>
        <span className="text-white/20">›</span>
        <span className="text-white/60 text-sm">Add Product</span>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Step indicator */}
        <div className="flex items-center gap-3 mb-10">
          {(['details', 'review'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step === s || (step === 'analyzing' && s === 'details') || (step === 'saving' && s === 'review')
                  ? 'bg-blue-600 text-white'
                  : i < ['details', 'review'].indexOf(step) ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>{i + 1}</div>
              <span className="text-sm font-medium text-gray-600 capitalize">
                {s === 'details' ? 'Product Details' : 'Review & Confirm'}
              </span>
              {i < 1 && <div className="w-12 h-px bg-gray-300" />}
            </div>
          ))}
        </div>

        {/* STEP 1: Details */}
        {(step === 'details') && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Add your product</h2>
            <p className="text-gray-500 mb-8">Paste product image URLs for AI analysis, or enter details manually.</p>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700 text-sm">{error}</div>
            )}

            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setUseManual(false)}
                className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all ${
                  !useManual ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                }`}
              >📸 Image URL Analysis</button>
              <button
                onClick={() => setUseManual(true)}
                className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all ${
                  useManual ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                }`}
              >✍️ Manual Entry</button>
            </div>

            {!useManual ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-500 bg-blue-50 border border-blue-100 rounded-lg p-3">
                  💡 <strong>Tip:</strong> Paste public image URLs from your website, Shopify store, or any CDN. Right-click a product image → Copy image address.
                </p>
                {(['Front Label / Packaging', 'Back Label / Ingredients', 'Side Panel / Claims', 'Texture / In Use (Optional)'] as const).map((label, i) => (
                  <div key={i}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                    <input
                      type="url"
                      value={imageUrls[i]}
                      onChange={e => {
                        const updated = [...imageUrls]
                        updated[i] = e.target.value
                        setImageUrls(updated)
                      }}
                      placeholder="https://..."
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                  <input
                    value={manualName}
                    onChange={e => setManualName(e.target.value)}
                    placeholder="e.g. Niacinamide 10% + Zinc 1%"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand Name *</label>
                  <input
                    value={manualBrand}
                    onChange={e => setManualBrand(e.target.value)}
                    placeholder="e.g. The Ordinary"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={manualCategory}
                    onChange={e => setManualCategory(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {['Skincare', 'Supplement', 'Haircare', 'Makeup', 'Wellness'].map(c => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <button
              onClick={handleAnalyze}
              className="w-full mt-8 bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-semibold transition-colors"
            >
              {useManual ? 'Continue →' : `🤖 Analyze with AI (${filledUrls.length} image${filledUrls.length !== 1 ? 's' : ''}) →`}
            </button>
          </div>
        )}

        {/* STEP 2: Analyzing */}
        {step === 'analyzing' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center animate-fade-in">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6" style={{borderWidth:'4px'}} />
            <h2 className="text-xl font-bold text-gray-900 mb-2">AI is analyzing your product...</h2>
            <p className="text-gray-500 text-sm">GPT-4o Vision is reading your product images and extracting ingredients, claims, and target personas. This takes about 15 seconds.</p>
            <div className="mt-8 flex justify-center gap-6 text-xs text-gray-400">
              <span>✓ Reading front label</span>
              <span>✓ Parsing ingredients</span>
              <span className="animate-pulse-slow">⏳ Generating personas...</span>
            </div>
          </div>
        )}

        {/* STEP 3: Review */}
        {step === 'review' && editedData && (
          <div className="animate-fade-in space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-xl">✅</div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">AI Extraction Complete</h2>
                  <p className="text-gray-500 text-sm">Review and edit the extracted data before confirming.</p>
                </div>
              </div>

              {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700 text-sm">{error}</div>}

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Product Name</label>
                  <input
                    value={editedData.product_name || ''}
                    onChange={e => setEditedData({...editedData, product_name: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Brand Name</label>
                  <input
                    value={editedData.brand_name || ''}
                    onChange={e => setEditedData({...editedData, brand_name: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Category</label>
                  <input
                    value={editedData.category || ''}
                    onChange={e => setEditedData({...editedData, category: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Pricing Tier</label>
                  <select
                    value={editedData.pricing_tier || 'Premium'}
                    onChange={e => setEditedData({...editedData, pricing_tier: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option>Mass</option><option>Premium</option><option>Luxury</option>
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</label>
                <textarea
                  value={editedData.primary_description || ''}
                  onChange={e => setEditedData({...editedData, primary_description: e.target.value})}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Ingredients */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Key Ingredients ({(editedData.ingredients || []).length})
                </label>
                <div className="flex flex-wrap gap-2">
                  {(editedData.ingredients || []).slice(0, 12).map((ing: string, i: number) => (
                    <span key={i} className="bg-blue-50 text-blue-700 text-xs px-3 py-1 rounded-full font-medium">{ing}</span>
                  ))}
                  {(editedData.ingredients || []).length > 12 && (
                    <span className="text-xs text-gray-400">+{(editedData.ingredients || []).length - 12} more</span>
                  )}
                </div>
              </div>

              {/* Benefits */}
              <div className="mb-6">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Key Benefits ({(editedData.key_benefits || []).length})
                </label>
                <div className="flex flex-wrap gap-2">
                  {(editedData.key_benefits || []).map((b: string, i: number) => (
                    <span key={i} className="bg-green-50 text-green-700 text-xs px-3 py-1 rounded-full font-medium">{b}</span>
                  ))}
                </div>
              </div>

              {/* Personas */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Target Personas ({(editedData.personas || []).length})
                </label>
                <div className="grid gap-3">
                  {(editedData.personas || []).map((p: any, i: number) => (
                    <div key={i} className="bg-gray-50 rounded-xl p-4 flex gap-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-lg flex-shrink-0">👤</div>
                      <div>
                        <div className="font-semibold text-gray-900 text-sm">{p.name}</div>
                        <div className="text-xs text-gray-500">{p.age_range} · {p.location} · {p.occupation}</div>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          {(p.pain_points || []).map((pp: string, j: number) => (
                            <span key={j} className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">{pp}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => { setStep('details'); setExtracted(null); setEditedData(null) }}
                className="flex-1 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 py-4 rounded-xl font-semibold transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleConfirm}
                className="flex-2 bg-blue-600 hover:bg-blue-500 text-white py-4 px-8 rounded-xl font-semibold transition-colors"
              >
                Confirm & Save Product →
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Saving */}
        {step === 'saving' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6" style={{borderWidth:'4px'}} />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Saving product...</h2>
            <p className="text-gray-500 text-sm">Creating your product profile and preparing the audit engine.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function defaultPersonas() {
  return [
    { name: 'Urban Professional', age_range: '28-35', location: 'humid city', occupation: 'working professional', pain_points: ['adult acne', 'busy schedule'] },
    { name: 'Eco-Conscious Shopper', age_range: '25-40', location: 'suburban', occupation: 'health-conscious consumer', pain_points: ['natural ingredients', 'sensitive skin'] },
    { name: 'Budget Beauty Enthusiast', age_range: '18-26', location: 'college town', occupation: 'student', pain_points: ['affordable options', 'hormonal acne'] },
  ]
}
