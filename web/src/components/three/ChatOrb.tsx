'use client'

import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Sphere } from '@react-three/drei'
import * as THREE from 'three'

function PulsingOrb() {
  const orbRef  = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const t       = useRef(0)

  useFrame((_, delta) => {
    t.current += delta
    if (orbRef.current) {
      const pulse = 1 + Math.sin(t.current * 1.5) * 0.06
      orbRef.current.scale.setScalar(pulse)
    }
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 0.3
      ringRef.current.rotation.x += delta * 0.15
    }
  })

  return (
    <>
      <ambientLight intensity={0.2} />
      <pointLight position={[3, 3, 3]} intensity={2} color="#c084fc" />
      <pointLight position={[-3, -2, 2]} intensity={0.8} color="#818cf8" />

      {/* Core orb */}
      <Sphere ref={orbRef} args={[0.9, 32, 32]}>
        <meshStandardMaterial
          color="#5b21b6"
          emissive="#7c3aed"
          emissiveIntensity={0.6}
          roughness={0.2}
          metalness={0.8}
        />
      </Sphere>

      {/* Outer glow */}
      <Sphere args={[1.08, 16, 16]}>
        <meshStandardMaterial
          color="#c084fc"
          emissive="#c084fc"
          emissiveIntensity={0.08}
          transparent
          opacity={0.15}
          side={THREE.BackSide}
        />
      </Sphere>

      {/* Orbiting ring */}
      <mesh ref={ringRef}>
        <torusGeometry args={[1.3, 0.012, 8, 64]} />
        <meshStandardMaterial color="#a78bfa" emissive="#a78bfa" emissiveIntensity={0.7} />
      </mesh>
    </>
  )
}

export function ChatOrb() {
  return (
    <Canvas
      style={{ width: '100%', height: '100%' }}
      camera={{ position: [0, 0, 3.5], fov: 50 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      aria-hidden="true"
    >
      <PulsingOrb />
    </Canvas>
  )
}
