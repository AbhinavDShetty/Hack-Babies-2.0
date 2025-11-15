// src/components/Landing3D.jsx
import React, { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Html } from "@react-three/drei";

import DNAModel from "./DNAModel";
import LockedControls from "./LockedControls";
import heroBg from "../assets/hero_bg.jpg";

/* ---------------------------------------------------------
   CONSTANTS
--------------------------------------------------------- */
const SCROLL_MAX = 600; // Pixels until full reveal
const BLUR_MAX = 10; // Max blur
const LIFT_MAX = 60; // Max upward shift
const MASK_MOVE = 140; // % the mask travels
const MASK_ROTATION = -30; // Rotation of mask rectangle

export default function Landing3D() {
  const [scrollY, setScrollY] = useState(0);

  /* Track scroll safely */
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /* Normalized scroll progress 0 → 1 */
  const p = Math.min(scrollY / SCROLL_MAX, 1);

  /* Derived visual transforms */
  const fade = 1 - p * 0.65;
  const blur = p * BLUR_MAX;
  const lift = p * LIFT_MAX;

  /* Diagonal wipe mask movement */
  const maskX = 50 - p * MASK_MOVE;
  const maskY = -50 + p * MASK_MOVE;

  return (
    <section
      className="fixed inset-0 w-full h-screen overflow-hidden"
      style={{
        opacity: fade,
        filter: `blur(${blur}px)`,
        transform: `translateY(-${lift}px)`,
        transition:
          "opacity .18s linear, filter .18s linear, transform .18s linear",
        pointerEvents: fade < 0.12 ? "none" : "auto",
        zIndex: 50,
      }}
    >
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${heroBg})` }}
      />

      {/* Contrast enhancement overlay */}
      <div className="absolute inset-0 bg-[rgba(10,10,12,0.25)]" />

      {/* DIAGONAL WIPE MASK */}
      <div className="absolute inset-0 pointer-events-none z-[140] overflow-hidden">
        <div
          style={{
            position: "absolute",
            width: "220%",
            height: "220%",
            left: "-60%",
            top: "-60%",
            background: "rgba(0,0,0,0.75)",
            transform: `translate(${maskX}%, ${maskY}%) rotate(${MASK_ROTATION}deg)`,
            transformOrigin: "50% 50%",
          }}
        />
      </div>

      {/* HERO TEXT */}
      <div className="absolute top-[22vh] left-20 z-[200] select-none max-w-xl">
        <h1
          className="font-extrabold leading-tight text-white"
          style={{ fontSize: "clamp(3.5rem, 5vw, 6rem)" }}
        >
          Explore <br /> Secrets of Matter
        </h1>

        <p className="mt-6 text-lg text-white/70 max-w-md">
          Visualize and interact with molecular structures
        </p>

        <button
          onClick={() =>
            window.scrollTo({ top: window.innerHeight, behavior: "smooth" })
          }
          className="mt-8 px-8 py-3 rounded-full text-white font-semibold shadow-lg transition-transform hover:scale-105"
          style={{ background: "linear-gradient(90deg,#5c6cff,#8f6bff)" }}
        >
          Get Started →
        </button>
      </div>

      {/* 3D DNA VIEWER */}
      <div className="absolute right-0 top-0 h-full w-[50%] z-[150] pointer-events-none">
        <Canvas
          gl={{ alpha: true }}
          camera={{ position: [0, 1.2, 10], fov: 45 }}
          className="w-full h-full"
        >
          <ambientLight intensity={1.0} />
          <directionalLight intensity={1.3} position={[5, 5, 5]} />

          <Suspense fallback={<Html>Loading…</Html>}>
            <DNAModel scale={[0.1, 0.1, 0.1]} offset={[0, -2, 0]} />
            <LockedControls target={[0, -2, 0]} />
            <Environment preset="city" />
          </Suspense>
        </Canvas>
      </div>
    </section>
  );
}
