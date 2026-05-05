'use client'

import React, { useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LoginForm() {
  const router   = useRouter()
  const params   = useSearchParams()
  const userRef  = useRef<HTMLInputElement>(null)
  const [user, setUser] = useState('')
  const [pw, setPw]     = useState('')
  const [err, setErr]   = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErr(null)

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, password: pw }),
    })

    if (res.ok) {
      const next = params.get('next') ?? '/'
      router.push(next)
    } else {
      setErr('Invalid credentials')
      setPw('')
      setLoading(false)
      userRef.current?.focus()
    }
  }

  const inputStyle = (hasErr: boolean): React.CSSProperties => ({
    width: '100%', boxSizing: 'border-box',
    padding: '12px 14px', borderRadius: '10px',
    background: '#111', border: `1px solid ${hasErr ? 'rgba(239,68,68,0.5)' : '#2a2a2a'}`,
    color: '#f0f0f0', fontSize: '15px', outline: 'none',
  })

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#f0f0f0', letterSpacing: '-0.02em' }}>
            Info<span style={{ color: '#6366f1' }}>Sentry</span>
          </div>
          <div style={{ fontSize: '13px', color: '#555', marginTop: '6px' }}>Personal intelligence dashboard</div>
        </div>

        <form onSubmit={e => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            ref={userRef}
            type="text"
            value={user}
            onChange={e => setUser(e.target.value)}
            placeholder="Username"
            autoComplete="username"
            autoFocus
            required
            style={inputStyle(!!err)}
          />
          <input
            type="password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            required
            style={inputStyle(!!err)}
          />

          {err && (
            <div style={{ fontSize: '12px', color: '#ef4444', textAlign: 'center' }}>{err}</div>
          )}

          <button
            type="submit"
            disabled={loading || !user || !pw}
            style={{
              padding: '12px', borderRadius: '10px', border: 'none',
              background: loading || !user || !pw ? '#1a1a1a' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: loading || !user || !pw ? '#555' : '#fff',
              fontSize: '14px', fontWeight: 600,
              cursor: loading || !user || !pw ? 'default' : 'pointer',
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '11px', color: '#333' }}>
          Protected by app-level password auth
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
