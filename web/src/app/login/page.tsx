'use client'

import React, { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const ERROR_MESSAGES: Record<string, string> = {
  oauth_denied:    'Google sign-in was cancelled.',
  state_mismatch:  'Security check failed — please try again.',
  token_exchange:  'Failed to complete sign-in. Please try again.',
  userinfo:        'Could not retrieve your Google account info.',
  unauthorized:    'This account is not authorized. Use the link below if you were redirected here.',
}

function LoginForm() {
  const params  = useSearchParams()
  const [loading, setLoading] = useState(false)
  const errorKey = params.get('error')
  const errMsg   = errorKey ? (ERROR_MESSAGES[errorKey] ?? 'Sign-in failed. Please try again.') : null

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#f0f0f0', letterSpacing: '-0.02em' }}>
            Info<span style={{ color: '#6366f1' }}>Sentry</span>
          </div>
          <div style={{ fontSize: '13px', color: '#555', marginTop: '6px' }}>Personal intelligence dashboard</div>
        </div>

        {/* Error */}
        {errMsg && (
          <div style={{ marginBottom: '16px', padding: '10px 14px', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', fontSize: '13px', color: '#ef4444', textAlign: 'center' }}>
            {errMsg}
          </div>
        )}

        {/* Google sign-in button */}
        <a
          href="/api/auth/google"
          onClick={() => setLoading(true)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
            padding: '13px 20px', borderRadius: '10px',
            backgroundColor: loading ? '#1a1a1a' : '#fff',
            border: '1px solid #e0e0e0',
            color: loading ? '#555' : '#1a1a1a',
            fontSize: '15px', fontWeight: 600,
            textDecoration: 'none',
            transition: 'background 0.15s, opacity 0.15s',
            opacity: loading ? 0.7 : 1,
            cursor: loading ? 'default' : 'pointer',
            pointerEvents: loading ? 'none' : 'auto',
          }}
        >
          {/* Google logo SVG */}
          {!loading && (
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
          )}
          {loading ? 'Redirecting to Google…' : 'Continue with Google'}
        </a>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '11px', color: '#333' }}>
          Access restricted to authorised accounts only
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
