// frontend/src/components/ReactionViewer.jsx
import React, { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Html } from "@react-three/drei";
import { motion } from "framer-motion";
import * as THREE from "three";

function Atom({ name, symbol, initialPosition, color }) {
  const mesh = useRef();
  const [position, setPosition] = useState(initialPosition);

  // Update mesh position each frame
  useEffect(() => {
    if (mesh.current) {
      mesh.current.position.set(...position);
    }
  }, [position]);

  return (
    <mesh ref={mesh}>
      <sphereGeometry args={[0.15, 32, 32]} />
      <meshStandardMaterial color={color || "white"} />
    </mesh>
  );
}

function ReactionScene({ reactionData, isPlaying, frameIndex }) {
  const groupRef = useRef();

  // Extract animation data
  const frames = reactionData?.frames || [];
  const atomMap = reactionData?.atom_map || {};
  const reactantAtoms = Object.keys(atomMap);
  const productAtoms = Object.values(atomMap);

  // Each atom will be represented as a sphere
  const atomsRef = useRef([]);

  // Update atom positions based on frames
  useFrame(() => {
    if (!isPlaying || frames.length === 0) return;

    const frame = frames[frameIndex];
    if (!frame) return;

    atomsRef.current.forEach((atom, i) => {
      const name = reactantAtoms[i];
      const pos = frame[name];
      if (pos && atom) atom.position.set(pos[0], pos[1], pos[2]);
    });
  });

  return (
    <group ref={groupRef}>
      {reactantAtoms.map((name, i) => {
        const color =
          name.startsWith("C") ? "gray" :
          name.startsWith("H") ? "white" :
          name.startsWith("O") ? "red" :
          name.startsWith("N") ? "blue" :
          "yellow";
        return (
          <mesh ref={(el) => (atomsRef.current[i] = el)} key={i}>
            <sphereGeometry args={[0.15, 32, 32]} />
            <meshStandardMaterial color={color} />
          </mesh>
        );
      })}
    </group>
  );
}

export default function ReactionViewer({ reactionData }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [frameIndex, setFrameIndex] = useState(0);

  const frames = reactionData?.frames || [];
  const equation = reactionData?.reaction || "Reaction";

  // Loop animation frames
  useEffect(() => {
    if (!isPlaying || frames.length === 0) return;
    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % frames.length);
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying, frames]);

  if (!reactionData || !frames.length) {
    return (
      <div className="w-full text-center py-10 text-gray-500">
        🧪 No reaction loaded yet.
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center p-4">
      {/* Reaction Title */}
      <motion.h2
        className="text-2xl md:text-3xl font-semibold text-center mb-4 text-gray-200"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        ⚛️ {equation}
      </motion.h2>

      {/* 3D Canvas */}
      <div className="w-full h-[500px] bg-black/40 rounded-2xl shadow-inner relative overflow-hidden">
        <Canvas camera={{ position: [0, 0, 6], fov: 50 }}>
          <ambientLight intensity={0.8} />
          <pointLight position={[5, 5, 5]} intensity={1.5} />
          <Environment preset="studio" />
          <Suspense
            fallback={
              <Html center>
                <div className="text-gray-300 text-sm">Loading animation...</div>
              </Html>
            }
          >
            <ReactionScene
              reactionData={reactionData}
              isPlaying={isPlaying}
              frameIndex={frameIndex}
            />
          </Suspense>
          <OrbitControls enablePan enableZoom enableRotate />
        </Canvas>

        {/* Play Controls */}
        <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-gray-800/70 px-4 py-2 rounded-xl">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="text-white text-lg font-semibold"
          >
            {isPlaying ? "⏸ Pause" : "▶ Play"}
          </button>
          <button
            onClick={() => {
              setIsPlaying(false);
              setFrameIndex(0);
            }}
            className="text-white text-lg font-semibold"
          >
            🔁 Reset
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-2/3 mt-4 h-2 bg-gray-600 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-green-400"
          style={{
            width: `${(frameIndex / (frames.length || 1)) * 100}%`,
          }}
          animate={{
            width: `${(frameIndex / (frames.length || 1)) * 100}%`,
          }}
        />
      </div>
    </div>
  );
}
