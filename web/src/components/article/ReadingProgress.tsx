'use client'

import React, { useEffect, useState } from 'react'

export function ReadingProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    function update() {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      setProgress(docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0)
    }
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  if (progress === 0) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: '2px',
      zIndex: 1000, backgroundColor: '#111',
    }}>
      <div style={{
        height: '100%', backgroundColor: '#6366f1',
        width: `${progress}%`, transition: 'width 0.1s linear',
      }} />
    </div>
  )
}
