import Link from 'next/link'
import { TopBar } from '@/components/shell/TopBar'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { getSurpriseArticles, type SurpriseArticle } from '@/lib/feed'
import styles from './surprise.module.css'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SurprisePage() {
  let articles: SurpriseArticle[] = []
  try {
    articles = await getSurpriseArticles(12)
  } catch (err) {
    console.error('Surprise fetch error:', err)
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      <TopBar
        title="Surprise Me"
        subtitle="High-quality articles outside your usual interests"
      />

      <div style={{ padding: '24px 32px' }}>
        {/* Algorithm explanation */}
        <div
          style={{
            backgroundColor: 'rgba(99, 102, 241, 0.06)',
            border: '1px solid rgba(99, 102, 241, 0.15)',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '24px',
            fontSize: '12px',
            color: '#8a8a8a',
          }}
        >
          Scored by:{' '}
          <code
            style={{
              color: '#6366f1',
              fontFamily: 'monospace',
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              padding: '1px 5px',
              borderRadius: '4px',
            }}
          >
            (1 / interestScore) × relevance × recencyDecay
          </code>
          {' '} — surfaces gems you might have missed.
        </div>

        {articles.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '80px 0',
              color: '#555',
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>✦</div>
            <div style={{ fontSize: '14px' }}>Nothing surprising yet</div>
            <div style={{ fontSize: '12px', marginTop: '6px', color: '#444' }}>
              Check back after more articles are processed
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '16px',
            }}
          >
            {articles.map((article, i) => {
              const relevance = article.summary?.relevanceScore ?? 0
              const topics = article.summary?.keyTopics ?? []
              const excerpt = article.summary?.content?.slice(0, 180) ?? ''

              return (
                <Link
                  key={article.id}
                  href={`/article/${article.id}`}
                  style={{ textDecoration: 'none' }}
                >
                  <div className={styles.card}>
                    {/* Rank badge */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(99, 102, 241, 0.15)',
                          border: '1px solid rgba(99, 102, 241, 0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          color: '#6366f1',
                          fontWeight: 700,
                        }}
                      >
                        {i + 1}
                      </div>
                      <span
                        style={{
                          fontSize: '10px',
                          color: '#555',
                          fontFamily: 'monospace',
                        }}
                      >
                        score: {article.surpriseScore.toFixed(3)}
                      </span>
                    </div>

                    {/* Topics */}
                    {topics.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {topics.slice(0, 3).map((topic) => (
                          <Badge key={topic} variant="default" size="sm">
                            {topic}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Title */}
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#f0f0f0',
                        lineHeight: '1.4',
                      }}
                    >
                      {article.title}
                    </div>

                    {/* Excerpt */}
                    {excerpt && (
                      <p
                        style={{
                          fontSize: '12px',
                          color: '#8a8a8a',
                          lineHeight: '1.5',
                          margin: 0,
                          flex: 1,
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {excerpt}
                      </p>
                    )}

                    {/* Relevance */}
                    <ProgressBar value={relevance} max={1} color="#6366f1" height={3} />

                    {/* Source */}
                    <div style={{ fontSize: '11px', color: '#555' }}>
                      {article.source.name}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
