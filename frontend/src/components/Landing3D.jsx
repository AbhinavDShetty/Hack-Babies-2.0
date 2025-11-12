import React, { Suspense, useRef, useEffect } from "react";
import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber";
import { Environment, Html, OrbitControls, Stars } from "@react-three/drei";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { AnimationMixer, LoopRepeat } from "three";
import dnaModel from "../assets/dna_molecule_final.fbx";

function DNAModel() {
  const fbx = useLoader(FBXLoader, dnaModel);
  const ref = useRef();
  const mixerRef = useRef();

  // 🎞 Setup animation once the model loads
  useEffect(() => {
    if (fbx.animations && fbx.animations.length > 0) {
      const mixer = new AnimationMixer(fbx);
      const action = mixer.clipAction(fbx.animations[0]);
      action.setLoop(LoopRepeat, Infinity); // loop forever
      action.play();
      mixerRef.current = mixer;
    }
  }, [fbx]);

  // 🔄 Update animation and rotation each frame
  useFrame((_, delta) => {
    if (mixerRef.current) mixerRef.current.update(delta);
    if (ref.current) {
      // ✅ continuous spin around Y-axis
      ref.current.rotation.y += 0.01;
    }
  });

  return (
    <primitive
      ref={ref}
      object={fbx}
      scale={0.125}
      position={[5, 0, 0]} // placed to the right
      rotation={[Math.PI / 20, Math.PI / 2, 0]} // upright orientation
    />
  );
}

function VerticalLockedControls() {
  const { gl, camera } = useThree();
  const controls = useRef();

  useFrame(() => controls.current?.update());

  useEffect(() => {
    if (controls.current) {
      // orbit target on the DNA model
      controls.current.target.set(5, 0, 0);
      controls.current.update();
    }
  }, []);

  return (
    <OrbitControls
      ref={controls}
      args={[camera, gl.domElement]}
      enablePan={false}
      enableZoom={false}
      enableDamping={true}
      dampingFactor={0.05}
      // Lock X-axis (vertical tilt) by fixing polar angle to 90 degrees (PI/2)
      minPolarAngle={Math.PI / 2}
      maxPolarAngle={Math.PI / 2}
      // Allow horizontal rotation around Y-axis freely
      minAzimuthAngle={-Infinity}
      maxAzimuthAngle={Infinity}
      rotateSpeed={0.8}
      autoRotate={false}
    />
  );
}

export default function Landing3D() {
  return (
    <section
      id="landing-3d"
      className="relative flex flex-col md:flex-row items-center justify-between h-screen w-screen overflow-hidden px-6 md:px-12"
    >
      {/* --- Left Text Content --- */}
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

      {/* --- Right 3D Canvas --- */}
      <div className="flex-1 w-screen h-screen md:h-screen cursor-grab">
        <Canvas camera={{ position: [0, 2, 6], fov: 45 }} className="w-full h-full">
          <ambientLight intensity={1} />
          <directionalLight position={[5, 5, 5]} intensity={1.2} />
          <Stars radius={100} depth={50} count={3000} factor={4} fade />

          <Suspense
            fallback={
              <Html>
                <div className="text-white font-poppins text-sm">
                  Loading 3D model...
                </div>
              </Html>
            }
          >
            <DNAModel />
            <VerticalLockedControls />
            <Environment preset="studio" />
          </Suspense>
        </Canvas>
      </div>

      {/* --- Overlay gradient --- */}
      <div className="absolute w-screen inset-0 bg-linear-to-t from-black/30 to-transparent pointer-events-none" />
    </section>
  );
}
