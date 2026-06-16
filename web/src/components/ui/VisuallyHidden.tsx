import React from 'react'

const srOnlyStyle: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
}

interface Props {
  children: React.ReactNode
  as?: 'span' | 'div' | 'p' | 'li' | 'label'
}

/**
 * Renders content visible only to screen readers (sr-only pattern).
 */
export function VisuallyHidden({ children, as: Tag = 'span' }: Props) {
  return <Tag style={srOnlyStyle}>{children}</Tag>
}
