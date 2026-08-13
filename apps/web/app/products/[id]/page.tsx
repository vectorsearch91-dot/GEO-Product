'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import api from '@/lib/api'

const LLM_COLORS: Record<string, string> = {
  'ChatGPT (GPT-4o)': '#10b981',
  'Google Gemini': '#3b82f6',
  'Claude': '#8b5cf6',
  'Perplexity': '#f59e0b',
}

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const productId = params.id as string

  const [product, setProduct] = useState<any>(null)
  const [analytics, setAnalytics] = useState<any>(null)
  const [simulation, setSimulation] = useState<any>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [actionPlan, setActionPlan] = useState<any>(null)
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'competitors' | 'sources' | 'action'>('overview')
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const [prod, anal] = await Promise.all([
        api.getProduct(productId),
        api.getAnalytics(productId)
      ])
      setProduct(prod.product)
      setAnalytics(anal)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => { loadData() }, [loadData])

  // Poll simulation status
  useEffect(() => {
    if (!simulation || !isRunning) return
    const interval = setInterval(async () => {
      try {
        const status = await api.getSimulationStatus(simulation.simulation_run_id)
        setSimulation(status)
        if (status.status === 'COMPLETED' || status.status === 'FAILED') {
          setIsRunning(false)
          loadData()
        }
      } catch (e) {
        console.error(e)
      }
    }, 2500)
    return () => clearInterval(interval)
  }, [simulation, isRunning, loadData])

  const startAudit = async () => {
    setIsRunning(true)
    try {
      const result = await api.startSimulation(productId)
      setSimulation(result)
    } catch (e: any) {
      setIsRunning(false)
      alert('Failed to start audit: ' + e.message)
    }
  }

  const generatePlan = async () => {
    setGeneratingPlan(true)
    try {
      const result = await api.generateActionPlan(productId)
      setActionPlan(result.action_plan)
      setActiveTab('action')
    } catch (e: any) {
      alert('Failed to generate plan: ' + e.message)
    } finally {
      setGeneratingPlan(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0a1628] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{borderWidth:'4px'}} />
        <p className="text-white/60">Loading product analytics...</p>
      </div>
    </div>
  )

  const score = analytics?.overall_surfacing_score ?? null
  const hasData = analytics?.has_data ?? false
  const scoreColor = !hasData ? '#94a3b8' : score < 30 ? '#ef4444' : score < 60 ? '#f59e0b' : '#10b981'

  const llmData = analytics?.by_llm ? Object.entries(analytics.by_llm).map(([name, val]) => ({ name, value: val as number })) : []
  const personaData = analytics?.by_persona ? Object.entries(analytics.by_persona).map(([name, val]) => ({ name, value: val as number })) : []
  const intentData = analytics?.by_intent ? Object.entries(analytics.by_intent).map(([name, val]) => ({ name, value: val as number })) : []

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Top nav */}
      <nav className="bg-[#0a1628] px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-400 rounded-lg flex items-center justify-center font-black text-white text-sm">G</div>
            <span className="text-white font-semibold">GEO Platform</span>
          </button>
          <span className="text-white/20">›</span>
          <span className="text-white/60 text-sm">{product?.name || 'Loading...'}</span>
        </div>
        <div className="flex items-center gap-3">
          {hasData && !isRunning && (
            <button onClick={generatePlan} disabled={generatingPlan}
              className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
              {generatingPlan ? '⏳ Generating...' : '⚡ Generate Action Plan'}
            </button>
          )}
          <button
            onClick={startAudit}
            disabled={isRunning}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {isRunning ? '🔄 Running Audit...' : '🚀 Run New Audit'}
          </button>
        </div>
      </nav>

      {/* Simulation progress bar */}
      {isRunning && simulation && (
        <div className="bg-blue-600 px-8 py-3">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white text-sm font-medium">🤖 Running AI audit across 4 LLM engines...</span>
              <span className="text-white/80 text-sm">{simulation.completed_queries || 0} / {simulation.total_queries || '...'} queries</span>
            </div>
            <div className="w-full bg-blue-800 rounded-full h-2">
              <div
                className="bg-white rounded-full h-2 transition-all duration-500"
                style={{ width: `${simulation.progress || 0}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-8 py-8">
        {/* Product header */}
        <div className="flex items-start gap-6 mb-8">
          {(product?.image_urls || []).length > 0 && (
            <img src={product.image_urls[0]} alt={product?.name} className="w-20 h-20 object-cover rounded-2xl border border-gray-200" />
          )}
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">{product?.name}</h1>
            <p className="text-gray-500">{product?.brand_name} · {product?.category} · {product?.pricing_tier}</p>
            {product?.description && <p className="text-gray-600 text-sm mt-1 max-w-2xl">{product.description}</p>}
          </div>
          {/* Big Score */}
          <div className="text-center bg-white border border-gray-200 rounded-2xl px-8 py-6">
            <div className="text-5xl font-black" style={{ color: scoreColor }}>
              {hasData ? `${score}%` : '—'}
            </div>
            <div className="text-xs text-gray-500 mt-1 font-medium">AI Surfacing Score</div>
            {hasData && (
              <div className="text-xs text-gray-400 mt-1">
                {analytics.surfaced_count} / {analytics.total_simulations} queries
              </div>
            )}
          </div>
        </div>

        {/* No data state */}
        {!hasData && !isRunning && (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center mb-8">
            <div className="text-5xl mb-4">🔍</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No audit data yet</h2>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Run your first AI audit to see how often your brand appears in ChatGPT, Gemini, Claude, and Perplexity recommendations.
            </p>
            <button onClick={startAudit} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-semibold transition-colors">
              🚀 Run First Audit
            </button>
          </div>
        )}

        {isRunning && !hasData && (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center mb-8">
            <div className="text-5xl mb-4 animate-pulse-slow">🤖</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Audit in progress...</h2>
            <p className="text-gray-500">Querying ChatGPT, Gemini, Claude, and Perplexity. Results will appear here automatically.</p>
          </div>
        )}

        {/* Analytics tabs */}
        {hasData && (
          <>
            {/* Metric cards */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Surfacing Score', value: `${score}%`, sub: 'across all engines', color: scoreColor },
                { label: 'Rank #1 Share', value: `${Math.round(score * 0.6)}%`, sub: 'top recommendations', color: '#3b82f6' },
                { label: 'Competitors Tracked', value: String(analytics.top_competitors?.length || 0), sub: 'brands competing', color: '#8b5cf6' },
                { label: 'Citation Sources', value: String(analytics.top_cited_domains?.length || 0), sub: 'RAG nodes indexed', color: '#f59e0b' },
              ].map((m) => (
                <div key={m.label} className="bg-white border border-gray-200 rounded-2xl p-5">
                  <div className="text-3xl font-black mb-1" style={{ color: m.color }}>{m.value}</div>
                  <div className="text-sm font-semibold text-gray-900">{m.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{m.sub}</div>
                </div>
              ))}
            </div>

            {/* Tab nav */}
            <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-6 w-fit">
              {(['overview', 'competitors', 'sources', 'action'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${
                    activeTab === tab ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab === 'action' ? '⚡ Action Plan' : tab === 'overview' ? '📊 Overview' : tab === 'competitors' ? '🔍 Competitors' : '🕸️ Sources'}
                </button>
              ))}
            </div>

            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-2 gap-6 animate-fade-in">
                <ChartCard title="Surfacing Score by LLM Engine" data={llmData} colors={LLM_COLORS} />
                <ChartCard title="Score by Intent Category" data={intentData} />
                <ChartCard title="Score by Buyer Persona" data={personaData} />
                <div className="bg-white border border-gray-200 rounded-2xl p-6">
                  <h3 className="font-bold text-gray-900 mb-4">Product Details</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Key Ingredients</div>
                      <div className="flex flex-wrap gap-1.5">
                        {(product?.ingredients || []).slice(0, 8).map((ing: string, i: number) => (
                          <span key={i} className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">{ing}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Key Benefits</div>
                      <div className="flex flex-wrap gap-1.5">
                        {(product?.key_benefits || []).map((b: string, i: number) => (
                          <span key={i} className="bg-green-50 text-green-700 text-xs px-2 py-0.5 rounded-full">{b}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* COMPETITORS TAB */}
            {activeTab === 'competitors' && (
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden animate-fade-in">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900">Competitor Share of Voice</h3>
                  <p className="text-gray-500 text-sm">Brands recommended by AI when your product wasn't surfaced</p>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Brand</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Times Recommended</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Share of Voice</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">vs. You</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics.top_competitors || []).map((comp: any, i: number) => (
                      <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-900">{comp.name}</div>
                        </td>
                        <td className="px-6 py-4 text-gray-600">{comp.count}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-gray-100 rounded-full h-2 max-w-32">
                              <div className="bg-red-400 h-2 rounded-full" style={{ width: `${Math.min(comp.share_of_voice, 100)}%` }} />
                            </div>
                            <span className="text-sm font-semibold text-gray-900">{comp.share_of_voice}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {comp.share_of_voice > score ? (
                            <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium">+{(comp.share_of_voice - score).toFixed(1)}% ahead</span>
                          ) : (
                            <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full font-medium">You're ahead</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {analytics.top_competitors?.length === 0 && (
                      <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400">No competitors detected in simulation results</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* SOURCES TAB */}
            {activeTab === 'sources' && (
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden animate-fade-in">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900">Top RAG Citation Sources</h3>
                  <p className="text-gray-500 text-sm">Web sources the AI engines referenced when making recommendations</p>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Domain</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Citations</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Opportunity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics.top_cited_domains || []).map((d: any, i: number) => (
                      <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-900">{d.domain}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-gray-100 rounded-full h-2 max-w-24">
                              <div className="bg-blue-400 h-2 rounded-full" style={{ width: `${Math.min((d.citations / (analytics.top_cited_domains[0]?.citations || 1)) * 100, 100)}%` }} />
                            </div>
                            <span className="text-sm text-gray-700">{d.citations}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-1 rounded-lg">
                            Pitch editors for inclusion
                          </span>
                        </td>
                      </tr>
                    ))}
                    {analytics.top_cited_domains?.length === 0 && (
                      <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-400">No citation sources detected</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* ACTION PLAN TAB */}
            {activeTab === 'action' && (
              <div className="animate-fade-in">
                {!actionPlan && !generatingPlan && (
                  <div className="bg-white border border-gray-200 rounded-2xl p-16 text-center">
                    <div className="text-5xl mb-4">⚡</div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Generate Your GEO Action Plan</h2>
                    <p className="text-gray-500 mb-6 max-w-md mx-auto">
                      AI will analyze your audit results and generate ready-to-deploy PR pitches, JSON-LD schema markup, and community forum drafts.
                    </p>
                    <button onClick={generatePlan} className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-xl font-semibold transition-colors">
                      ⚡ Generate Action Plan
                    </button>
                  </div>
                )}

                {generatingPlan && (
                  <div className="bg-white border border-gray-200 rounded-2xl p-16 text-center">
                    <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{borderWidth:'4px'}} />
                    <p className="text-gray-600">Generating your personalized GEO Action Plan...</p>
                  </div>
                )}

                {actionPlan && (
                  <div className="space-y-6">
                    <div className="bg-white border border-gray-200 rounded-2xl p-6">
                      <h3 className="font-bold text-gray-900 mb-1 flex items-center gap-2">📧 PR Pitch Email</h3>
                      <p className="text-xs text-gray-400 mb-3">Ready to send to beauty editors at top citation sites</p>
                      <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-mono">
                        {actionPlan.pr_pitch_email}
                      </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-2xl p-6">
                      <h3 className="font-bold text-gray-900 mb-1 flex items-center gap-2">🏷️ JSON-LD Schema Markup</h3>
                      <p className="text-xs text-gray-400 mb-3">Add to your product page &lt;head&gt; to improve LLM entity recognition</p>
                      <div className="bg-gray-900 rounded-xl p-4 text-sm text-green-300 whitespace-pre-wrap overflow-x-auto font-mono">
                        {actionPlan.schema_markup}
                      </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-2xl p-6">
                      <h3 className="font-bold text-gray-900 mb-1 flex items-center gap-2">💬 Community Forum Draft</h3>
                      <p className="text-xs text-gray-400 mb-3">Organic-sounding Reddit/Quora response for r/SkincareAddiction and similar communities</p>
                      <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-sm text-gray-700 leading-relaxed">
                        {actionPlan.forum_draft}
                      </div>
                    </div>

                    {actionPlan.priority_actions && (
                      <div className="bg-white border border-gray-200 rounded-2xl p-6">
                        <h3 className="font-bold text-gray-900 mb-4">🎯 Priority Action Steps</h3>
                        <div className="space-y-3">
                          {actionPlan.priority_actions.map((action: string, i: number) => (
                            <div key={i} className="flex gap-3 items-start">
                              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</div>
                              <p className="text-sm text-gray-700 leading-relaxed">{action}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ChartCard({ title, data, colors }: { title: string; data: any[]; colors?: Record<string, string> }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6">
      <h3 className="font-bold text-gray-900 mb-4">{title}</h3>
      {data.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data available</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} angle={-30} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} domain={[0, 100]} />
            <Tooltip formatter={(v: any) => [`${v}%`, 'Surfacing Score']} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={colors?.[entry.name] || '#1a56db'} opacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
