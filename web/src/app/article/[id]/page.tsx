import { notFound } from 'next/navigation'
import Link from 'next/link'
import { TopBar } from '@/components/shell/TopBar'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { PredictionCard } from '@/components/article/PredictionCard'
import { VoiceReader } from '@/components/article/VoiceReader'
import { ArticleChatPanel } from '@/components/article/ArticleChatPanel'
import { getArticleDetail } from '@/lib/feed'

type ArticleDetail = NonNullable<Awaited<ReturnType<typeof getArticleDetail>>>
type PredictionRow = ArticleDetail['predictions'][number]

export const dynamic = 'force-dynamic'

interface ArticlePageProps {
  params: Promise<{ id: string }>
}

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

function ExternalLinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { id } = await params

  let article = null
  try {
    article = await getArticleDetail(id)
  } catch (err) {
    console.error('Article fetch error:', err)
  }

  if (!article) {
    notFound()
  }

  const summary = article.summary
  const predictions: PredictionRow[] = article.predictions ?? []
  const relevance: number = summary?.relevanceScore ?? 0
  const sentiment: number | null = summary?.sentimentScore ?? null
  const topics: string[] = (summary?.keyTopics as string[] | null | undefined) ?? []

  const sentimentColor =
    sentiment == null
      ? '#8a8a8a'
      : sentiment > 0.2
      ? '#22c55e'
      : sentiment < -0.2
      ? '#ef4444'
      : '#eab308'

  const sentimentLabel =
    sentiment == null
      ? 'Unknown'
      : sentiment > 0.2
      ? 'Positive'
      : sentiment < -0.2
      ? 'Negative'
      : 'Neutral'

  const actions = (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <Link
        href="/feed"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '13px',
          color: '#8a8a8a',
          textDecoration: 'none',
          padding: '6px 12px',
          borderRadius: '8px',
          border: '1px solid #1f1f1f',
          transition: 'all 0.15s',
        }}
      >
        <BackIcon />
        Back to feed
      </Link>
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '13px',
          color: '#8a8a8a',
          textDecoration: 'none',
          padding: '6px 12px',
          borderRadius: '8px',
          border: '1px solid #1f1f1f',
          transition: 'all 0.15s',
        }}
      >
        <ExternalLinkIcon />
        Original
      </a>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      <TopBar title="Article" actions={actions} />

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 32px' }}>
        {/* Source + date */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px',
            fontSize: '12px',
            color: '#555',
          }}
        >
          <Badge variant="default" size="sm">
            {article.source.name}
          </Badge>
          <span>·</span>
          <span>
            {new Date(article.scrapedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          <span>·</span>
          <Badge variant={article.status === 'SUMMARIZED' ? 'positive' : 'default'} size="sm">
            {article.status}
          </Badge>
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: '26px',
            fontWeight: 700,
            color: '#f0f0f0',
            lineHeight: '1.35',
            letterSpacing: '-0.02em',
            margin: '0 0 20px',
          }}
        >
          {article.title}
        </h1>

        {/* Topics */}
        {topics.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px' }}>
            {topics.map((topic) => (
              <Badge key={topic} variant="accent">
                {topic}
              </Badge>
            ))}
          </div>
        )}

        {/* Stats row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            marginBottom: '28px',
          }}
        >
          <div
            style={{
              backgroundColor: '#111111',
              border: '1px solid #1f1f1f',
              borderRadius: '10px',
              padding: '14px',
            }}
          >
            <div style={{ fontSize: '11px', color: '#8a8a8a', marginBottom: '6px' }}>Relevance</div>
            <div
              style={{ fontSize: '20px', fontWeight: 700, color: '#f0f0f0', marginBottom: '6px' }}
            >
              {Math.round(relevance * 100)}%
            </div>
            <ProgressBar value={relevance} max={1} color="#6366f1" height={3} />
          </div>

          <div
            style={{
              backgroundColor: '#111111',
              border: '1px solid #1f1f1f',
              borderRadius: '10px',
              padding: '14px',
            }}
          >
            <div style={{ fontSize: '11px', color: '#8a8a8a', marginBottom: '6px' }}>Sentiment</div>
            <div
              style={{ fontSize: '20px', fontWeight: 700, color: sentimentColor, marginBottom: '6px' }}
            >
              {sentimentLabel}
            </div>
            <div style={{ fontSize: '11px', color: '#555' }}>
              {sentiment != null ? `${(sentiment * 100).toFixed(0)}%` : '–'}
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#111111',
              border: '1px solid #1f1f1f',
              borderRadius: '10px',
              padding: '14px',
            }}
          >
            <div style={{ fontSize: '11px', color: '#8a8a8a', marginBottom: '6px' }}>
              Predictions
            </div>
            <div
              style={{ fontSize: '20px', fontWeight: 700, color: '#f0f0f0', marginBottom: '6px' }}
            >
              {predictions.length}
            </div>
            <div style={{ fontSize: '11px', color: '#555' }}>
              {predictions.filter((p: PredictionRow) => p.status === 'PENDING').length} pending
            </div>
          </div>
        </div>

        {/* Voice reader */}
        {summary?.content && (
          <div style={{ marginBottom: '28px' }}>
            <VoiceReader text={summary.content} />
          </div>
        )}

        {/* Summary */}
        {summary ? (
          <div
            style={{
              backgroundColor: '#111111',
              border: '1px solid #1f1f1f',
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '32px',
            }}
          >
            <h2
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#8a8a8a',
                marginBottom: '16px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              AI Summary
            </h2>
            <div
              style={{
                fontSize: '15px',
                color: '#d0d0d0',
                lineHeight: '1.75',
                whiteSpace: 'pre-wrap',
              }}
            >
              {summary.content}
            </div>
          </div>
        ) : (
          <div
            style={{
              backgroundColor: '#111111',
              border: '1px solid #1f1f1f',
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '32px',
              textAlign: 'center',
              color: '#555',
            }}
          >
            No summary available yet
          </div>
        )}

        {/* Predictions */}
        {predictions.length > 0 && (
          <div>
            <h2
              style={{
                fontSize: '16px',
                fontWeight: 600,
                color: '#f0f0f0',
                marginBottom: '16px',
              }}
            >
              Predictions
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {predictions.map((prediction: PredictionRow) => (
                <PredictionCard
                  key={prediction.id}
                  prediction={{
                    ...prediction,
                    timeHorizon: prediction.timeHorizon ?? null,
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
    <ArticleChatPanel
      articleId={id}
      articleTitle={article.title}
      hasExistingInsight={!!('insight' in article && article.insight)}
    />
  )
}
