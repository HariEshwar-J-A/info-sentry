'use client'

import React from 'react'

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  status?: 'default' | 'success' | 'error'
}

export const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
function FormInput({ label, hint, error, status = 'default', style, ...props }, ref) {
  const borderColor =
    error || status === 'error' ? '#ef4444' :
    status === 'success' ? '#22c55e' :
    '#2a2a2a'

  const focusBorderColor =
    error || status === 'error' ? '#ef4444' :
    status === 'success' ? '#22c55e' :
    '#6366f1'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      {label && (
        <label style={{ fontSize: '12px', color: '#8a8a8a', fontWeight: 500 }}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        {...props}
        style={{
          background: '#0d0d0d',
          border: `1px solid ${borderColor}`,
          borderRadius: '8px',
          color: '#f0f0f0',
          fontSize: '13px',
          padding: '9px 14px',
          outline: 'none',
          width: '100%',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
          transition: 'border-color 0.15s',
          ...style,
        }}
        onFocus={e => {
          e.currentTarget.style.borderColor = focusBorderColor
          props.onFocus?.(e)
        }}
        onBlur={e => {
          e.currentTarget.style.borderColor = borderColor
          props.onBlur?.(e)
        }}
      />
      {(hint || error) && (
        <span style={{ fontSize: '11px', color: error ? '#ef4444' : '#555' }}>
          {error ?? hint}
        </span>
      )}
    </div>
  )
})
FormInput.displayName = 'FormInput'
