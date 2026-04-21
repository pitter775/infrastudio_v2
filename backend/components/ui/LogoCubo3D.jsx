"use client"

import { memo, useEffect, useMemo, useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { cn } from "@/lib/utils"
import * as THREE from "three"

const FACE_COLORS = {
  front: "#2563eb",
  back: "#0ace00",
  right: "#06b6d4",
  left: "#7c3aed",
  top: "#ea4848",
  bottom: "#360666",
}

const FACE_DEFINITIONS = [
  { key: "front", axis: "z", value: 1, position: [0, 0, 1], rotation: [0, 0, 0] },
  { key: "back", axis: "z", value: -1, position: [0, 0, -1], rotation: [0, Math.PI, 0] },
  { key: "right", axis: "x", value: 1, position: [1, 0, 0], rotation: [0, Math.PI / 2, 0] },
  { key: "left", axis: "x", value: -1, position: [-1, 0, 0], rotation: [0, -Math.PI / 2, 0] },
  { key: "top", axis: "y", value: 1, position: [0, 1, 0], rotation: [-Math.PI / 2, 0, 0] },
  { key: "bottom", axis: "y", value: -1, position: [0, -1, 0], rotation: [Math.PI / 2, 0, 0] },
]

function varyColor(hex, row, col) {
  const color = new THREE.Color(hex)
  const hueShift = (col - 1) * 0.008
  const saturationShift = row === 1 ? 0.01 : -0.015
  const lightnessShift = (1 - row) * 0.028 + (col - 1) * 0.012

  color.offsetHSL(hueShift, saturationShift, lightnessShift)
  return `#${color.getHexString()}`
}

function buildCubies() {
  const cubies = []
  const coords = [-1, 0, 1]

  for (const x of coords) {
    for (const y of coords) {
      for (const z of coords) {
        const stickers = []

        for (const face of FACE_DEFINITIONS) {
          if ((face.axis === "x" && x !== face.value) || (face.axis === "y" && y !== face.value) || (face.axis === "z" && z !== face.value)) {
            continue
          }

          const row = face.axis === "y" ? 1 - z : 1 - y
          const col = face.axis === "x" ? z + 1 : x + 1

          stickers.push({
            key: face.key,
            color: varyColor(FACE_COLORS[face.key], row, col),
            position: face.position,
            rotation: face.rotation,
          })
        }

        cubies.push({
          key: `${x}-${y}-${z}`,
          position: [x, y, z],
          entryOffset: [
            x === 0 ? (Math.random() > 0.5 ? 1 : -1) * (4.4 + Math.random() * 1.8) : x * (4.2 + Math.random() * 1.4),
            y === 0 ? (Math.random() > 0.5 ? 1 : -1) * (4.4 + Math.random() * 1.8) : y * (4.2 + Math.random() * 1.4),
            z === 0 ? (Math.random() > 0.5 ? 1 : -1) * (4.4 + Math.random() * 1.8) : z * (4.2 + Math.random() * 1.4),
          ],
          entrySpin: [
            (Math.random() - 0.5) * Math.PI * 2.4,
            (Math.random() - 0.5) * Math.PI * 2.4,
            (Math.random() - 0.5) * Math.PI * 2.4,
          ],
          delay: Math.random() * 0.28,
          stickers,
        })
      }
    }
  }

  return cubies
}

function CuboMagico({ animado = false, velocidade = 0.32, ativo = true, montarAoEntrar = false }) {
  const groupRef = useRef(null)
  const cubies = useMemo(() => buildCubies(), [])
  const elapsedRef = useRef(Math.random() * Math.PI * 2)
  const introProgressRef = useRef(montarAoEntrar ? 0 : 1)
  const baseRotationX = animado ? -0.42 : -1.56
  const baseRotationY = animado ? 0.68 : 0.88

  useEffect(() => {
    introProgressRef.current = montarAoEntrar && ativo ? 0 : 1
  }, [ativo, montarAoEntrar])

  useFrame((_, delta) => {
    if (!groupRef.current) {
      return
    }

    elapsedRef.current += delta
    if (montarAoEntrar && introProgressRef.current < 1) {
      introProgressRef.current = Math.min(1, introProgressRef.current + delta / 1.1)
    }

    const tempo = elapsedRef.current
    const drift = tempo * velocidade

    const introEase = 1 - Math.pow(1 - introProgressRef.current, 3)
    const introTilt = (1 - introEase) * 0.18
    const moveFactor = animado ? 1 : 0.35

    groupRef.current.rotation.x =
      baseRotationX +
      introTilt +
      moveFactor * (Math.sin(tempo * 0.9) * 0.16 + Math.cos(tempo * 0.37) * 0.08)
    groupRef.current.rotation.y =
      baseRotationY +
      moveFactor * (drift + Math.sin(tempo * 0.58) * 0.28)
    groupRef.current.rotation.z =
      (1 - introEase) * -0.22 +
      moveFactor * (Math.cos(tempo * 0.74) * 0.12 + Math.sin(tempo * 0.21) * 0.06)
  })

  return (
    <group ref={groupRef} rotation={[baseRotationX, baseRotationY, 0]}>
      {cubies.map((cubie) => (
        <Cubie
          key={cubie.key}
          position={cubie.position}
          stickers={cubie.stickers}
          entryOffset={cubie.entryOffset}
          entrySpin={cubie.entrySpin}
          delay={cubie.delay}
          introProgressRef={introProgressRef}
          montarAoEntrar={montarAoEntrar}
        />
      ))}
    </group>
  )
}

function Cubie({ position, stickers, entryOffset, entrySpin, delay, introProgressRef, montarAoEntrar }) {
  const groupRef = useRef(null)
  const pieceSize = 0.58
  const pieceGap = 0.07
  const pieceStep = pieceSize + pieceGap
  const stickerSize = 0.57
  const stickerDepth = 0.045
  const stickerOffset = pieceSize / 2 + stickerDepth / 2 + 0.01
  const finalPosition = useMemo(() => position.map((value) => value * pieceStep), [position, pieceStep])

  useFrame(() => {
    if (!groupRef.current) {
      return
    }

    if (!montarAoEntrar) {
      groupRef.current.position.set(finalPosition[0], finalPosition[1], finalPosition[2])
      groupRef.current.rotation.set(0, 0, 0)
      return
    }

    const rawProgress = introProgressRef.current
    const normalized = Math.min(1, Math.max(0, (rawProgress - delay) / (1 - delay || 1)))
    const eased = 1 - Math.pow(1 - normalized, 4)
    const spread = 1 - eased

    groupRef.current.position.set(
      finalPosition[0] + entryOffset[0] * spread,
      finalPosition[1] + entryOffset[1] * spread,
      finalPosition[2] + entryOffset[2] * spread,
    )
    groupRef.current.rotation.set(
      entrySpin[0] * spread,
      entrySpin[1] * spread,
      entrySpin[2] * spread,
    )
  })

  return (
    <group ref={groupRef} position={finalPosition}>
      <mesh>
        <boxGeometry args={[pieceSize, pieceSize, pieceSize]} />
        <meshStandardMaterial
          color="#0f172a"
          roughness={0.7}
          metalness={0.16}
          transparent
          opacity={0.42}
          depthWrite={false}
        />
      </mesh>

      {stickers.map((sticker) => (
        <mesh
          key={sticker.key}
          position={sticker.position.map((value) => value * stickerOffset)}
          rotation={sticker.rotation}
        >
          <boxGeometry args={[stickerSize, stickerSize, stickerDepth]} />
          <meshStandardMaterial
            color={sticker.color}
            roughness={0.42}
            metalness={0.1}
            emissive={sticker.color}
            emissiveIntensity={0.08}
            transparent
            opacity={0.74}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  )
}

function Scene({ animado, velocidade, ativo, montarAoEntrar }) {
  return (
    <>
      <ambientLight intensity={1.1} color="#dbeafe" />
      <directionalLight position={[5, 6, 7]} intensity={2.2} color="#ffffff" />
      <directionalLight position={[-4, -2, 3]} intensity={0.7} color="#c4b5fd" />
      <pointLight position={[0, 2.5, 3.5]} intensity={0.9} color="#67e8f9" />
      <CuboMagico animado={animado} velocidade={velocidade} ativo={ativo} montarAoEntrar={montarAoEntrar} />
    </>
  )
}

export const LogoCubo3D = memo(function LogoCubo3D({
  animado = false,
  pausado = false,
  ativo = true,
  entrada,
  montarAoEntrar = false,
  tamanho = 48,
  velocidade,
  className,
}) {
  const safeSize = Math.max(24, Number(tamanho) || 48)
  const resolvedSpeed = velocidade ?? (pausado ? 0.18 : 0.28)
  const shouldMountIntro = entrada ?? montarAoEntrar
  const containerClassName = cn("inline-flex shrink-0 overflow-hidden rounded-[18%] pointer-events-none select-none", className)
  const containerStyle = {
    width: safeSize,
    height: safeSize,
    maxWidth: "100%",
    maxHeight: "100%",
  }

  return (
    <div
      className={containerClassName}
      style={containerStyle}
      aria-hidden="true"
    >
      <Canvas
        dpr={[1, 1.75]}
        frameloop={animado || shouldMountIntro ? "always" : "demand"}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [4.2, 3.2, 4.8], fov: 34 }}
      >
        <Scene animado={animado} velocidade={resolvedSpeed} ativo={ativo} montarAoEntrar={shouldMountIntro} />
      </Canvas>
    </div>
  )
})

export default LogoCubo3D
