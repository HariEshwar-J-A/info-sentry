import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
  hoverable?: boolean
}

export function Card({ children, className, style, onClick, hoverable = false }: CardProps) {
  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        backgroundColor: '#111111',
        border: '1px solid #1f1f1f',
        borderRadius: '12px',
        padding: '20px',
        transition: 'border-color 0.15s, background-color 0.15s',
        cursor: onClick ? 'pointer' : 'default',
        ...(hoverable
          ? {
              cursor: 'pointer',
            }
          : {}),
        ...style,
      }}
      onMouseEnter={
        hoverable || onClick
          ? (e) => {
              ;(e.currentTarget as HTMLDivElement).style.borderColor = '#2a2a2a'
              ;(e.currentTarget as HTMLDivElement).style.backgroundColor = '#141414'
            }
          : undefined
      }
      onMouseLeave={
        hoverable || onClick
          ? (e) => {
              ;(e.currentTarget as HTMLDivElement).style.borderColor = '#1f1f1f'
              ;(e.currentTarget as HTMLDivElement).style.backgroundColor = '#111111'
            }
          : undefined
      }
    >
      {children}
    </div>
  )
}
