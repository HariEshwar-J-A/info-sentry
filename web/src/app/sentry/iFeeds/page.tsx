import type { Metadata } from 'next'
import { ProductLandingPage } from '@/components/marketing/ProductLandingPage'
import { OrbitingNodes }      from '@/components/three/OrbitingNodes'
import { PRODUCT_WORDS }      from '@/components/brand/IDefinitionCycler'

export const metadata: Metadata = {
  title: 'iFeeds — Read less. Understand more.',
  description: 'AI-curated news ranked by relevance to your topics. Pure intelligence, no noise.',
}

const CROSS_SELL = [
  { name: 'iChat', tagline: 'Your news in conversation.', href: '/sentry/iChat', accentColor: '#e879f9', icon: '◌' },
  { name: 'iSurprise', tagline: 'Beyond your usual topics.', href: '/sentry/iSurprise', accentColor: '#f0abfc', icon: '✦' },
]

export default function IFeedsPage() {
  return (
    <ProductLandingPage
      config={{
        product: 'iFeeds',
        tagline: 'Read less. Understand more.',
        taglineAccentWord: 'Understand',
        description: 'AI-curated news that learns your interests and ranks everything by relevance. No endless scrolling. No noise. Just the intelligence that matters to you.',
        heroWords: PRODUCT_WORDS.iFeeds,
        accentColor: '#c084fc',
        icon: '◈',
        freeTierNote: 'Up to 3 topics and 5 sources on the free tier.',
        features: [
          { icon: '🧠', title: 'AI relevance scoring', description: 'Every article scored against your topic profile. Only the signal, never the noise.' },
          { icon: '📡', title: '50+ source types', description: 'RSS feeds, Google News, web sources — all tracked and ranked per topic.' },
          { icon: '📊', title: 'Predictions engine', description: 'Beta: AI forecasts on tracked news threads with confidence scores and verification.' },
          { icon: '🔔', title: 'Smart notifications', description: 'Threshold-based alerts when relevance spikes above your set sensitivity.' },
          { icon: '🗂️', title: 'Topic clusters', description: 'Articles auto-grouped by semantic topic for fast scanning.' },
          { icon: '🔖', title: 'Bookmarks', description: 'Save articles to revisit. Your personal reading queue, synced.' },
        ],
        stats: [
          { value: 50, suffix: '+', label: 'Source types supported' },
          { value: 12, label: 'Articles scored per topic daily' },
          { value: 98, suffix: '%', label: 'Noise reduction vs raw feeds' },
        ],
        faq: [
          { question: 'How does the AI relevance scoring work?', answer: 'Each article is embedded and scored against a weighted vector of your topic keywords and past reading patterns. Articles above your threshold surface at the top.' },
          { question: 'What\'s the difference between topics and sources?', answer: 'Topics define what you care about (e.g., "AI research"). Sources are the feeds that supply articles (e.g., a specific blog). You can assign sources to topics for maximum control.' },
          { question: 'Is the predictions feature available now?', answer: 'Yes, as a beta feature. Enable it in iFeeds settings. AI-generated forecasts are labeled as speculative and tracked for verification over time.' },
          { question: 'Can I use iFeeds without setting up sources?', answer: 'Yes — Google News is included by default. Add your own RSS feeds and custom sources whenever you\'re ready.' },
        ],
        threeScene: OrbitingNodes,
        staticFallbackAlt: 'Network of orbiting nodes representing topics and articles connected by AI',
        crossSell: CROSS_SELL,
      }}
    />
  )
}
