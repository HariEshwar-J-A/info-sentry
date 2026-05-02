import React from 'react'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'

interface Prediction {
  id: string
  content: string
  confidence: number
  timeHorizon: string | null
  status: string
  createdAt: Date
}

interface PredictionCardProps {
  prediction: Prediction
}

const statusVariant: Record<string, 'positive' | 'negative' | 'neutral' | 'accent' | 'default'> = {
  PENDING: 'neutral',
  CORRECT: 'positive',
  INCORRECT: 'negative',
  PARTIALLY_CORRECT: 'accent',
  EXPIRED: 'default',
}

export function PredictionCard({ prediction }: PredictionCardProps) {
  const confidenceColor =
    prediction.confidence > 0.7
      ? '#22c55e'
      : prediction.confidence > 0.5
      ? '#eab308'
      : '#ef4444'

  return (
    <div
      style={{
        backgroundColor: '#111111',
        border: '1px solid #1f1f1f',
        borderRadius: '10px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      {/* Status + horizon */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <Badge variant={statusVariant[prediction.status] ?? 'default'} size="sm">
          {prediction.status.replace('_', ' ')}
        </Badge>
        {prediction.timeHorizon && (
          <Badge variant="default" size="sm">
            {prediction.timeHorizon}
          </Badge>
        )}
      </div>

      {/* Content */}
      <p
        style={{
          fontSize: '14px',
          color: '#e0e0e0',
          lineHeight: '1.6',
          margin: 0,
        }}
      >
        {prediction.content}
      </p>

      {/* Confidence bar */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '4px',
          }}
        >
          <span style={{ fontSize: '11px', color: '#8a8a8a' }}>Confidence</span>
          <span style={{ fontSize: '11px', color: confidenceColor, fontWeight: 600 }}>
            {Math.round(prediction.confidence * 100)}%
          </span>
        </div>
        <ProgressBar
          value={prediction.confidence}
          max={1}
          color={confidenceColor}
          height={4}
        />
      </div>
    </div>
  )
}
