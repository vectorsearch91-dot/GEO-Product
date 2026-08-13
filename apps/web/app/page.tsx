'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

export default function LandingPage() {
  const router = useRouter()
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking')

  useEffect(() => {
    api.health()
      .then(() => setApiStatus('online'))
      .catch(() => setApiStatus('offline'))
  }, [])

  return (
    <div className="min-h-screen bg-[#0a1628] flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-400 rounded-xl flex items-center justify-center font-black text-white text-lg">G</div>
          <span className="text-white font-semibold text-lg">GEO Platform</span>
        </div>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 text-xs font-medium ${
            apiStatus === 'online' ? 'text-green-400' : apiStatus === 'offline' ? 'text-red-400' : 'text-yellow-400'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              apiStatus === 'online' ? 'bg-green-400' : apiStatus === 'offline' ? 'bg-red-400' : 'bg-yellow-400'
            }`} />
            API {apiStatus === 'checking' ? 'Connecting...' : apiStatus === 'online' ? 'Online' : 'Offline'}
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            Open Dashboard
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-600/10 border border-blue-500/20 rounded-full px-4 py-2 mb-8">
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
          <span className="text-blue-300 text-xs font-semibold tracking-wide uppercase">Generative Engine Optimization</span>
        </div>

        <h1 className="font-serif text-6xl md:text-7xl text-white leading-tight mb-6 max-w-4xl">
          Know if AI recommends<br />
          <span className="text-blue-400">your brand.</span>
        </h1>

        <p className="text-xl text-white/50 font-light max-w-2xl mb-12 leading-relaxed">
          The first enterprise platform to audit, benchmark, and actively optimize your product
          visibility inside ChatGPT, Google Gemini, Claude, and Perplexity.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mb-16">
          <button
            onClick={() => router.push('/products/new')}
            className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl text-base font-semibold transition-all shadow-lg shadow-blue-600/25 hover:shadow-blue-500/30"
          >
            Start Free Audit →
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-8 py-4 rounded-xl text-base font-semibold transition-colors"
          >
            View Dashboard
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-8 max-w-2xl w-full">
          {[
            { num: '4', label: 'AI engines audited simultaneously' },
            { num: '4.2B', label: 'Monthly AI assistant users globally' },
            { num: '0%', label: 'Current brand visibility in AI — for most' },
          ].map((s) => (
            <div key={s.num} className="text-center">
              <div className="text-4xl font-black text-white mb-1">{s.num}</div>
              <div className="text-xs text-white/40 leading-tight">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Features strip */}
      <div className="border-t border-white/5 px-8 py-10">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { icon: '📸', title: 'Vision Onboarding', desc: 'Upload product images — AI extracts everything in 15 seconds' },
            { icon: '🤖', title: 'Multi-LLM Audit', desc: '50+ queries per persona across GPT-4o, Gemini, Claude & Perplexity' },
            { icon: '🔍', title: 'Competitor Intel', desc: 'See exactly who wins in AI recommendations and why' },
            { icon: '⚡', title: 'Action Engine', desc: 'Get AI-ready PR pitches, schema markup & forum drafts' },
          ].map((f) => (
            <div key={f.title} className="flex flex-col gap-2">
              <div className="text-2xl">{f.icon}</div>
              <div className="text-sm font-semibold text-white">{f.title}</div>
              <div className="text-xs text-white/40 leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
