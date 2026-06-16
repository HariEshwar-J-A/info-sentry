import type { Metadata } from 'next'
import { ProductLandingPage } from '@/components/marketing/ProductLandingPage'
import { ChatOrb }            from '@/components/three/ChatOrb'
import { PRODUCT_WORDS }      from '@/components/brand/IDefinitionCycler'

export const metadata: Metadata = {
  title: 'iChat — Your context. In conversation.',
  description: 'AI chat grounded in your feeds, code, and context. Not generic. Specifically yours.',
}

const CROSS_SELL = [
  { name: 'iFeeds', tagline: 'Feed the conversation context.', href: '/sentry/iFeeds', accentColor: '#c084fc', icon: '◈' },
  { name: 'iVideos', tagline: 'Discuss transcripts in depth.', href: '/sentry/iVideos', accentColor: '#818cf8', icon: '▷' },
]

export default function IChatPage() {
  return (
    <ProductLandingPage
      config={{
        product: 'iChat',
        tagline: 'Your news, your code, your context — in conversation.',
        taglineAccentWord: 'conversation',
        description: 'Stateful AI conversations that stay on topic because they\'re grounded in your actual interests. Ask about the news you read. Explore the repos you track. Think out loud.',
        heroWords: PRODUCT_WORDS.iChat,
        accentColor: '#e879f9',
        icon: '◌',
        freeTierNote: 'Up to 20 messages per day on the free tier.',
        features: [
          { icon: '💬', title: 'Persistent sessions', description: 'Every conversation is saved with a title and preview. Resume exactly where you left off.' },
          { icon: '🔄', title: 'Streaming responses', description: 'Responses stream as they\'re generated. No waiting for long answers.' },
          { icon: '🗂️', title: 'Session history', description: 'Side panel lists all your conversations. Jump to any session instantly.' },
          { icon: '🧠', title: 'Grounded in your context', description: 'Optional: pass your current iFeeds articles or transcript excerpts as context before asking.' },
          { icon: '⚡', title: 'Multi-model', description: 'Switch between available AI models per session based on task complexity.' },
          { icon: '🔒', title: 'Private by design', description: 'Your conversations are scoped to your user ID. No shared history, no training on your data.' },
        ],
        stats: [
          { value: 20, label: 'Messages free per day' },
          { value: 100, suffix: 'ms', label: 'Average time-to-first-token' },
          { value: 0, label: 'Data shared for AI training' },
        ],
        faq: [
          { question: 'Which AI model does iChat use?', answer: 'By default iChat uses a fast balanced model (configurable in iChat settings). Pro users can select from a wider range including premium models.' },
          { question: 'Is my conversation data private?', answer: 'Yes. All sessions are user-scoped — only you can access them. Your messages are never used for AI training.' },
          { question: 'Can I use iChat without iFeeds or iVideos?', answer: 'Absolutely. iChat works as a standalone AI chat. The context-injection from other products is optional and additive.' },
          { question: 'What counts as one message toward the free limit?', answer: 'Each user turn counts as one message. Streaming tokens from the AI response are tracked against the $1/mo compute budget, not as message counts.' },
        ],
        threeScene: ChatOrb,
        staticFallbackAlt: 'Glowing violet orb with orbiting ring representing AI intelligence in conversation',
        crossSell: CROSS_SELL,
      }}
    />
  )
}
