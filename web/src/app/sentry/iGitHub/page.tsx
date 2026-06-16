import type { Metadata } from 'next'
import { ProductLandingPage } from '@/components/marketing/ProductLandingPage'
import { RepoGlobe }          from '@/components/three/RepoGlobe'
import { PRODUCT_WORDS }      from '@/components/brand/IDefinitionCycler'

export const metadata: Metadata = {
  title: 'iGitHub — The pulse of open source.',
  description: 'Trending repos ranked for what you care about. Dev intelligence, daily.',
}

const CROSS_SELL = [
  { name: 'iFeeds', tagline: 'News for the same topics.', href: '/sentry/iFeeds', accentColor: '#c084fc', icon: '◈' },
  { name: 'iChat', tagline: 'Talk through what you find.', href: '/sentry/iChat', accentColor: '#e879f9', icon: '◌' },
]

export default function IGitHubPage() {
  return (
    <ProductLandingPage
      config={{
        product: 'iGitHub',
        tagline: 'The pulse of open source, ranked for you.',
        taglineAccentWord: 'ranked',
        description: 'Discover trending GitHub repositories filtered by language, topic, and your interests. Fresh daily. No GitHub browsing required.',
        heroWords: PRODUCT_WORDS.iGitHub,
        accentColor: '#a78bfa',
        icon: '⬡',
        freeTierNote: 'Up to 20 repositories tracked on the free tier.',
        features: [
          { icon: '📈', title: 'Trending repos daily', description: 'Stars, forks, activity and growth velocity — all factored into your personalised ranking.' },
          { icon: '🔍', title: 'Language & topic filters', description: 'Slice by programming language, GitHub topics, or free-text search.' },
          { icon: '🔄', title: 'Auto-refresh', description: 'Refreshes every 90 seconds on focus. Never stale, never overloaded.' },
          { icon: '⭐', title: 'Unread tracking', description: 'Repos you haven\'t seen yet are surfaced prominently. Clean your queue at your pace.' },
          { icon: '🗂️', title: 'Topic integration', description: 'GitHub intelligence feeds back into your iFeeds topics for a unified view.' },
          { icon: '📋', title: 'Rich repo detail', description: 'Description, stars, forks, language, and direct links — all at a glance.' },
        ],
        stats: [
          { value: 1000, suffix: '+', label: 'Repos indexed daily' },
          { value: 90, label: 'Second auto-refresh interval' },
          { value: 20, suffix: '+', label: 'Language filters' },
        ],
        faq: [
          { question: 'Does this connect to my GitHub account?', answer: 'No auth needed. iGitHub aggregates public trending data. A future version may let you track private repos with a PAT.' },
          { question: 'How is "trending" calculated?', answer: 'Star velocity (new stars per day), recent commits, fork count, and topic relevance to your interests are all weighted together.' },
          { question: 'Can I track specific repos?', answer: 'Not yet — iGitHub currently surfaces trending content. Specific repo watch-lists are on the Pro roadmap.' },
          { question: 'Is data real-time?', answer: 'The pipeline runs on a schedule and the frontend auto-refreshes every 90 seconds. For most dev workflows this is effectively live.' },
        ],
        threeScene: RepoGlobe,
        staticFallbackAlt: 'Rotating globe with dots representing trending repositories across the world',
        crossSell: CROSS_SELL,
      }}
    />
  )
}
