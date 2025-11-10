import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment } from "@react-three/drei";

function DNAModel() {
  const { scene } = useGLTF("..//assets//dna_molecule.glb");
  return <primitive object={scene} scale={1.5} position={[0, -1, 0]} />;
}

export default function DNAViewer() {
  return (
    <div style={{ height: "100vh", width: "100%", background: "black" }}>
      <Canvas camera={{ position: [0, 1, 4], fov: 45 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1.5} />
        <Suspense fallback={null}>
          <DNAModel />
          <Environment preset="studio" />
        </Suspense>
        <OrbitControls enableZoom={true} autoRotate autoRotateSpeed={1.5} />
      </Canvas>
    </div>
  );
}
