import React, { Suspense, useRef, useEffect } from "react";
import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber";
import { Environment, Html, OrbitControls, Stars } from "@react-three/drei";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { AnimationMixer, LoopRepeat } from "three";
import * as THREE from "three";

import dnaModel from "../assets/dna_molecule_final.fbx";

const MODEL_OFFSET = {
  x: 20,
  y: -5,
  z: 0
};

const MODEL_ROTATION = [0, Math.PI / 2, 0];
const MODEL_SCALE = 0.3;
function DNAModel() {
  const fbx = useLoader(FBXLoader, dnaModel);

  const pivot = useRef();
  const model = useRef();
  const mixerRef = useRef();
  const scrollRotation = useRef(0);

  // Center model inside pivot
  useEffect(() => {
    if (fbx && model.current) {
      const box = new THREE.Box3().setFromObject(model.current);
      const center = box.getCenter(new THREE.Vector3());
      model.current.position.sub(center);
    }
  }, [fbx]);

  // Animation setup
  useEffect(() => {
    if (fbx.animations?.length > 0) {
      const mixer = new AnimationMixer(fbx);
      const action = mixer.clipAction(fbx.animations[0]);
      action.setLoop(LoopRepeat, Infinity).play();
      mixerRef.current = mixer;
    }
  }, [fbx]);

  //rotate on scroll
  useEffect(() => {
    let lastScroll = window.scrollY;

    const handleScroll = () => {
      const now = window.scrollY;
      const delta = now - lastScroll;

      scrollRotation.current += delta * 0.01;

      lastScroll = now;
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Scroll rotation
  useFrame(() => {
    if (mixerRef.current) mixerRef.current.update(1 / 60);
    if (pivot.current) pivot.current.rotation.y = scrollRotation.current;
  });

  return (
    <group
      ref={pivot}
      position={[MODEL_OFFSET.x, MODEL_OFFSET.y, MODEL_OFFSET.z]}
      rotation={MODEL_ROTATION}
    >
      <primitive ref={model} object={fbx} scale={MODEL_SCALE} />
    </group>
  );
}

function VerticalLockedControls() {
  const { gl, camera } = useThree();
  const controls = useRef();

  useFrame(() => controls.current?.update());

  useEffect(() => {
    if (controls.current) {
      controls.current.target.set(MODEL_OFFSET.x, 0, 0);
      controls.current.update();
    }
  }, []);

  return (
    <OrbitControls
      ref={controls}
      args={[camera, gl.domElement]}
      enablePan={false}
      enableZoom={false}
      enableDamping
      dampingFactor={0.05}
      minPolarAngle={Math.PI / 2}
      maxPolarAngle={Math.PI / 2}
      rotateSpeed={0.8}
      minAzimuthAngle={-Infinity}
      maxAzimuthAngle={Infinity}
    />
  );
}

export default function Landing3D() {
  return (
    <section
      id="landing-3d"
      className="relative flex flex-col md:flex-row items-center justify-between h-screen w-screen overflow-hidden px-6 md:px-12"
    >
      {/* Left Text Content */}
      <div className="absolute flex-1 flex flex-col justify-center items-start md:pl-20 z-10 text-left">
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
          ↓ Get Started
        </button>
      </div>

      {/* 3D Canvas */}
      <div className="flex-1 w-screen h-screen md:h-screen flex justify-end">
        <div className="w-[45%] h-full cursor-grab">  {/* adjust 45% → 40% → 35% */}
          <Canvas camera={{ position: [0, 2, 6], fov: 45 }} className="w-full h-full">
            <ambientLight intensity={1} />
            <directionalLight position={[5, 5, 5]} intensity={1.2} />
            <Stars radius={100} depth={50} count={3000} factor={4} fade />

            <Suspense fallback={<Html><div className="text-white">Loading 3D model...</div></Html>}>
              <DNAModel />
              <VerticalLockedControls />
              <Environment preset="studio" />
            </Suspense>
          </Canvas>
        </div>
      </div>


      {/* Overlay */}
      <div className="absolute w-screen inset-0 bg-linear-to-t from-black/30 to-transparent pointer-events-none" />
    </section>
  );
}
