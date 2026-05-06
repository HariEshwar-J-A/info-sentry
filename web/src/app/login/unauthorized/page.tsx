'use client'

import React from 'react'
import Link from 'next/link'

const PORTFOLIO_HOME = 'https://harieshwar.dev'

export default function UnauthorizedLoginPage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#f0f0f0', letterSpacing: '-0.02em' }}>
            Info<span style={{ color: '#6366f1' }}>Sentry</span>
          </div>
          <div style={{ fontSize: '13px', color: '#555', marginTop: '6px' }}>Sign-in required</div>
        </div>

        <div style={{ padding: '28px 24px', backgroundColor: '#111', border: '1px solid #2a2a2a', borderRadius: '14px', marginBottom: '24px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }} aria-hidden>🔒</div>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#f0f0f0', margin: '0 0 10px', lineHeight: 1.35 }}>
            Unable to sign in
          </h1>
          <p style={{ fontSize: '14px', color: '#8a8a8a', lineHeight: 1.6, margin: 0 }}>
            This Google account is not authorized to use Info Sentry. If you believe this is a mistake,
            contact the site owner or sign in with an approved account.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <a
            href={PORTFOLIO_HOME}
            rel="noopener noreferrer"
            style={{
              display: 'block',
              padding: '12px 18px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Back to harieshwar.dev
          </a>
          <Link
            href="/login"
            style={{
              display: 'block',
              padding: '11px 18px',
              borderRadius: '10px',
              border: '1px solid #2a2a2a',
              background: 'transparent',
              color: '#8a8a8a',
              fontSize: '13px',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Try a different account
          </Link>
        </div>
      </div>
    </div>
  )
}
