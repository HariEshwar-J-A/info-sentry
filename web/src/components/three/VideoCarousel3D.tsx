'use client'

import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const CARD_COUNT = 5

function CurvedCards() {
  const groupRef = useRef<THREE.Group>(null)
  const mouse    = useRef({ x: 0, y: 0 })

  useFrame((state, delta) => {
    if (!groupRef.current) return
    const targetY = mouse.current.x * 0.4
    groupRef.current.rotation.y += (targetY - groupRef.current.rotation.y) * 0.05
    groupRef.current.rotation.x += (-mouse.current.y * 0.15 - groupRef.current.rotation.x) * 0.05
  })

  return (
    <group ref={groupRef}>
      {Array.from({ length: CARD_COUNT }, (_, i) => {
        const angle  = (i - Math.floor(CARD_COUNT / 2)) * 0.6
        const x      = Math.sin(angle) * 2.2
        const z      = Math.cos(angle) * 2.2 - 2.2
        const rotY   = -angle
        const isCenter = i === Math.floor(CARD_COUNT / 2)

        return (
          <mesh key={i} position={[x, 0, z]} rotation={[0, rotY, 0]}>
            <planeGeometry args={[1, 0.65]} />
            <meshStandardMaterial
              color={isCenter ? '#2a1f4a' : '#1a1a36'}
              emissive={isCenter ? '#4c1d95' : '#2a1f4a'}
              emissiveIntensity={isCenter ? 0.5 : 0.15}
              roughness={0.6}
            />
          </mesh>
        )
      })}
    </group>
  )
}

export function VideoCarousel3D() {
  return (
    <Canvas
      style={{ width: '100%', height: '100%' }}
      camera={{ position: [0, 0, 4], fov: 52 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      aria-hidden="true"
    >
      <ambientLight intensity={0.5} />
      <pointLight position={[3, 3, 3]} intensity={1.5} color="#818cf8" />
      <pointLight position={[-3, -2, 1]} intensity={0.6} color="#c084fc" />
      <CurvedCards />
    </Canvas>
  )
}
