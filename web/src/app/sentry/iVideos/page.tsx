import type { Metadata } from 'next'
import { ProductLandingPage } from '@/components/marketing/ProductLandingPage'
import { VideoCarousel3D }    from '@/components/three/VideoCarousel3D'
import { PRODUCT_WORDS }      from '@/components/brand/IDefinitionCycler'

export const metadata: Metadata = {
  title: 'iVideos — Channels you trust. Transcripts on demand.',
  description: 'Subscribe to YouTube channels and get AI transcripts and summaries without the algorithmic rabbit hole.',
}

const CROSS_SELL = [
  { name: 'iChat', tagline: 'Discuss what you watched.', href: '/sentry/iChat', accentColor: '#e879f9', icon: '◌' },
  { name: 'iFeeds', tagline: 'The written equivalent.', href: '/sentry/iFeeds', accentColor: '#c084fc', icon: '◈' },
]

export default function IVideosPage() {
  return (
    <ProductLandingPage
      config={{
        product: 'iVideos',
        tagline: 'Channels you trust. Transcripts on demand.',
        taglineAccentWord: 'Transcripts',
        description: 'Manage the YouTube channels that matter to you. Get AI-powered transcripts and summaries without the algorithm pushing you elsewhere.',
        heroWords: PRODUCT_WORDS.iVideos,
        accentColor: '#818cf8',
        icon: '▷',
        freeTierNote: 'Up to 3 channels on the free tier. AI summaries require Pro.',
        features: [
          { icon: '📺', title: 'Channel subscriptions', description: 'Add any YouTube channel by URL. iVideos resolves it to a canonical channel ID automatically.' },
          { icon: '📝', title: 'On-demand transcripts', description: 'Groq Whisper transcription triggered with one click. Transcripts stored for offline reading.' },
          { icon: '🤖', title: 'AI summaries', description: 'Full-video summaries generated in seconds. Know the key points before you hit play.' },
          { icon: '🔍', title: 'Search across transcripts', description: 'Full-text search across all stored transcripts. Find the moment that matters.' },
          { icon: '📌', title: 'Viewed tracking', description: 'Videos you\'ve seen are marked. Your queue stays clean without YouTube\'s watch history.' },
          { icon: '📄', title: 'Paginated library', description: 'Infinitely scrolling video library, paginated cleanly. 20 per page, fully searchable.' },
        ],
        stats: [
          { value: 3, label: 'Channels free forever' },
          { value: 30, label: 'Second average transcript time' },
          { value: 100, suffix: '%', label: 'Algorithm-free browsing' },
        ],
        faq: [
          { question: 'Do I need a YouTube API key?', answer: 'No. iVideos fetches channel metadata via the public YouTube interface. Transcription uses Groq Whisper on the audio — no YouTube API quota consumed.' },
          { question: 'How fast are transcripts generated?', answer: 'Typically 20–45 seconds for a standard-length video. Groq\'s Whisper API is fast; time scales with video length.' },
          { question: 'Are transcripts stored permanently?', answer: 'Yes. Once generated, the transcript is saved to your account and searchable indefinitely.' },
          { question: 'Can I add channels from other platforms?', answer: 'YouTube is the primary platform. Other video platforms are on the roadmap.' },
        ],
        threeScene: VideoCarousel3D,
        staticFallbackAlt: 'Curved 3D ribbon of video thumbnails representing your channel subscriptions',
        crossSell: CROSS_SELL,
      }}
    />
  )
}
