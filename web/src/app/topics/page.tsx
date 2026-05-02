import { TopBar } from '@/components/shell/TopBar'
import { TopicCluster } from '@/components/topics/TopicCluster'
import { getTopicClusters, type TopicCluster as TopicClusterType } from '@/lib/feed'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function TopicsPage() {
  let clusters: TopicClusterType[] = []
  try {
    clusters = await getTopicClusters()
  } catch (err) {
    console.error('Topics fetch error:', err)
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
      <TopBar
        title="Topic Clusters"
        subtitle={`${clusters.length} topic groups from the last 72 hours`}
      />

      <div style={{ padding: '24px 32px' }}>
        {clusters.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '80px 0',
              color: '#555',
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>◎</div>
            <div style={{ fontSize: '14px' }}>No topic clusters found</div>
            <div style={{ fontSize: '12px', marginTop: '6px', color: '#444' }}>
              Articles need to be summarised first
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {clusters.map((cluster) => (
              <TopicCluster key={cluster.topic} cluster={cluster} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
