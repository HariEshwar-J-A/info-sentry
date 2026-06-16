import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSessionUserId } from '@/lib/session'
import {
  Rss, Brain, Inbox, Shield, Lock, Globe, Zap,
  GitBranch, MessageSquare, TrendingUp, Target, Bell,
  ArrowRight, Activity, Database,
  Newspaper, BarChart2, ShieldCheck,
} from 'lucide-react'

export default async function Home() {
  const userId = await getSessionUserId()
  if (userId) redirect('/iFeeds')

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-ring {
          0%   { box-shadow: 0 0 0 0 rgba(99,102,241,0.4); }
          70%  { box-shadow: 0 0 0 10px rgba(99,102,241,0); }
          100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); }
        }
        @keyframes scanline {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        .fade-up-1 { animation: fadeUp 0.6s ease forwards; }
        .fade-up-2 { animation: fadeUp 0.6s 0.15s ease both; }
        .fade-up-3 { animation: fadeUp 0.6s 0.3s ease both; }
        .fade-up-4 { animation: fadeUp 0.6s 0.45s ease both; }
        .dot-grid {
          background-image: radial-gradient(circle, #1e1e2e 1px, transparent 1px);
          background-size: 28px 28px;
        }
        .gradient-text {
          background: linear-gradient(120deg, #e0e0ff 0%, #818cf8 40%, #6366f1 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .card-hover {
          transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
        }
        .card-hover:hover {
          border-color: #4338ca;
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(99,102,241,0.12);
        }
        .glow-btn {
          position: relative;
          transition: all 0.2s ease;
        }
        .glow-btn:hover {
          box-shadow: 0 0 20px rgba(99,102,241,0.5);
          transform: translateY(-1px);
        }
        .step-connector {
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, #4338ca, transparent 50%, #4338ca);
          opacity: 0.4;
          margin-top: 28px;
        }
        .badge-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          background: rgba(99,102,241,0.08);
          border: 1px solid rgba(99,102,241,0.2);
          border-radius: 100px;
          font-size: 0.75rem;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          color: #a5b4fc;
          white-space: nowrap;
          transition: background 0.2s ease, border-color 0.2s ease;
        }
        .badge-pill:hover {
          background: rgba(99,102,241,0.15);
          border-color: rgba(99,102,241,0.4);
        }
        .nav-signin:hover {
          border-color: #6366f1 !important;
          color: #c7d2fe !important;
        }
        .noise-overlay {
          position: fixed;
          inset: 0;
          pointer-events: none;
          opacity: 0.025;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
          background-size: 128px;
          z-index: 0;
        }
      `}</style>

      {/* Noise texture overlay */}
      <div className="noise-overlay" aria-hidden="true" />

      <div className="dot-grid" style={{ minHeight: '100vh', width: '100%', position: 'relative' }}>

        {/* ── NAV ─────────────────────────────────────────────── */}
        <nav style={{
          position: 'sticky', top: 0, zIndex: 50,
          borderBottom: '1px solid #1a1a2e',
          backdropFilter: 'blur(12px)',
          backgroundColor: 'rgba(10,10,10,0.85)',
        }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* InfoSentry "i" mark — dot on top pulsates via pulse-ring keyframe */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#6366f1', animation: 'pulse-ring 2s infinite' }} />
                <div style={{ width: 4, height: 11, borderRadius: 2, backgroundColor: '#c7d2fe' }} />
              </div>
              <span style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.02em', color: '#f0f0f0' }}>
                Info<span style={{ color: '#6366f1' }}>Sentry</span>
              </span>
            </div>
            <Link
              href="/api/auth/google"
              className="nav-signin"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 18px', borderRadius: 8,
                backgroundColor: 'transparent',
                border: '1px solid #2a2a3e',
                color: '#a5b4fc', fontSize: '0.875rem', fontWeight: 500,
                textDecoration: 'none', transition: 'all 0.2s ease',
              }}
            >
              Sign In <ArrowRight size={14} />
            </Link>
          </div>
        </nav>

        {/* ── HERO ────────────────────────────────────────────── */}
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '100px 24px 80px', textAlign: 'center' }}>
          <div className="fade-up-1" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 14px', borderRadius: 100, backgroundColor: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', marginBottom: 28 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block' }} />
            <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#a5b4fc', letterSpacing: '0.05em' }}>PERSONAL · AI-POWERED · PRIVATE</span>
          </div>

          <h1 className="fade-up-2 gradient-text" style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.03em', marginBottom: 24 }}>
            Your personal<br />intelligence layer.
          </h1>

          <p className="fade-up-3" style={{ fontSize: '1.125rem', color: '#8888aa', maxWidth: 560, margin: '0 auto 40px', lineHeight: 1.7 }}>
            Signal, not noise. AI-curated news, predictions, and GitHub trends —
            delivered to you, not the algorithm.
          </p>

          <div className="fade-up-4" style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              href="/api/auth/google"
              className="glow-btn"
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '13px 28px', borderRadius: 10,
                backgroundColor: '#6366f1', color: '#fff',
                fontWeight: 600, fontSize: '0.95rem', textDecoration: 'none',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Get Started with Google
            </Link>
            <a
              href="#how-it-works"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '13px 24px', borderRadius: 10,
                border: '1px solid #2a2a3e',
                color: '#9090b0', fontWeight: 500, fontSize: '0.95rem',
                textDecoration: 'none', transition: 'all 0.2s ease',
              }}
            >
              See how it works ↓
            </a>
          </div>

          {/* Stats strip */}
          <div style={{ marginTop: 64, display: 'flex', gap: 40, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { v: '50+', l: 'Sources monitored' },
              { v: 'LLM', l: 'Relevance scoring' },
              { v: '6h', l: 'Update cadence' },
              { v: '0', l: 'Ads. Ever.' },
            ].map(({ v, l }) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#6366f1', fontFamily: 'monospace', letterSpacing: '-0.02em' }}>{v}</div>
                <div style={{ fontSize: '0.8rem', color: '#555570', marginTop: 4 }}>{l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── PIPELINE ─────────────────────────────────────────── */}
        <section id="how-it-works" style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ fontSize: '0.7rem', fontFamily: 'monospace', letterSpacing: '0.15em', color: '#6366f1', marginBottom: 12 }}>HOW IT WORKS</div>
            <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 700, color: '#f0f0f0', letterSpacing: '-0.02em' }}>
              From raw internet to refined intelligence
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
            {[
              {
                n: '1', icon: <Rss size={22} color="#6366f1" />, title: 'Scout',
                sub: 'Monitors 50+ sources — RSS, web, GitHub, YouTube',
                detail: 'Continuously scrapes configured sources and detects new content matching your interest profile.',
              },
              null,
              {
                n: '2', icon: <Brain size={22} color="#6366f1" />, title: 'Analyst',
                sub: 'LLM summarizes and scores relevance to your interests',
                detail: 'Each article gets a relevance score, sentiment score, key topics, and a concise 4-paragraph summary.',
              },
              null,
              {
                n: '3', icon: <Inbox size={22} color="#6366f1" />, title: 'You',
                sub: 'Clean feed, predictions, Telegram digests — only what matters',
                detail: 'High-relevance content surfaces to your feed. Everything else is filtered so you never see noise.',
              },
            ].map((step, i) => {
              if (step === null) return <div key={i} className="step-connector" />
              return (
                <div key={step.n} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    backgroundColor: 'rgba(99,102,241,0.1)',
                    border: '2px solid #4338ca',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px',
                  }}>
                    {step.icon}
                  </div>
                  <div style={{ fontSize: '0.65rem', fontFamily: 'monospace', color: '#6366f1', letterSpacing: '0.1em', marginBottom: 6 }}>STEP {step.n}</div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f0f0f0', marginBottom: 8 }}>{step.title}</h3>
                  <p style={{ fontSize: '0.875rem', color: '#6868888', marginBottom: 10, fontWeight: 500 }}>{step.sub}</p>
                  <p style={{ fontSize: '0.8rem', color: '#555570', lineHeight: 1.6 }}>{step.detail}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── FEATURES ─────────────────────────────────────────── */}
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: '0.7rem', fontFamily: 'monospace', letterSpacing: '0.15em', color: '#6366f1', marginBottom: 12 }}>CAPABILITIES</div>
            <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 700, color: '#f0f0f0', letterSpacing: '-0.02em' }}>
              Everything signal. Nothing noise.
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {[
              {
                icon: <Newspaper size={20} color="#6366f1" />,
                title: 'AI Feed',
                desc: 'Articles scored by relevance to your interests, not engagement bait or trending noise.',
              },
              {
                icon: <Target size={20} color="#6366f1" />,
                title: 'Predictions',
                desc: 'AI-generated forecasts with confidence scores, time horizons, and evidence tracking.',
              },
              {
                icon: <GitBranch size={20} color="#6366f1" />,
                title: 'GitHub Intelligence',
                desc: 'Trending repositories analyzed and summarized daily — stars, language, use case.',
              },
              {
                icon: <Database size={20} color="#6366f1" />,
                title: 'Multi-Source',
                desc: 'RSS, web scraping, GitHub API, YouTube — all unified into one coherent feed.',
              },
              {
                icon: <BarChart2 size={20} color="#6366f1" />,
                title: 'Interest Scoring',
                desc: 'React to articles and the relevance model adapts. The more you engage, the smarter it gets.',
              },
              {
                icon: <Bell size={20} color="#6366f1" />,
                title: 'Telegram Digests',
                desc: 'Daily briefs, run logs, and critical alerts. Never spam — only what warrants your attention.',
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="card-hover" style={{
                padding: '24px',
                backgroundColor: '#0e0e16',
                border: '1px solid #1e1e2e',
                borderRadius: 12,
              }}>
                <div style={{ marginBottom: 14, width: 40, height: 40, borderRadius: 8, backgroundColor: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {icon}
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f0f0f0', marginBottom: 8 }}>{title}</h3>
                <p style={{ fontSize: '0.875rem', color: '#666680', lineHeight: 1.65 }}>{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECURITY ─────────────────────────────────────────── */}
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '60px 24px' }}>
          <div style={{
            padding: '40px 32px',
            backgroundColor: '#0a0a14',
            border: '1px solid #1e1e2e',
            borderRadius: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
              <ShieldCheck size={20} color="#22c55e" />
              <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', letterSpacing: '0.1em', color: '#22c55e' }}>SECURITY</span>
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f0f0f0', marginBottom: 24 }}>
              Built for personal use. Locked down accordingly.
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {[
                { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="#4285F4"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>, label: 'Google OAuth only' },
                { icon: <Lock size={12} color="#a5b4fc" />, label: 'HMAC-SHA256 sessions' },
                { icon: <Shield size={12} color="#a5b4fc" />, label: 'No passwords stored' },
                { icon: <Globe size={12} color="#a5b4fc" />, label: 'Cloudflare Tunnel (no open ports)' },
                { icon: <Zap size={12} color="#a5b4fc" />, label: '2-year HSTS preload' },
                { icon: <Activity size={12} color="#a5b4fc" />, label: 'Allowlist-gated access' },
              ].map(({ icon, label }) => (
                <div key={label} className="badge-pill">
                  {icon}
                  {label}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── USE CASES ─────────────────────────────────────────── */}
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '60px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: '0.7rem', fontFamily: 'monospace', letterSpacing: '0.15em', color: '#6366f1', marginBottom: 12 }}>WHO IT&apos;S FOR</div>
            <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 700, color: '#f0f0f0', letterSpacing: '-0.02em' }}>
              For the perpetually curious professional
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 16 }}>
            {[
              {
                icon: <TrendingUp size={20} color="#818cf8" />,
                role: 'The Analyst',
                desc: 'Tracks market signals, policy changes, and macro trends. Gets the 3-sentence summary before the morning brief.',
                tags: ['Markets', 'Policy', 'Macro'],
              },
              {
                icon: <GitBranch size={20} color="#818cf8" />,
                role: 'The Developer',
                desc: 'Monitors OSS activity, trending repos, and tech news. Never misses a meaningful shift in the ecosystem.',
                tags: ['GitHub', 'OSS', 'Tech'],
              },
              {
                icon: <MessageSquare size={20} color="#818cf8" />,
                role: 'The Researcher',
                desc: 'Follows niche topics across dozens of sources simultaneously. Gets signal without drowning in feeds.',
                tags: ['Niche topics', 'RSS', 'Deep focus'],
              },
            ].map(({ icon, role, desc, tags }) => (
              <div key={role} className="card-hover" style={{
                padding: '28px',
                backgroundColor: '#0e0e16',
                border: '1px solid #1e1e2e',
                borderRadius: 12,
                borderLeft: '3px solid #4338ca',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  {icon}
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f0f0f0' }}>{role}</h3>
                </div>
                <p style={{ fontSize: '0.875rem', color: '#666680', lineHeight: 1.65, marginBottom: 18 }}>{desc}</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {tags.map(t => (
                    <span key={t} style={{
                      fontSize: '0.7rem', fontFamily: 'monospace', padding: '3px 10px',
                      borderRadius: 100, backgroundColor: 'rgba(99,102,241,0.08)',
                      border: '1px solid rgba(99,102,241,0.15)', color: '#7070a0',
                    }}>{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── FINAL CTA ─────────────────────────────────────────── */}
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '60px 24px 80px' }}>
          <div style={{
            padding: '56px 40px',
            backgroundColor: '#0a0a18',
            border: '1px solid #1e1e30',
            borderRadius: 20,
            textAlign: 'center',
            background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 70%), #0a0a18',
          }}>
            <div style={{ fontSize: '0.7rem', fontFamily: 'monospace', letterSpacing: '0.15em', color: '#6366f1', marginBottom: 20 }}>READY?</div>
            <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', fontWeight: 700, color: '#f0f0f0', letterSpacing: '-0.02em', marginBottom: 16 }}>
              Ready to cut through the noise?
            </h2>
            <p style={{ fontSize: '1rem', color: '#666680', marginBottom: 36, maxWidth: 440, margin: '0 auto 36px' }}>
              Access is allowlist-gated. If you&apos;ve been invited, your Google account is ready to go.
            </p>
            <Link
              href="/api/auth/google"
              className="glow-btn"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '14px 32px', borderRadius: 10,
                backgroundColor: '#6366f1', color: '#fff',
                fontWeight: 600, fontSize: '1rem', textDecoration: 'none',
              }}
            >
              Sign in with Google
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>

        {/* ── FOOTER ─────────────────────────────────────────────── */}
        <footer style={{
          borderTop: '1px solid #141420',
          padding: '28px 24px',
          textAlign: 'center',
          color: '#333350',
          fontSize: '0.8rem',
          fontFamily: 'monospace',
          letterSpacing: '0.05em',
        }}>
          InfoSentry · Personal AI Intelligence · Built for signal, not scale
        </footer>

      </div>
    </>
  )
}
