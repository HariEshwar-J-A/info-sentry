'use client'

import React, { useRef } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { MotionGate } from '@/components/a11y/MotionGate'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  as?: 'button' | 'a'
  href?: string
  variant?: 'primary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

const variantStyles: Record<string, React.CSSProperties> = {
  primary: {
    background: 'var(--violet-500)',
    color: '#fff',
    border: '1px solid var(--violet-400)',
  },
  outline: {
    background: 'transparent',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-strong)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid transparent',
  },
}

const sizeStyles: Record<string, React.CSSProperties> = {
  sm: { padding: '8px 18px', fontSize: 13 },
  md: { padding: '11px 24px', fontSize: 15 },
  lg: { padding: '14px 32px', fontSize: 16 },
}

function MagneticButtonInner({ children, variant = 'primary', size = 'md', href, as: Tag, ...rest }: Props) {
  const ref = useRef<HTMLButtonElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 350, damping: 25 })
  const springY = useSpring(y, { stiffness: 350, damping: 25 })

  const handleMove = (e: React.MouseEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    x.set((e.clientX - rect.left - rect.width / 2) * 0.3)
    y.set((e.clientY - rect.top - rect.height / 2) * 0.3)
  }

  const sharedStyle: React.CSSProperties = {
    ...variantStyles[variant],
    ...sizeStyles[size],
    borderRadius: 10,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    textDecoration: 'none',
    fontFamily: 'Inter, sans-serif',
    letterSpacing: '-0.01em',
    position: 'relative',
    overflow: 'hidden',
  }

  if (href) {
    return (
      <motion.a
        href={href}
        style={{ ...sharedStyle, x: springX, y: springY }}
        onMouseMove={handleMove}
        onMouseLeave={() => { x.set(0); y.set(0) }}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        {children}
      </motion.a>
    )
  }

  return (
    <motion.button
      ref={ref}
      style={{ ...sharedStyle, x: springX, y: springY }}
      onMouseMove={handleMove}
      onMouseLeave={() => { x.set(0); y.set(0) }}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      {...(rest as React.ComponentProps<typeof motion.button>)}
    >
      {children}
    </motion.button>
  )
}

export function MagneticButton(props: Props) {
  const staticStyle: React.CSSProperties = {
    ...variantStyles[props.variant ?? 'primary'],
    ...sizeStyles[props.size ?? 'md'],
    borderRadius: 10,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    textDecoration: 'none',
    fontFamily: 'Inter, sans-serif',
  }

  const staticEl = props.href
    ? <a href={props.href} style={staticStyle}>{props.children}</a>
    : <button style={staticStyle} {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}>{props.children}</button>

  return (
    <MotionGate
      motion={<MagneticButtonInner {...props} />}
      static={staticEl}
    />
  )
}
