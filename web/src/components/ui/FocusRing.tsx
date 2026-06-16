import React from 'react'

interface WithClassName {
  className?: string
}

interface Props {
  children: React.ReactElement<WithClassName>
  className?: string
}

/**
 * Applies a consistent violet focus-visible ring to its child element.
 * Wrap any interactive element that needs a custom focus indicator.
 */
export function FocusRing({ children, className }: Props) {
  const ringClass = [
    'focus-visible:outline-none',
    'focus-visible:ring-2',
    'focus-visible:ring-[var(--focus-ring)]',
    'focus-visible:ring-offset-1',
    'focus-visible:ring-offset-[var(--bg)]',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return React.cloneElement(children, {
    className: [children.props.className, ringClass].filter(Boolean).join(' '),
  })
}
