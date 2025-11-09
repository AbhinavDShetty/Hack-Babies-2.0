// frontend/src/components/ReactionViewer.jsx
import React, { useRef, useEffect, useState, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import * as THREE from "three";
import { motion } from "framer-motion";

// ========================================================
// Subcomponent: Atom Sphere
// ========================================================
function AtomSphere({ atom, color }) {
  const mesh = useRef();

  // Smooth position animation between frames
  useFrame(() => {
    if (atom && mesh.current) {
      const target = new THREE.Vector3(...atom.position);
      mesh.current.position.lerp(target, 0.2); // smooth interpolation
    }
  });

  return (
    <mesh ref={mesh}>
      <sphereGeometry args={[atom.symbol === "H" ? 0.15 : 0.25, 24, 24]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

// ========================================================
// Subcomponent: Bond Cylinder
// ========================================================
function BondCylinder({ start, end }) {
  const ref = useRef();

  useEffect(() => {
    if (!ref.current) return;
    const dir = new THREE.Vector3().subVectors(end, start);
    const len = dir.length();
    ref.current.position.copy(start).addScaledVector(dir, 0.5);
    ref.current.scale.set(1, len, 1);
    ref.current.lookAt(end);
  }, [start, end]);

  return (
    <mesh ref={ref}>
      <cylinderGeometry args={[0.05, 0.05, 1, 12]} />
      <meshStandardMaterial color="#aaa" />
    </mesh>
  );
}

// ========================================================
// Main Scene Component
// ========================================================
function ReactionScene({ frames, reactantBonds, productBonds, isPlaying }) {
  const [frameIndex, setFrameIndex] = useState(0);

  const atomColors = {
    H: "#ffffff",
    C: "#333333",
    O: "#ff0000",
    N: "#0066ff",
    Cl: "#00ff00",
    Na: "#0077ff",
    S: "#ffcc00",
  };

  const totalFrames = frames?.length || 0;

  // Cycle through animation frames
  useEffect(() => {
    if (!isPlaying || totalFrames === 0) return;
    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % totalFrames);
    }, 100); // 10 FPS
    return () => clearInterval(interval);
  }, [isPlaying, totalFrames]);

  const atoms = frames?.[frameIndex] || [];

  // Interpolate bonds from reactant to product
  const blend = frameIndex / totalFrames;
  const interpolatedBonds =
    blend < 0.5 ? reactantBonds : productBonds;

  return (
    <>
      {/* Lights */}
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 5, 5]} intensity={1.5} />
      <Environment preset="studio" />

      {/* Atoms */}
      {atoms.map((atom, i) => (
        <AtomSphere
          key={i}
          atom={atom}
          color={atomColors[atom.symbol] || "#aaaaaa"}
        />
      ))}

      {/* Bonds */}
      {interpolatedBonds.map(([i, j], idx) => {
        if (!atoms[i] || !atoms[j]) return null;
        const start = new THREE.Vector3(...atoms[i].position);
        const end = new THREE.Vector3(...atoms[j].position);
        return <BondCylinder key={idx} start={start} end={end} />;
      })}
    </>
  );
}

// ========================================================
// Main Viewer Wrapper
// ========================================================
export default function ReactionViewer({ reactionData }) {
  const [isPlaying, setIsPlaying] = useState(true);

  if (!reactionData?.frames?.length) {
    return (
      <div className="w-full text-center py-10 text-gray-500">
        🧪 No reaction loaded yet.
      </div>
    );
  }

  const { frames, reaction, reactant_bonds, product_bonds } = reactionData;

  return (
    <div className="w-full flex flex-col items-center p-4">
      {/* Title */}
      <motion.h2
        className="text-2xl md:text-3xl font-semibold text-center mb-4 text-gray-200"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        ⚛️ {reaction || "Reaction"}
      </motion.h2>

      {/* 3D Canvas */}
      <div className="w-full h-[500px] bg-black/40 rounded-2xl shadow-inner relative overflow-hidden">
        <Canvas camera={{ position: [0, 0, 8], fov: 50 }}>
          <ReactionScene
            frames={frames}
            reactantBonds={reactionData.reactant_bonds || []}
            productBonds={reactionData.product_bonds || []}
            isPlaying={isPlaying}
          />
          <OrbitControls enableZoom enablePan />
        </Canvas>

        {/* Controls */}
        <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-gray-800/70 px-4 py-2 rounded-xl">
          <button
            onClick={() => setIsPlaying((v) => !v)}
            className="text-white text-lg font-semibold"
          >
            {isPlaying ? "⏸ Pause" : "▶ Play"}
          </button>
          <button
            onClick={() => setIsPlaying(true)}
            className="text-white text-lg font-semibold"
          >
            🔁 Restart
          </button>
        </div>
      </div>

      {/* Labels */}
      <p className="text-gray-400 text-sm mt-2 italic">
        Atoms morph and bonds reform dynamically ✨
      </p>
    </div>
  );
}
