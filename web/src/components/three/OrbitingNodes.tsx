'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Sphere, Line } from '@react-three/drei'
import * as THREE from 'three'

function Node({ position, color, speed, radius }: { position: [number,number,number], color: string, speed: number, radius: number }) {
  const ref = useRef<THREE.Mesh>(null)
  const angle = useRef(Math.random() * Math.PI * 2)

  useFrame((_, delta) => {
    angle.current += speed * delta
    if (ref.current) {
      ref.current.position.x = position[0] + Math.cos(angle.current) * radius * 0.3
      ref.current.position.y = position[1] + Math.sin(angle.current) * radius * 0.15
      ref.current.position.z = position[2] + Math.sin(angle.current * 0.7) * radius * 0.2
    }
  })

  return (
    <Sphere ref={ref} args={[0.04, 8, 8]} position={position}>
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
    </Sphere>
  )
}

function Scene() {
  const nodes = useMemo(() => {
    const count = 12
    return Array.from({ length: count }, (_, i) => {
      const phi = Math.acos(-1 + (2 * i) / count)
      const theta = Math.sqrt(count * Math.PI) * phi
      const r = 1.4
      return {
        id: i,
        position: [
          r * Math.cos(theta) * Math.sin(phi),
          r * Math.sin(theta) * Math.sin(phi),
          r * Math.cos(phi),
        ] as [number,number,number],
        color: i % 3 === 0 ? '#c084fc' : i % 3 === 1 ? '#a78bfa' : '#818cf8',
        speed: 0.2 + Math.random() * 0.3,
        radius: 0.8 + Math.random() * 0.4,
      }
    })
  }, [])

  const coreRef = useRef<THREE.Mesh>(null)
  useFrame((_, d) => {
    if (coreRef.current) coreRef.current.rotation.y += d * 0.2
  })

  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[3, 3, 3]} intensity={1.2} color="#c084fc" />
      {/* Core */}
      <Sphere ref={coreRef} args={[0.22, 16, 16]}>
        <meshStandardMaterial color="#7c3aed" emissive="#7c3aed" emissiveIntensity={1.2} wireframe />
      </Sphere>
      {nodes.map(n => <Node key={n.id} {...n} />)}
      {/* Connection lines from core to some nodes */}
      {nodes.slice(0, 6).map(n => (
        <Line
          key={`line-${n.id}`}
          points={[[0, 0, 0], n.position]}
          color="#6d28d9"
          lineWidth={0.5}
          opacity={0.3}
          transparent
        />
      ))}
      <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={0.5} />
    </>
  )
}

export function OrbitingNodes() {
  return (
    <Canvas
      style={{ width: '100%', height: '100%' }}
      camera={{ position: [0, 0, 4], fov: 55 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      aria-hidden="true"
    >
      <Scene />
    </Canvas>
  )
}
