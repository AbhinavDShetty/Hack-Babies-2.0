// src/components/DiagonalWipe.jsx
import React from "react";
import { motion } from "framer-motion";

export default function DiagonalWipe({ progress }) {
  // progress = 0 → off screen bottom-left
  // progress = 1 → fully covers screen

  // map progress (0–1) to clip-path diagonal sweep
  const pct = progress * 120; // overshoot for clean wipe

  const clip = `
      polygon(
        ${-80 + pct}% 100%,   /* Bottom-left start */
        ${pct}% 100%,
        ${pct - 20}% 0%,
        ${pct - 100}% 0%
      )
    `;

  return (
    <motion.div
      className="
        pointer-events-none
        fixed inset-0 z-[38]
        backdrop-blur-[20px]
        bg-[rgba(10,15,25,0.6)]
        border-t border-white/5
      "
      style={{
        clipPath: clip,
        transition: "clip-path 0.25s ease-out",
      }}
    />
  );
}
