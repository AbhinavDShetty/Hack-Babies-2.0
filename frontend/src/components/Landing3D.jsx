import React, { Suspense, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  useGLTF,
  Html,
  OrbitControls,
  Stars,
} from "@react-three/drei";
import dnaModel from "../assets/dna_molecule.glb";

function DNAModel() {
  const { scene } = useGLTF(dnaModel);
  const ref = useRef();
  const [autoRotate, setAutoRotate] = useState(true);
  const [lastInteraction, setLastInteraction] = useState(Date.now());

  return (
    <primitive
      ref={ref}
      object={scene}
      scale={0.22}
      position={[0, -1, 0]}
      rotation={[0, Math.PI / 4, 0]}
    />
  );
}

function InteractiveControls({ setAutoRotate, setLastInteraction }) {
  const { gl, camera } = useThree();
  const controls = useRef();

  useFrame(() => controls.current?.update());

  return (
    <OrbitControls
      ref={controls}
      args={[camera, gl.domElement]}
      enablePan={false}
      enableDamping={true}
      dampingFactor={0.05}
      rotateSpeed={0.8}
      minDistance={3}
      maxDistance={10}
      autoRotate={false}
      onStart={() => {
        setAutoRotate(false);
        setLastInteraction(Date.now());
        gl.domElement.style.cursor = "grabbing";
      }}
      onEnd={() => {
        setLastInteraction(Date.now());
        gl.domElement.style.cursor = "grab";
      }}
    />
  );
}

export default function Landing3D() {
  const [autoRotate, setAutoRotate] = useState(true);
  const [lastInteraction, setLastInteraction] = useState(Date.now());

  return (
    <section
      id="landing-3d"
      className="relative flex flex-col md:flex-row items-center justify-between h-screen w-screen overflow-hidden px-6 md:px-12"
    >
      <div className="flex-1 flex flex-col justify-center items-center md:pl-20 z-10 mt-[-4vh]">
        <h1 className="text-4xl md:text-5xl font-semibold text-white mb-4 leading-tight">
          Explore Molecular Worlds
        </h1>
        <p className="text-gray-300 text-base md:text-lg max-w-md leading-relaxed">
          Dive into interactive 3D molecules, visualize DNA structures, and explore
          AI-generated molecular art in an immersive experience.
        </p>

        <button
          onClick={() =>
            window.scrollTo({ top: window.innerHeight, behavior: "smooth" })
          }
          className="mt-8 px-6 py-3 bg-linear-to-r from-indigo-500 to-purple-500 text-white font-semibold rounded-full shadow-lg hover:scale-105 transition-transform duration-300"
        >
          ↓ Scroll Down
        </button>
      </div>

      {/* 🧬 Right: 3D Model */}
      <div className="flex-1 h-[60vh] md:h-[80vh] mt-[-6vh] cursor-grab">
        <Canvas
          camera={{ position: [0, 2, 6], fov: 45 }}
          className="w-full h-full"
        >
          <ambientLight intensity={0.8} />
          <directionalLight position={[5, 5, 5]} intensity={1.2} />
          <Stars radius={100} depth={50} count={3000} factor={4} fade />

          <Suspense
            fallback={
              <Html>
                <div className="text-white font-poppins text-sm">Loading 3D model...</div>
              </Html>
            }
          >
            <DNAModel />
            <InteractiveControls
              setAutoRotate={setAutoRotate}
              setLastInteraction={setLastInteraction}
            />
            <Environment preset="studio" />
          </Suspense>
        </Canvas>
      </div>

      <div className="absolute w-screen inset-0 bg-linear-to-t from-black/20 to-transparent pointer-events-none" />
    </section>
  );
}
