import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'GEO Platform — AI Search Visibility for Enterprise Brands',
  description: 'Audit, benchmark, and optimize your brand visibility inside ChatGPT, Gemini, Claude, and Perplexity.',
  keywords: 'GEO, generative engine optimization, AI search, brand visibility, ChatGPT, LLM',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
