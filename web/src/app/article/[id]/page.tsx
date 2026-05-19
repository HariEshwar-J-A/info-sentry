import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Clock } from 'lucide-react'
import { TopBar } from '@/components/shell/TopBar'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { PredictionCard } from '@/components/article/PredictionCard'
import { VoiceReader } from '@/components/article/VoiceReader'
import { ArticleChatPanel } from '@/components/article/ArticleChatPanel'
import { ReadingProgress } from '@/components/article/ReadingProgress'
import { ArticleActions } from '@/components/article/ArticleActions'
import { getArticleDetail } from '@/lib/feed'
import { MarkdownContent } from '@/components/ui/MarkdownContent'

type ArticleDetail = NonNullable<Awaited<ReturnType<typeof getArticleDetail>>>
type PredictionRow = ArticleDetail['predictions'][number]

export const dynamic = 'force-dynamic'

interface ArticlePageProps {
  params: Promise<{ id: string }>
}

function estimateReadTime(text: string): number {
  const words = text.trim().split(/\s+/).length
  return Math.max(1, Math.round(words / 200))
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
  const readTime = summary?.content ? estimateReadTime(summary.content) : null

  const sentimentColor =
    sentiment == null ? '#8a8a8a'
    : sentiment > 0.2 ? '#22c55e'
    : sentiment < -0.2 ? '#ef4444'
    : '#eab308'

  const sentimentLabel =
    sentiment == null ? 'Unknown'
    : sentiment > 0.2 ? 'Positive'
    : sentiment < -0.2 ? 'Negative'
    : 'Neutral'

  const actions = (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <Link href="/feed" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#8a8a8a', textDecoration: 'none', padding: '6px 12px', borderRadius: '8px', border: '1px solid #1f1f1f' }}>
        <ArrowLeft size={15} /> Back to feed
      </Link>
      <a href={article.url} target="_blank" rel="noopener noreferrer"
        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#8a8a8a', textDecoration: 'none', padding: '6px 12px', borderRadius: '8px', border: '1px solid #1f1f1f' }}>
        <ExternalLink size={14} /> Original
      </a>
    </div>
  )

  return (
    <>
      <ReadingProgress />
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
        <TopBar title="Article" actions={actions} />

        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 32px' }}>
          {/* Source + date + read time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '12px', color: '#555', flexWrap: 'wrap' }}>
            <Badge variant="default" size="sm">{article.source.name}</Badge>
            <span>·</span>
            <span>
              {new Date(article.scrapedAt).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </span>
            {readTime && (
              <>
                <span>·</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#555' }}>
                  <Clock size={11} /> ~{readTime} min read
                </span>
              </>
            )}
            <span>·</span>
            <Badge variant={article.status === 'SUMMARIZED' ? 'positive' : 'default'} size="sm">
              {article.status}
            </Badge>
          </div>

          {/* Title */}
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#f0f0f0', lineHeight: '1.35', letterSpacing: '-0.02em', margin: '0 0 20px' }}>
            {article.title}
          </h1>

          {/* Topics */}
          {topics.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px' }}>
              {topics.map((topic) => (
                <Badge key={topic} variant="accent">{topic}</Badge>
              ))}
            </div>
          )}

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '28px' }}>
            <div style={{ backgroundColor: '#111111', border: '1px solid #1f1f1f', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '11px', color: '#8a8a8a', marginBottom: '6px' }}>Relevance</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#f0f0f0', marginBottom: '6px' }}>
                {Math.round(relevance * 100)}%
              </div>
              <ProgressBar value={relevance} max={1} color="#6366f1" height={3} />
            </div>

            <div style={{ backgroundColor: '#111111', border: '1px solid #1f1f1f', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '11px', color: '#8a8a8a', marginBottom: '6px' }}>Sentiment</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: sentimentColor, marginBottom: '6px' }}>
                {sentimentLabel}
              </div>
              <div style={{ fontSize: '11px', color: '#555' }}>
                {sentiment != null ? `${(sentiment * 100).toFixed(0)}%` : '–'}
              </div>
            </div>

            <div style={{ backgroundColor: '#111111', border: '1px solid #1f1f1f', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '11px', color: '#8a8a8a', marginBottom: '6px' }}>Predictions</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#f0f0f0', marginBottom: '6px' }}>
                {predictions.length}
              </div>
              <div style={{ fontSize: '11px', color: '#555' }}>
                {predictions.filter((p: PredictionRow) => p.status === 'PENDING').length} pending
              </div>
            </div>
          </div>

          {/* Article actions row (client — bookmark + copy link) */}
          <ArticleActions articleId={id} articleUrl={article.url} topics={topics} />

          {/* Voice reader */}
          {summary?.content && (
            <div style={{ marginBottom: '28px' }}>
              <VoiceReader text={summary.content} />
            </div>
          )}

          {/* Summary */}
          {summary ? (
            <div style={{ backgroundColor: '#111111', border: '1px solid #1f1f1f', borderRadius: '12px', padding: '24px', marginBottom: '32px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#8a8a8a', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                AI Summary
              </h2>
              <MarkdownContent content={summary.content} size="md" />
            </div>
          ) : (
            <div style={{ backgroundColor: '#111111', border: '1px solid #1f1f1f', borderRadius: '12px', padding: '24px', marginBottom: '32px', textAlign: 'center', color: '#555' }}>
              No summary available yet
            </div>
          )}

          {/* Predictions */}
          {predictions.length > 0 && (
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#f0f0f0', marginBottom: '16px' }}>
                Predictions
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {predictions.map((prediction: PredictionRow) => (
                  <PredictionCard
                    key={prediction.id}
                    prediction={{ ...prediction, timeHorizon: prediction.timeHorizon ?? null }}
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
        hasExistingInsight={!!('insight' in article && (article as { insight?: unknown }).insight)}
      />
    </>
  )
}
