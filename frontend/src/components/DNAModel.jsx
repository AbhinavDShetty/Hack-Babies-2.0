// src/components/DNAModel.jsx
import React, { useRef, useEffect } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { AnimationMixer, LoopRepeat } from "three";
import * as THREE from "three";

import dnaModel from "../assets/dna_molecule_final.fbx";

export default function DNAModel({ scale, offset, rotation }) {
  const fbx = useLoader(FBXLoader, dnaModel);
  const pivot = useRef();
  const model = useRef();
  const mixerRef = useRef();
  const scrollRotation = useRef(0);

  // recenter model
  useEffect(() => {
    if (fbx && model.current) {
      const box = new THREE.Box3().setFromObject(model.current);
      const center = box.getCenter(new THREE.Vector3());
      model.current.position.sub(center);
    }
  }, [fbx]);

  // animation
  useEffect(() => {
    if (fbx?.animations?.length > 0) {
      const mixer = new AnimationMixer(fbx);
      const action = mixer.clipAction(fbx.animations[0]);
      action.setLoop(LoopRepeat, Infinity).play();
      mixerRef.current = mixer;
    }
  }, [fbx]);

  // scroll-based rotation
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const now = window.scrollY;
      scrollRotation.current += (now - last) * 0.002;
      last = now;
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // update frame
  useFrame(() => {
    if (mixerRef.current) mixerRef.current.update(1 / 60);
    if (pivot.current)
      pivot.current.rotation.y +=
        (scrollRotation.current - pivot.current.rotation.y) * 0.08;
  });

  return (
    <group ref={pivot} position={offset} rotation={rotation}>
      <primitive ref={model} object={fbx} scale={scale} />
    </group>
  );
}
