import type { Metadata } from 'next'
import { ProductLandingPage } from '@/components/marketing/ProductLandingPage'
import { SerendipityField }   from '@/components/three/SerendipityField'
import { PRODUCT_WORDS }      from '@/components/brand/IDefinitionCycler'

export const metadata: Metadata = {
  title: 'iSurprise — Twelve things you weren\'t looking for.',
  description: 'High-quality content engineered beyond your usual interests. Serendipity as a service.',
}

const CROSS_SELL = [
  { name: 'iFeeds', tagline: 'Your curated interest feed.', href: '/sentry/iFeeds', accentColor: '#c084fc', icon: '◈' },
  { name: 'iChat', tagline: 'Explore surprises in depth.', href: '/sentry/iChat', accentColor: '#e879f9', icon: '◌' },
]

export default function ISurprisePage() {
  return (
    <ProductLandingPage
      config={{
        product: 'iSurprise',
        tagline: 'Twelve great things you weren\'t looking for.',
        taglineAccentWord: 'weren\'t',
        description: 'Algorithmically engineered serendipity. Articles scored for high quality AND low similarity to your usual interests. The best ideas come from outside your bubble.',
        heroWords: PRODUCT_WORDS.iSurprise,
        accentColor: '#f0abfc',
        icon: '✦',
        freeTierNote: 'Full access on the free tier — serendipity is universal.',
        features: [
          { icon: '✦', title: 'Engineered serendipity', description: 'Scored by (1 / interestScore) × relevance × recencyDecay. The math of surprise.' },
          { icon: '🌍', title: 'Beyond your bubble', description: 'Deliberately surfaces topics you don\'t usually follow — quality-first, novelty-second.' },
          { icon: '📰', title: '12 articles per visit', description: 'A curated dozen. Not infinite scrolling. Quality over quantity, always.' },
          { icon: '🎯', title: 'Relevance still matters', description: 'Surprising doesn\'t mean random. Articles still need to be high quality and timely.' },
          { icon: '🔗', title: 'Full article detail', description: 'Click any article for AI analysis, key topics, full text excerpt, and relevance breakdown.' },
          { icon: '♻️', title: 'Refreshes daily', description: 'New surprises every day. The algorithm evolves as your interests change.' },
        ],
        stats: [
          { value: 12, label: 'Articles per daily digest' },
          { value: 0, label: 'Filter bubbles reinforced' },
          { value: 100, suffix: '%', label: 'Algorithm-curated, zero sponsored' },
        ],
        faq: [
          { question: 'How is "surprise" calculated?', answer: 'Articles are scored using an inverse interest formula: the less it matches your topic profile, the higher its surprise score — but quality and recency are still required to pass a minimum threshold.' },
          { question: 'Will iSurprise show me things I\'ll hate?', answer: 'No. Low interest-score articles are still filtered for quality (editorial/credibility signals) and general relevance. It expands your bubble, not pops it.' },
          { question: 'Is iSurprise free forever?', answer: 'Yes, iSurprise is fully available on the free tier. Serendipity shouldn\'t be behind a paywall.' },
          { question: 'Can I customise what counts as a "surprise"?', answer: 'Exclusion lists and novelty weight are configurable in iSurprise settings (Pro roadmap).' },
        ],
        threeScene: SerendipityField,
        staticFallbackAlt: 'Particle field with one bright particle streaking through representing unexpected discovery',
        crossSell: CROSS_SELL,
      }}
    />
  )
}
