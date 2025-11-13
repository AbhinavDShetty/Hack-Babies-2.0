import React from "react";
import { motion } from "framer-motion";
import { Menu } from "lucide-react";

export default function Header({ onSidebarToggle }) {
  return (
    <>
      <motion.div
        className="
          header 
          w-full 
          text-center 
          fixed 
          top-0 
          left-0 
          z-2 
          py-4
          h-20
          bg-[rgba(255,255,255,0.07)]
          backdrop-blur-md
          border-b border-[rgba(255,255,255,0.15)]
          shadow-lg
        "
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div 
          className="
            logo 
            title 
            text-white 
            tracking-wide 
            drop-shadow-lg
          "
        >
          Moleculens.
        </div>
      </motion.div>
    </>
  );
}
