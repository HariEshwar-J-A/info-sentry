'use client'

import { useState, Suspense } from 'react'
import { useSearchParams }    from 'next/navigation'
import { AuroraBackground }   from '@/components/marketing/AuroraBackground'

const PRODUCT_NAMES: Record<string, string> = {
  iFeeds: 'iFeeds', iGitHub: 'iGitHub', iVideos: 'iVideos', iChat: 'iChat', iSurprise: 'iSurprise',
}

function WaitlistForm() {
  const params  = useSearchParams()
  const product = params.get('product') ?? ''
  const bundle  = params.get('bundle') ?? ''

  const products = bundle
    ? bundle.split(',').filter(p => PRODUCT_NAMES[p])
    : product && PRODUCT_NAMES[product] ? [product] : []

  const [email, setEmail]   = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || status === 'loading') return
    setStatus('loading')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, products }),
      })
      setStatus(res.ok ? 'done' : 'error')
    } catch {
      setStatus('error')
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Join the infoSentry waitlist" noValidate>
      <div style={{ marginBottom: 16 }}>
        <label htmlFor="waitlist-email" style={{ display: 'block', fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>
          Email address
        </label>
        <input
          id="waitlist-email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          placeholder="you@example.com"
          aria-required="true"
          aria-describedby="waitlist-email-hint"
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 9,
            border: '1px solid var(--border-strong)',
            background: 'var(--surface)',
            color: 'var(--text-primary)',
            fontSize: 16,
            fontFamily: 'Inter, sans-serif',
            outline: 'none',
          }}
        />
        <p id="waitlist-email-hint" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
          We&apos;ll notify you when paid plans launch. No spam.
        </p>
      </div>
      <button
        type="submit"
        disabled={status === 'loading' || status === 'done'}
        aria-busy={status === 'loading'}
        style={{
          width: '100%',
          padding: '13px 24px',
          borderRadius: 9,
          fontSize: 15,
          fontWeight: 600,
          background: 'var(--violet-500)',
          color: '#fff',
          border: 'none',
          cursor: status === 'loading' || status === 'done' ? 'not-allowed' : 'pointer',
          opacity: status === 'loading' || status === 'done' ? 0.7 : 1,
        }}
      >
        {status === 'loading' ? 'Joining…' : status === 'done' ? 'You\'re on the list ✓' : 'Join the waitlist'}
      </button>
      {status === 'error' && (
        <p role="alert" style={{ fontSize: 14, color: 'var(--negative)', marginTop: 10 }}>
          Something went wrong. Please try again.
        </p>
      )}
    </form>
  )
}

export default function WaitlistPage() {
  return (
    <AuroraBackground intensity="medium" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '80px 24px', width: '100%' }}>
        <h1 style={{
          fontFamily: 'Sora, sans-serif',
          fontSize: 'clamp(28px, 4vw, 44px)',
          fontWeight: 800,
          color: 'var(--text-primary)',
          letterSpacing: '-0.03em',
          marginBottom: 16,
        }}>
          Get early access.
        </h1>
        <p style={{ fontSize: 17, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 40 }}>
          Paid plans with higher limits and bundle discounts are coming. Join the waitlist and you&apos;ll be the first to know — and get a launch discount.
        </p>
        <div style={{
          padding: 28,
          borderRadius: 14,
          border: '1px solid var(--border)',
          background: 'rgba(22,22,54,0.8)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}>
          <Suspense fallback={null}>
            <WaitlistForm />
          </Suspense>
        </div>
      </div>
    </AuroraBackground>
  )
}
