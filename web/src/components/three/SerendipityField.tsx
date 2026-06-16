'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function ParticleField() {
  const ref      = useRef<THREE.Points>(null)
  const streakRef = useRef<{ x: number; y: number; z: number; t: number } | null>(null)
  const t        = useRef(0)

  const { positions, velocities } = useMemo(() => {
    const count = 180
    const pos = new Float32Array(count * 3)
    const vel = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 5
      pos[i * 3 + 1] = (Math.random() - 0.5) * 4
      pos[i * 3 + 2] = (Math.random() - 0.5) * 3
      vel[i * 3]     = (Math.random() - 0.5) * 0.002
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.002
      vel[i * 3 + 2] = 0
    }
    return { positions: pos, velocities: vel }
  }, [])

  useFrame((_, delta) => {
    t.current += delta
    if (!ref.current) return
    const pos = ref.current.geometry.attributes.position.array as Float32Array
    for (let i = 0; i < pos.length / 3; i++) {
      pos[i * 3]     += velocities[i * 3]
      pos[i * 3 + 1] += velocities[i * 3 + 1]
      // wrap
      if (pos[i * 3] > 2.5)  pos[i * 3] = -2.5
      if (pos[i * 3] < -2.5) pos[i * 3] = 2.5
      if (pos[i * 3 + 1] > 2) pos[i * 3 + 1] = -2
      if (pos[i * 3 + 1] < -2) pos[i * 3 + 1] = 2
    }
    ref.current.geometry.attributes.position.needsUpdate = true
  })

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3))
    return g
  }, [positions])

  return (
    <>
      <ambientLight intensity={0.5} />
      <points ref={ref} geometry={geo}>
        <pointsMaterial
          color="#8b5cf6"
          size={0.04}
          transparent
          opacity={0.7}
          sizeAttenuation
        />
      </points>
      {/* A few brighter "surprise" particles */}
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([-1.2, 0.8, 0, 0.6, -1.1, 0, 1.5, 0.2, 0]), 3]}
          />
        </bufferGeometry>
        <pointsMaterial color="#c084fc" size={0.1} sizeAttenuation />
      </points>
    </>
  )
}

export function SerendipityField() {
  return (
    <Canvas
      style={{ width: '100%', height: '100%' }}
      camera={{ position: [0, 0, 4], fov: 55 }}
      dpr={[1, 1.5]}
      gl={{ antialias: false, alpha: true }}
      aria-hidden="true"
    >
      <ParticleField />
    </Canvas>
  )
}
