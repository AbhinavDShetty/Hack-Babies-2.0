import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Html, useGLTF } from "@react-three/drei";
import { motion } from "framer-motion";

function MoleculeModel({ url }) {
  // Load the GLB model dynamically
  const { scene } = useGLTF(url);
  return <primitive object={scene} scale={1.2} />;
}

export default function ModelViewer({ src }) {
  return (
    <motion.div
      className="w-full h-full rounded-2xl overflow-hidden border border-[rgba(255,255,255,0.12)] 
                 bg-[rgba(255,255,255,0.03)] backdrop-blur-md shadow-[0_0_30px_rgba(99,102,241,0.2)]"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {src ? (
        <Canvas
          camera={{ position: [0, 0, 4], fov: 45 }}
          style={{ width: "100%", height: "100%" }}
        >
          {/* Ambient lighting */}
          <ambientLight intensity={0.8} />

          {/* Directional light to create strong highlights */}
          <directionalLight position={[5, 5, 5]} intensity={1.5} />

          {/* Soft fill light */}
          <pointLight position={[-5, -5, -5]} intensity={0.5} />

          <Suspense
            fallback={
              <Html center>
                <div className="text-gray-300 text-sm">Loading 3D model...</div>
              </Html>
            }
          >
            <MoleculeModel url={src} />
            <Environment preset="studio" />
          </Suspense>

          <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
        </Canvas>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-400">
          No model loaded yet.
        </div>
      )}
    </motion.div>
  );
}
