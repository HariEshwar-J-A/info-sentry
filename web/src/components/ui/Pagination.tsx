'use client'

import React from 'react'

interface PaginationProps {
  page: number
  totalPages: number
  onChange: (p: number) => void
}

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null

  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    padding: '7px 16px',
    borderRadius: '8px',
    border: '1px solid #2a2a2a',
    background: 'none',
    color: disabled ? '#333' : '#a5b4fc',
    cursor: disabled ? 'default' : 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    fontFamily: 'inherit',
    transition: 'color 0.15s, border-color 0.15s',
  })

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      marginTop: '32px',
      paddingBottom: '32px',
    }}>
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        style={btnStyle(page === 1)}
      >
        ← Prev
      </button>
      <span style={{ fontSize: '13px', color: '#8a8a8a' }}>
        Page {page} of {totalPages}
      </span>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        style={btnStyle(page === totalPages)}
      >
        Next →
      </button>
    </div>
  )
}
