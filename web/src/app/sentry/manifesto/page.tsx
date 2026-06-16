import type { Metadata } from 'next'
import Link from 'next/link'
import { AuroraBackground } from '@/components/marketing/AuroraBackground'

export const metadata: Metadata = {
  title: 'The i Manifesto — infoSentry',
  description: 'i is not a company prefix. i is what you want it to be.',
}

const I_DEFINITIONS = [
  { word: 'intelligence',  def: 'Not just information. The capacity to understand, connect, and act on what you know.' },
  { word: 'innovation',    def: 'The refusal to accept that the current tool is the best possible tool.' },
  { word: 'imagination',   def: 'Seeing what could be before anyone else admits it can exist.' },
  { word: 'insight',       def: 'The moment signal becomes meaning. The goal of everything we build.' },
  { word: 'intuition',     def: 'The intelligence you\'ve earned through enough exposure to a domain.' },
  { word: 'ingenuity',     def: 'Solving problems that didn\'t have a name before you solved them.' },
  { word: 'impact',        def: 'The only metric that actually matters. Everything else is a proxy.' },
  { word: 'inspiration',   def: 'The spark you didn\'t know you needed, arriving from an unexpected direction.' },
  { word: 'invention',     def: 'Building the tools you wish existed. Then sharing them.' },
  { word: 'instinct',      def: 'The pattern recognition that precedes articulation. Trust it, then verify it.' },
  { word: 'you',           def: 'The whole point. Every product exists to amplify what you\'re already capable of.' },
]

export default function ManifestoPage() {
  return (
    <>
      <AuroraBackground intensity="medium">
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '100px 24px 80px', textAlign: 'center' }}>
          <h1 style={{
            fontFamily: 'Sora, sans-serif',
            fontSize: 'clamp(40px, 7vw, 88px)',
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.04em',
            lineHeight: 1,
            marginBottom: 32,
          }}>
            i ≠ Apple.
          </h1>
          <p style={{ fontSize: 'clamp(16px, 2vw, 20px)', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>
            The i in infoSentry doesn&apos;t belong to any corporation. It belongs to whoever is reading this.
          </p>
          <p style={{ fontSize: 'clamp(16px, 2vw, 20px)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            It&apos;s a letter I chose because it can mean anything I want. Anything <em>you</em> want.
          </p>
        </div>
      </AuroraBackground>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '60px 24px 120px' }}>
        {I_DEFINITIONS.map((item, i) => (
          <div
            key={item.word}
            style={{
              display: 'grid',
              gridTemplateColumns: '180px 1fr',
              gap: 32,
              paddingTop: 48,
              paddingBottom: 48,
              borderBottom: i < I_DEFINITIONS.length - 1 ? '1px solid var(--border)' : 'none',
              alignItems: 'start',
            }}
          >
            <div>
              <span style={{
                fontFamily: 'Sora, sans-serif',
                fontSize: 'clamp(22px, 3vw, 36px)',
                fontWeight: 800,
                color: item.word === 'you' ? 'var(--violet-300)' : 'var(--text-primary)',
                letterSpacing: '-0.03em',
                fontStyle: item.word === 'you' ? 'italic' : 'normal',
              }}>
                {item.word}
              </span>
            </div>
            <p style={{
              fontSize: 18,
              color: 'var(--text-secondary)',
              lineHeight: 1.7,
              margin: 0,
              paddingTop: 6,
            }}>
              {item.def}
            </p>
          </div>
        ))}

        <div style={{ marginTop: 80, textAlign: 'center' }}>
          <p style={{
            fontFamily: 'Sora, sans-serif',
            fontSize: 28,
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            marginBottom: 24,
          }}>
            Now go use the tools.
          </p>
          <Link
            href="/sentry"
            style={{
              display: 'inline-block',
              padding: '14px 32px',
              borderRadius: 10,
              fontSize: 16,
              fontWeight: 600,
              background: 'var(--violet-500)',
              color: '#fff',
              textDecoration: 'none',
            }}
          >
            Explore the products →
          </Link>
        </div>
      </div>
    </>
  )
}
