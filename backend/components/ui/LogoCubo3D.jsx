"use client"

import { memo, useEffect, useMemo, useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { cn } from "@/lib/utils"
import * as THREE from "three"

const FACE_COLORS = {
  front: "#2563eb",
  back: "#244611",
  right: "#06b6d4",
  left: "#7234df",
  top: "#9c7b2a",
  bottom: "#aa9f25",
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

function CuboMagico({
  animado = false,
  velocidade = 0.32,
  ativo = true,
  montarAoEntrar = false,
  interativo = false,
  pointerRef,
  interactionRef,
}) {
  const groupRef = useRef(null)
  const cubies = useMemo(() => buildCubies(), [])
  const elapsedRef = useRef((cubies.length * Math.PI) / 27)
  const introProgressRef = useRef(montarAoEntrar ? 0 : 1)
  const frozenRotationRef = useRef(null)
  const baseRotationX = animado ? -0.42 : -1.56
  const baseRotationY = animado ? 0.68 : 0.88

  useEffect(() => {
    introProgressRef.current = montarAoEntrar && ativo ? 0 : 1
  }, [ativo, montarAoEntrar])

  useEffect(() => {
    if (!interativo) {
      frozenRotationRef.current = null
      return
    }

    if (interactionRef?.current === 0) {
      frozenRotationRef.current = null
    }
  }, [interativo, interactionRef])

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
    const isInteracting =
      interativo &&
      interactionRef?.current &&
      performance.now() - interactionRef.current < 2000
    const moveFactor = animado ? 1 : 0.35

    const autoRotationX =
      baseRotationX +
      introTilt +
      moveFactor * (Math.sin(tempo * 0.9) * 0.16 + Math.cos(tempo * 0.37) * 0.08)
    const autoRotationY =
      baseRotationY +
      moveFactor * (drift + Math.sin(tempo * 0.58) * 0.28)
    const autoRotationZ =
      (1 - introEase) * -0.22 +
      moveFactor * (Math.cos(tempo * 0.74) * 0.12 + Math.sin(tempo * 0.21) * 0.06)

    if (isInteracting && pointerRef?.current) {
      if (!frozenRotationRef.current) {
        frozenRotationRef.current = {
          x: groupRef.current.rotation.x,
          y: groupRef.current.rotation.y,
          z: groupRef.current.rotation.z,
        }
      }

      groupRef.current.rotation.x = frozenRotationRef.current.x + pointerRef.current.y * 0.34
      groupRef.current.rotation.y = frozenRotationRef.current.y + pointerRef.current.x * 0.54
      groupRef.current.rotation.z = frozenRotationRef.current.z
      return
    }

    frozenRotationRef.current = null
    groupRef.current.rotation.x = autoRotationX
    groupRef.current.rotation.y = autoRotationY
    groupRef.current.rotation.z = autoRotationZ
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
          opacity={0.82}
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

function Scene({ animado, velocidade, ativo, montarAoEntrar, interativo, pointerRef, interactionRef }) {
  return (
    <>
      <ambientLight intensity={1.1} color="#dbeafe" />
      <directionalLight position={[5, 6, 7]} intensity={2.2} color="#ffffff" />
      <directionalLight position={[-4, -2, 3]} intensity={0.7} color="#c4b5fd" />
      <pointLight position={[0, 2.5, 3.5]} intensity={0.9} color="#67e8f9" />
      <CuboMagico
        animado={animado}
        velocidade={velocidade}
        ativo={ativo}
        montarAoEntrar={montarAoEntrar}
        interativo={interativo}
        pointerRef={pointerRef}
        interactionRef={interactionRef}
      />
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
  interativo = false,
  cameraPosition,
  cameraFov,
}) {
  const safeSize = Math.max(24, Number(tamanho) || 48)
  const resolvedSpeed = velocidade ?? (pausado ? 0.18 : 0.28)
  const shouldMountIntro = entrada ?? montarAoEntrar
  const pointerRef = useRef({ x: 0, y: 0 })
  const interactionRef = useRef(0)
  const containerClassName = cn(
    "inline-flex shrink-0 overflow-hidden rounded-[18%] select-none",
    interativo ? "cursor-grab touch-none" : "pointer-events-none",
    className,
  )
  const containerStyle = {
    width: safeSize,
    height: safeSize,
    maxWidth: "100%",
    maxHeight: "100%",
  }
  const resolvedCameraPosition = cameraPosition ?? (interativo ? [5.6, 4.3, 6.4] : [4.2, 3.2, 4.8])
  const resolvedCameraFov = cameraFov ?? (interativo ? 30 : 34)

  function handlePointerMove(event) {
    if (!interativo) {
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    if (!rect.width || !rect.height) {
      return
    }

    const normalizedX = ((event.clientX - rect.left) / rect.width - 0.5) * 2
    const normalizedY = ((event.clientY - rect.top) / rect.height - 0.5) * 2
    pointerRef.current = {
      x: Math.max(-1, Math.min(1, normalizedX)),
      y: Math.max(-1, Math.min(1, normalizedY)),
    }
    interactionRef.current = performance.now()
  }

  function handlePointerLeave() {
    if (!interativo) {
      return
    }

    pointerRef.current = { x: 0, y: 0 }
    interactionRef.current = performance.now()
  }

  return (
    <div
      className={containerClassName}
      style={containerStyle}
      aria-hidden="true"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <Canvas
        dpr={[1, 1.75]}
        frameloop={animado || shouldMountIntro || interativo ? "always" : "demand"}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: resolvedCameraPosition, fov: resolvedCameraFov }}
      >
        <Scene
          animado={animado}
          velocidade={resolvedSpeed}
          ativo={ativo}
          montarAoEntrar={shouldMountIntro}
          interativo={interativo}
          pointerRef={pointerRef}
          interactionRef={interactionRef}
        />
      </Canvas>
    </div>
  )
})

export default LogoCubo3D
