'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Sphere } from '@react-three/drei'
import * as THREE from 'three'

function GlobeDots({ count = 200 }: { count?: number }) {
  const ref = useRef<THREE.Group>(null)

  const positions = useMemo(() => {
    return Array.from({ length: count }, () => {
      const phi   = Math.acos(1 - 2 * Math.random())
      const theta = 2 * Math.PI * Math.random()
      const r     = 1.5
      return new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi),
      )
    })
  }, [count])

  useFrame((_, d) => {
    if (ref.current) ref.current.rotation.y += d * 0.12
  })

  return (
    <group ref={ref}>
      {positions.map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[i < 10 ? 0.025 : 0.012, 4, 4]} />
          <meshStandardMaterial
            color={i < 10 ? '#c084fc' : '#4c1d95'}
            emissive={i < 10 ? '#c084fc' : '#4c1d95'}
            emissiveIntensity={i < 10 ? 1.5 : 0.4}
          />
        </mesh>
      ))}
      {/* Wireframe globe shell */}
      <Sphere args={[1.5, 24, 24]}>
        <meshBasicMaterial color="#2a1f4a" wireframe opacity={0.15} transparent />
      </Sphere>
    </group>
  )
}

export function RepoGlobe() {
  return (
    <Canvas
      style={{ width: '100%', height: '100%' }}
      camera={{ position: [0, 0, 4], fov: 50 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      aria-hidden="true"
    >
      <ambientLight intensity={0.3} />
      <pointLight position={[4, 4, 4]} intensity={1} color="#a78bfa" />
      <GlobeDots />
      <OrbitControls enablePan={false} enableZoom={false} autoRotate={false} />
    </Canvas>
  )
}
