'use client'

import React from 'react'

interface ProgressBarProps {
  value: number
  max?: number
  color?: string
  height?: number
  showLabel?: boolean
  label?: string
  className?: string
}

export function ProgressBar({
  value,
  max = 1,
  color = '#6366f1',
  height = 4,
  showLabel = false,
  label,
  className,
}: ProgressBarProps) {
  const percent = Math.min(Math.max((value / max) * 100, 0), 100)

  return (
    <div className={className}>
      {(showLabel || label) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '4px',
            fontSize: '11px',
            color: '#8a8a8a',
          }}
        >
          {label && <span>{label}</span>}
          {showLabel && <span>{Math.round(percent)}%</span>}
        </div>
      )}
      <div
        style={{
          width: '100%',
          height: `${height}px`,
          backgroundColor: '#1f1f1f',
          borderRadius: `${height}px`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: '100%',
            backgroundColor: color,
            borderRadius: `${height}px`,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  )
}
