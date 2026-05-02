'use client'

import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'icon' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: React.ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  style,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    fontWeight: 500,
    borderRadius: '8px',
    border: 'none',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    transition: 'all 0.15s',
    fontFamily: 'inherit',
    opacity: disabled || loading ? 0.6 : 1,
  }

  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { fontSize: '13px', padding: '6px 12px', height: '32px' },
    md: { fontSize: '14px', padding: '8px 16px', height: '38px' },
    lg: { fontSize: '15px', padding: '10px 20px', height: '44px' },
  }

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: '#6366f1',
      color: '#ffffff',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: '#8a8a8a',
      border: '1px solid #1f1f1f',
    },
    icon: {
      backgroundColor: 'transparent',
      color: '#8a8a8a',
      padding: '6px',
      width: sizeStyles[size]?.height,
      height: sizeStyles[size]?.height,
      borderRadius: '6px',
    },
    danger: {
      backgroundColor: 'rgba(239, 68, 68, 0.12)',
      color: '#ef4444',
      border: '1px solid rgba(239, 68, 68, 0.25)',
    },
  }

  const combinedStyle: React.CSSProperties = {
    ...baseStyle,
    ...sizeStyles[size],
    ...variantStyles[variant],
    ...style,
  }

  return (
    <button style={combinedStyle} disabled={disabled || loading} {...props}>
      {loading ? (
        <span
          style={{
            width: '14px',
            height: '14px',
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.6s linear infinite',
            display: 'inline-block',
          }}
        />
      ) : null}
      {children}
    </button>
  )
}
