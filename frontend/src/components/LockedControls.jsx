// src/components/LockedControls.jsx
import React, { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

export default function LockedControls({ target }) {
  const { gl, camera } = useThree();
  const controls = useRef();

  useFrame(() => controls.current?.update());

  useEffect(() => {
    if (controls.current) {
      controls.current.target.set(...target);
      controls.current.update();
    }
  }, [target]);

  return (
    <OrbitControls
      ref={controls}
      args={[camera, gl.domElement]}
      enablePan={false}
      enableZoom={false}
      enableDamping
      dampingFactor={0.06}
      minPolarAngle={Math.PI / 2.3}
      maxPolarAngle={Math.PI / 2.3}
    />
  );
}
