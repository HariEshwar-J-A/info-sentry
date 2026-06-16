'use client'

import React, { useRef } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useReducedMotion } from '@/hooks/useReducedMotion'

// Omit HTML drag/animation events that structurally conflict with framer-motion's
// same-named props (different parameter types). Consumers don't use these on <Button>.
type MotionSafeHTMLProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  | 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration'
  | 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onDragEnter' | 'onDragLeave' | 'onDragOver' | 'onDrop'
>

interface ButtonProps extends MotionSafeHTMLProps {
  variant?: 'primary' | 'ghost' | 'icon' | 'danger' | 'outline'
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
  const ref = useRef<HTMLButtonElement>(null)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const sx = useSpring(mx, { stiffness: 200, damping: 30 })
  const sy = useSpring(my, { stiffness: 200, damping: 30 })
  const tx = useTransform(sx, v => v / 8)
  const ty = useTransform(sy, v => v / 8)
  const prefersReduced = useReducedMotion()

  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { fontSize: '13px', padding: '6px 12px', height: '32px' },
    md: { fontSize: '14px', padding: '8px 16px', height: '38px' },
    lg: { fontSize: '15px', padding: '10px 20px', height: '44px' },
  }

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: 'var(--violet-500)',
      color: '#ffffff',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: 'var(--text-muted)',
      border: '1px solid var(--border)',
    },
    icon: {
      backgroundColor: 'transparent',
      color: 'var(--text-muted)',
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
    outline: {
      backgroundColor: 'transparent',
      color: 'var(--violet-300)',
      border: '1px solid rgba(139,92,246,0.4)',
    },
  }

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    fontWeight: 500,
    borderRadius: '8px',
    border: 'none',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    transition: 'background-color 0.15s, border-color 0.15s',
    fontFamily: 'inherit',
    opacity: disabled || loading ? 0.6 : 1,
    ...sizeStyles[size],
    ...variantStyles[variant],
    ...style,
  }

  const spinner = loading ? (
    <span
      style={{
        width: '14px', height: '14px',
        border: '2px solid currentColor',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 0.6s linear infinite',
        display: 'inline-block',
      }}
    />
  ) : null

  const isMagnetic = variant === 'primary' && !prefersReduced && !disabled && !loading

  if (isMagnetic) {
    return (
      <motion.button
        ref={ref}
        style={{ ...baseStyle, x: tx, y: ty }}
        whileTap={{ scale: 0.97 }}
        onMouseMove={(e) => {
          const rect = ref.current?.getBoundingClientRect()
          if (!rect) return
          mx.set(e.clientX - rect.left - rect.width / 2)
          my.set(e.clientY - rect.top - rect.height / 2)
        }}
        onMouseLeave={() => { mx.set(0); my.set(0) }}
        disabled={disabled || loading}
        {...props}
      >
        {spinner}
        {children}
      </motion.button>
    )
  }

  return (
    <button style={baseStyle} disabled={disabled || loading} {...props}>
      {spinner}
      {children}
    </button>
  )
}
