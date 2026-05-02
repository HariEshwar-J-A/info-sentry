'use client'

import React, { useState, useEffect, useRef } from 'react'

interface VoiceReaderProps {
  text: string
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  )
}

export function VoiceReader({ text }: VoiceReaderProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [supported, setSupported] = useState(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    setSupported('speechSynthesis' in window)
    return () => {
      window.speechSynthesis?.cancel()
    }
  }, [])

  function handlePlay() {
    if (!supported) return

    if (isPaused) {
      window.speechSynthesis.resume()
      setIsPaused(false)
      setIsPlaying(true)
      return
    }

    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.95
    utterance.pitch = 1
    utterance.volume = 1

    utterance.onstart = () => {
      setIsPlaying(true)
      setIsPaused(false)
    }
    utterance.onend = () => {
      setIsPlaying(false)
      setIsPaused(false)
    }
    utterance.onerror = () => {
      setIsPlaying(false)
      setIsPaused(false)
    }

    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }

  function handlePause() {
    window.speechSynthesis.pause()
    setIsPaused(true)
    setIsPlaying(false)
  }

  function handleStop() {
    window.speechSynthesis.cancel()
    setIsPlaying(false)
    setIsPaused(false)
  }

  if (!supported) return null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 14px',
        backgroundColor: '#111111',
        border: '1px solid #1f1f1f',
        borderRadius: '10px',
      }}
    >
      <span style={{ fontSize: '12px', color: '#8a8a8a' }}>Voice Reader</span>

      <div style={{ display: 'flex', gap: '6px', marginLeft: '4px' }}>
        <button
          onClick={isPlaying ? handlePause : handlePlay}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#6366f1',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background-color 0.15s',
          }}
          title={isPlaying ? 'Pause' : isPaused ? 'Resume' : 'Play'}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>

        {(isPlaying || isPaused) && (
          <button
            onClick={handleStop}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: '1px solid #1f1f1f',
              backgroundColor: 'transparent',
              color: '#8a8a8a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            title="Stop"
          >
            <StopIcon />
          </button>
        )}
      </div>

      {isPlaying && (
        <div style={{ display: 'flex', gap: '2px', alignItems: 'center', marginLeft: '4px' }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                width: '3px',
                height: `${8 + i * 4}px`,
                backgroundColor: '#6366f1',
                borderRadius: '2px',
                animation: `pulse-dot ${0.5 + i * 0.15}s ease-in-out infinite alternate`,
              }}
            />
          ))}
        </div>
      )}

      {isPaused && (
        <span style={{ fontSize: '11px', color: '#555' }}>Paused</span>
      )}
    </div>
  )
}
