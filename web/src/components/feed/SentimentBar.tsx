'use client'

import React from 'react'

interface SentimentBarProps {
  score: number | null
  height?: number
}

export function SentimentBar({ score, height = 3 }: SentimentBarProps) {
  if (score == null) {
    return (
      <div
        style={{
          height: `${height}px`,
          backgroundColor: '#1f1f1f',
          borderRadius: `${height}px`,
        }}
      />
    )
  }

  // score is -1 to 1; map to color and width
  const normalised = (score + 1) / 2 // 0 to 1
  const color =
    score > 0.2 ? '#22c55e' : score < -0.2 ? '#ef4444' : '#eab308'

  const label =
    score > 0.2 ? 'Positive' : score < -0.2 ? 'Negative' : 'Neutral'

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '3px',
          fontSize: '10px',
          color: color,
        }}
      >
        <span>Sentiment</span>
        <span>{label}</span>
      </div>
      <div
        style={{
          width: '100%',
          height: `${height}px`,
          backgroundColor: '#1f1f1f',
          borderRadius: `${height}px`,
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '50%',
            width: '1px',
            height: '100%',
            backgroundColor: '#2a2a2a',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: score >= 0 ? '50%' : `${normalised * 100}%`,
            width: `${Math.abs(score) * 50}%`,
            height: '100%',
            backgroundColor: color,
            borderRadius: `${height}px`,
            transition: 'width 0.3s',
          }}
        />
      </div>
    </div>
  )
}
