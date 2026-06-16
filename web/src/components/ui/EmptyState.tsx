import React from 'react'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: { label: string; onClick: () => void; icon?: React.ReactNode }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '80px 24px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0',
    }}>
      {icon && (
        <div style={{ marginBottom: '16px', color: '#333', display: 'flex', justifyContent: 'center' }}>
          {icon}
        </div>
      )}
      <div style={{ fontSize: '16px', fontWeight: 600, color: '#e0e0e0', marginBottom: '8px' }}>
        {title}
      </div>
      {description && (
        <div style={{ fontSize: '13px', color: '#555', marginBottom: action ? '20px' : '0', maxWidth: '320px', lineHeight: '1.5' }}>
          {description}
        </div>
      )}
      {action && (
        <button
          onClick={action.onClick}
          style={{
            padding: '10px 24px',
            borderRadius: '10px',
            border: 'none',
            background: '#6366f1',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: 'inherit',
          }}
        >
          {action.icon}
          {action.label}
        </button>
      )}
    </div>
  )
}
