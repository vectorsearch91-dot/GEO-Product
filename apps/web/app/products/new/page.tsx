'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

type Step = 'details' | 'analyzing' | 'review' | 'saving'
type ImageInputMode = 'upload' | 'url'

const DEFAULT_PERSONAS = [
  { name: 'Urban Professional', age_range: '28-35', location: 'humid city', occupation: 'working professional', pain_points: ['adult acne', 'busy schedule'] },
  { name: 'Eco-Conscious Shopper', age_range: '25-40', location: 'suburban', occupation: 'health-conscious consumer', pain_points: ['natural ingredients', 'sensitive skin'] },
  { name: 'Budget Beauty Enthusiast', age_range: '18-26', location: 'college town', occupation: 'student', pain_points: ['affordable options', 'hormonal acne'] },
]

export default function NewProductPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('details')
  const [error, setError] = useState('')
  const [imageMode, setImageMode] = useState<ImageInputMode>('upload')

  // Image URL inputs
  const [imageUrls, setImageUrls] = useState(['', '', '', ''])
  // Uploaded files (base64 data URLs)
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [uploadedNames, setUploadedNames] = useState<string[]>([])

  // Manual entry
  const [useManual, setUseManual] = useState(false)
  const [manualName, setManualName] = useState('')
  const [manualBrand, setManualBrand] = useState('')
  const [manualCategory, setManualCategory] = useState('Skincare')

  // Extracted + edited data
  const [editedData, setEditedData] = useState<any>(null)
  const [editingPersonaIdx, setEditingPersonaIdx] = useState<number | null>(null)

  const filledUrls = imageUrls.filter(u => u.trim())
  const allImages = imageMode === 'upload' ? uploadedImages : filledUrls

  // File upload handler — converts to base64
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string
      const updated = [...uploadedImages]
      const names = [...uploadedNames]
      updated[index] = base64
      names[index] = file.name
      setUploadedImages(updated)
      setUploadedNames(names)
    }
    reader.readAsDataURL(file)
  }

  const handleAnalyze = async () => {
    setError('')
    if (useManual) {
      if (!manualName || !manualBrand) { setError('Product name and brand are required'); return }
      const data = {
        product_name: manualName, brand_name: manualBrand, category: manualCategory,
        primary_description: `${manualName} by ${manualBrand}`,
        ingredients: [], key_benefits: [],
        target_demographics: { age_range: '25-40', skin_types: ['all'], primary_concerns: ['general skincare'], climate_fit: 'any' },
        pricing_tier: 'Premium', personas: DEFAULT_PERSONAS,
      }
      setEditedData(data); setStep('review'); return
    }
    if (allImages.filter(Boolean).length === 0) {
      setError('Please upload at least one product image or switch to manual entry'); return
    }
    setStep('analyzing')
    try {
      const result = await api.analyzeImages(allImages.filter(Boolean))
      const data = result.data
      if (!data.personas?.length) data.personas = DEFAULT_PERSONAS
      setEditedData(data); setStep('review')
    } catch (e: any) {
      setError(e.message || 'Analysis failed. Check your images and try again.')
      setStep('details')
    }
  }

  const handleConfirm = async () => {
    setStep('saving')
    try {
      const result = await api.createProduct({
        name: editedData.product_name,
        brand_name: editedData.brand_name,
        category: editedData.category || 'Skincare',
        description: editedData.primary_description,
        image_urls: allImages.filter(Boolean).filter(u => u.startsWith('http')),
        ingredients: editedData.ingredients || [],
        key_benefits: editedData.key_benefits || [],
        target_demographics: editedData.target_demographics || {},
        pricing_tier: editedData.pricing_tier,
        personas: editedData.personas || DEFAULT_PERSONAS,
      })
      router.push(`/products/${result.product_id}`)
    } catch (e: any) {
      setError(e.message || 'Failed to save product'); setStep('review')
    }
  }

  const updatePersona = (idx: number, field: string, value: string) => {
    const updated = [...(editedData.personas || [])]
    if (field === 'pain_points') {
      updated[idx] = { ...updated[idx], pain_points: value.split(',').map((s: string) => s.trim()).filter(Boolean) }
    } else {
      updated[idx] = { ...updated[idx], [field]: value }
    }
    setEditedData({ ...editedData, personas: updated })
  }

  const addPersona = () => {
    const updated = [...(editedData.personas || []), { name: 'New Persona', age_range: '25-35', location: 'city', occupation: 'professional', pain_points: ['skin concern'] }]
    setEditedData({ ...editedData, personas: updated })
    setEditingPersonaIdx(updated.length - 1)
  }

  const removePersona = (idx: number) => {
    const updated = (editedData.personas || []).filter((_: any, i: number) => i !== idx)
    setEditedData({ ...editedData, personas: updated })
    setEditingPersonaIdx(null)
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
                step === s ? 'bg-blue-600 text-white'
                : (step === 'analyzing' && s === 'details') || (step === 'saving' && s === 'review') ? 'bg-blue-600 text-white'
                : i < ['details', 'review'].indexOf(step as any) ? 'bg-green-500 text-white'
                : 'bg-gray-200 text-gray-500'
              }`}>{i + 1}</div>
              <span className="text-sm font-medium text-gray-600">{s === 'details' ? 'Product Details' : 'Review & Confirm'}</span>
              {i < 1 && <div className="w-12 h-px bg-gray-300" />}
            </div>
          ))}
        </div>

        {/* STEP 1: Details */}
        {step === 'details' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Add your product</h2>
            <p className="text-gray-500 mb-8">Upload product images for AI analysis, paste URLs, or enter details manually.</p>

            {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700 text-sm">{error}</div>}

            {/* Entry mode */}
            <div className="flex gap-3 mb-6">
              <button onClick={() => setUseManual(false)} className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all ${!useManual ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                📸 Image Analysis
              </button>
              <button onClick={() => setUseManual(true)} className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all ${useManual ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                ✍️ Manual Entry
              </button>
            </div>

            {!useManual && (
              <div>
                {/* Image input mode toggle */}
                <div className="flex gap-2 mb-5 bg-gray-100 rounded-xl p-1">
                  <button onClick={() => setImageMode('upload')} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${imageMode === 'upload' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                    ⬆️ Upload from Device
                  </button>
                  <button onClick={() => setImageMode('url')} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${imageMode === 'url' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                    🔗 Paste Image URL
                  </button>
                </div>

                {imageMode === 'upload' ? (
                  <div className="space-y-4">
                    <p className="text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-lg p-3">
                      💡 Upload photos of your product packaging — front, back, sides. JPG/PNG supported. Images are sent directly to GPT-4o Vision for analysis.
                    </p>
                    {(['Front Label / Packaging', 'Back Label / Ingredients', 'Side Panel / Claims', 'Texture Shot (Optional)'] as const).map((label, i) => (
                      <div key={i}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                        <div className={`border-2 border-dashed rounded-xl transition-colors ${uploadedImages[i] ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}`}>
                          {uploadedImages[i] ? (
                            <div className="flex items-center gap-3 p-3">
                              <img src={uploadedImages[i]} alt="preview" className="w-14 h-14 object-cover rounded-lg border border-gray-200" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{uploadedNames[i]}</p>
                                <p className="text-xs text-green-600">✓ Ready for analysis</p>
                              </div>
                              <button onClick={() => {
                                const imgs = [...uploadedImages]; imgs[i] = ''
                                const names = [...uploadedNames]; names[i] = ''
                                setUploadedImages(imgs); setUploadedNames(names)
                              }} className="text-gray-400 hover:text-red-500 text-xs px-2 py-1 rounded transition-colors">Remove</button>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center py-6 cursor-pointer">
                              <span className="text-2xl mb-1">📷</span>
                              <span className="text-sm text-gray-500">Click to upload</span>
                              <span className="text-xs text-gray-400 mt-1">JPG, PNG, WebP</span>
                              <input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, i)} />
                            </label>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-lg p-3">
                      💡 Right-click any product image online → "Copy image address" and paste below.
                    </p>
                    {(['Front Label / Packaging', 'Back Label / Ingredients', 'Side Panel / Claims', 'Texture Shot (Optional)'] as const).map((label, i) => (
                      <div key={i}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                        <input type="url" value={imageUrls[i]} onChange={e => { const u = [...imageUrls]; u[i] = e.target.value; setImageUrls(u) }}
                          placeholder="https://..." className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {useManual && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                  <input value={manualName} onChange={e => setManualName(e.target.value)} placeholder="e.g. Niacinamide 10% + Zinc 1%"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand Name *</label>
                  <input value={manualBrand} onChange={e => setManualBrand(e.target.value)} placeholder="e.g. The Ordinary"
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select value={manualCategory} onChange={e => setManualCategory(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    {['Skincare', 'Supplement', 'Haircare', 'Makeup', 'Wellness'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            )}

            <button onClick={handleAnalyze} className="w-full mt-8 bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-semibold transition-colors">
              {useManual ? 'Continue →' : imageMode === 'upload'
                ? `🤖 Analyze ${uploadedImages.filter(Boolean).length} image(s) with AI →`
                : `🤖 Analyze ${filledUrls.length} image(s) with AI →`}
            </button>
          </div>
        )}

        {/* STEP 2: Analyzing */}
        {step === 'analyzing' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center animate-fade-in">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6" style={{ borderWidth: '4px' }} />
            <h2 className="text-xl font-bold text-gray-900 mb-2">AI is analyzing your product...</h2>
            <p className="text-gray-500 text-sm">GPT-4o Vision is reading your product images and extracting ingredients, claims, and target personas. This takes about 15–20 seconds.</p>
            <div className="mt-8 flex justify-center gap-6 text-xs text-gray-400">
              <span>✓ Reading label</span>
              <span>✓ Parsing ingredients</span>
              <span className="animate-pulse">⏳ Generating personas...</span>
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
                  <h2 className="text-xl font-bold text-gray-900">Review Product Details</h2>
                  <p className="text-gray-500 text-sm">Edit any field before saving. Personas are fully customisable.</p>
                </div>
              </div>

              {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700 text-sm">{error}</div>}

              {/* Core fields */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                {[
                  { label: 'Product Name', key: 'product_name' },
                  { label: 'Brand Name', key: 'brand_name' },
                  { label: 'Category', key: 'category' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{f.label}</label>
                    <input value={editedData[f.key] || ''} onChange={e => setEditedData({ ...editedData, [f.key]: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Pricing Tier</label>
                  <select value={editedData.pricing_tier || 'Premium'} onChange={e => setEditedData({ ...editedData, pricing_tier: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <option>Mass</option><option>Premium</option><option>Luxury</option>
                  </select>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</label>
                <textarea value={editedData.primary_description || ''} onChange={e => setEditedData({ ...editedData, primary_description: e.target.value })}
                  rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>

              {/* Ingredients */}
              {(editedData.ingredients || []).length > 0 && (
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Key Ingredients ({(editedData.ingredients || []).length})</label>
                  <div className="flex flex-wrap gap-2">
                    {(editedData.ingredients || []).slice(0, 12).map((ing: string, i: number) => (
                      <span key={i} className="bg-blue-50 text-blue-700 text-xs px-3 py-1 rounded-full font-medium">{ing}</span>
                    ))}
                    {(editedData.ingredients || []).length > 12 && <span className="text-xs text-gray-400">+{(editedData.ingredients || []).length - 12} more</span>}
                  </div>
                </div>
              )}

              {/* Benefits */}
              {(editedData.key_benefits || []).length > 0 && (
                <div className="mb-6">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Key Benefits</label>
                  <div className="flex flex-wrap gap-2">
                    {(editedData.key_benefits || []).map((b: string, i: number) => (
                      <span key={i} className="bg-green-50 text-green-700 text-xs px-3 py-1 rounded-full font-medium">{b}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Editable Personas */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Target Personas ({(editedData.personas || []).length})
                  </label>
                  <button onClick={addPersona} className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1 rounded-lg font-semibold transition-colors">
                    + Add Persona
                  </button>
                </div>
                <div className="space-y-3">
                  {(editedData.personas || []).map((p: any, i: number) => (
                    <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                      {/* Persona header — click to expand */}
                      <div
                        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => setEditingPersonaIdx(editingPersonaIdx === i ? null : i)}
                      >
                        <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center text-base flex-shrink-0">👤</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 text-sm">{p.name}</div>
                          <div className="text-xs text-gray-500">{p.age_range} · {p.location} · {p.occupation}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-blue-600 font-medium">{editingPersonaIdx === i ? 'Done ↑' : 'Edit ↓'}</span>
                          <button onClick={e => { e.stopPropagation(); removePersona(i) }}
                            className="text-gray-300 hover:text-red-500 transition-colors text-xs px-2">✕</button>
                        </div>
                      </div>

                      {/* Editable fields */}
                      {editingPersonaIdx === i && (
                        <div className="border-t border-gray-100 p-4 bg-gray-50 grid grid-cols-2 gap-3">
                          {[
                            { label: 'Name', field: 'name', placeholder: 'Urban Professional' },
                            { label: 'Age Range', field: 'age_range', placeholder: '28-35' },
                            { label: 'Location', field: 'location', placeholder: 'humid city' },
                            { label: 'Occupation', field: 'occupation', placeholder: 'working professional' },
                          ].map(f => (
                            <div key={f.field}>
                              <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
                              <input value={p[f.field] || ''} onChange={e => updatePersona(i, f.field, e.target.value)}
                                placeholder={f.placeholder}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white" />
                            </div>
                          ))}
                          <div className="col-span-2">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Pain Points (comma separated)</label>
                            <input
                              value={(p.pain_points || []).join(', ')}
                              onChange={e => updatePersona(i, 'pain_points', e.target.value)}
                              placeholder="adult acne, busy schedule, pollution"
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button onClick={() => { setStep('details'); setEditedData(null) }}
                className="flex-1 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 py-4 rounded-xl font-semibold transition-colors">
                ← Back
              </button>
              <button onClick={handleConfirm}
                className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white py-4 px-8 rounded-xl font-semibold transition-colors">
                Confirm & Save Product →
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Saving */}
        {step === 'saving' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6" style={{ borderWidth: '4px' }} />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Saving product...</h2>
            <p className="text-gray-500 text-sm">Creating your product profile and preparing the audit engine.</p>
          </div>
        )}
      </div>
    </div>
  )
}
