'use client'

import React from 'react'

interface SkeletonProps {
  width?: string | number
  height?: string | number
  borderRadius?: string | number
  className?: string
}

export function Skeleton({
  width = '100%',
  height = '16px',
  borderRadius = '6px',
  className,
}: SkeletonProps) {
  return (
    <div
      className={className}
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: '#1a1a1a',
        backgroundImage: 'linear-gradient(90deg, #1a1a1a 25%, #222222 50%, #1a1a1a 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
      }}
    />
  )
}

export function ArticleCardSkeleton() {
  return (
    <div
      style={{
        backgroundColor: '#111111',
        border: '1px solid #1f1f1f',
        borderRadius: '12px',
        padding: '20px',
      }}
    >
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <Skeleton width="60px" height="20px" />
        <Skeleton width="80px" height="20px" />
      </div>
      <div style={{ marginBottom: '8px' }}><Skeleton height="20px" /></div>
      <div style={{ marginBottom: '12px' }}><Skeleton height="20px" width="80%" /></div>
      <div style={{ marginBottom: '6px' }}><Skeleton height="14px" /></div>
      <div style={{ marginBottom: '6px' }}><Skeleton height="14px" width="90%" /></div>
      <div style={{ marginBottom: '16px' }}><Skeleton height="14px" width="70%" /></div>
      <div style={{ marginBottom: '12px' }}><Skeleton height="4px" /></div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Skeleton width="100px" height="12px" />
        <Skeleton width="60px" height="12px" />
      </div>
    </div>
  )
}
