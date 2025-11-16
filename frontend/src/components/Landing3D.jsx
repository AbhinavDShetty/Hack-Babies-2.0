// src/components/Landing3D.jsx
import React, { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Html } from "@react-three/drei";

import DNAModel from "./DNAModel";
import LockedControls from "./LockedControls";
import heroBg from "../assets/hero_bg.jpg";

const SCROLL_MAX = 600;
const BLUR_MAX = 10;
const LIFT_MAX = 60;

const DIAGONAL_PIXELS = 2000;

export default function Landing3D() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const p = Math.min(scrollY / SCROLL_MAX, 1);

  // Hero fading
  const fade = 1 - p * 0.65;
  const blur = p * BLUR_MAX;
  const lift = p * LIFT_MAX;

  // Smooth diagonal movement (pixels, not percentages!)
  const dx = p * DIAGONAL_PIXELS;
  const dy = p * DIAGONAL_PIXELS;

  return (
    <>
      {/* ================================================
          DIAGONAL WIPE — SCROLL CONTROLLED ONLY
      ================================================= */}
      <div className="fixed inset-0 pointer-events-none z-60 overflow-hidden">
        <div
          style={{
            position: "absolute",
            width: "300vw",
            height: "300vh",
            left: "-200vw",
            top: "100vh",
            opacity: 0.5,

            background: "rgba(0,0,0,0.92)",

            // pixel based = smooth + predictable
            transform: `translate(${dx}px, -${dy}px) rotate(45deg)`,
          }}
        />
      </div>

      {/* ================================================
          HERO SECTION — fades/lifts/blur on scroll
      ================================================= */}
      <section
        className="fixed inset-0 w-full h-screen overflow-hidden"
        style={{
          opacity: fade,
          filter: `blur(${blur}px)`,
          transform: `translateY(-${lift}px)`,
          transition:
            "opacity .2s linear, filter .2s linear, transform .2s linear",
          zIndex: 50,
        }}
      >
        {/* BACKGROUND */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${heroBg})`,
            filter: "blur(3px)",
            transform: "scale(1.08)",
          }}
        />

        <div className="absolute inset-0 bg-[rgba(10,10,12,0.25)]" />

        {/* TEXT */}
        <div className="absolute top-[22vh] left-20 z-200 select-none max-w-xl">
          <div className="flex flex-col items-start text-left space-y-4">
            <h1
              className="font-extrabold leading-[1.05] text-white"
              style={{ fontSize: "clamp(3.5rem, 5vw, 6rem)" }}
            >
              Explore <br /> Secrets of Matter
            </h1>

            <p className="text-lg text-white/70 max-w-md">
              Visualize and interact with molecular structures
            </p>
          </div>
        </div>

        {/* DNA MODEL */}
        <div className="absolute right-0 top-0 h-full w-[50%] z-150 pointer-events-none">
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
    </>
  );
}
