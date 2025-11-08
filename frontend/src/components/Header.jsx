import React from "react";
import { motion } from "framer-motion";
import { Menu } from "lucide-react";

export default function Header({ onSidebarToggle }) {
  return (
    <>
      {/* Fixed sidebar button (absolute position, top-left of entire page) */}
      <button
        onClick={onSidebarToggle}
        className="menu-btn fixed top-6 left-6 z-1000 p-3 rounded-full border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.08)] backdrop-blur-md hover:bg-[rgba(99,102,241,0.2)] transition-all shadow-[0_0_10px_rgba(99,102,241,0.3)]"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Menu size={22} color="#a5b4fc" />
      </button>

      <motion.div
        className="header w-full text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="logo">🧬 Hack Babies Presents</div>
        <div className="logo title">Project Name</div>
      </motion.div>
    </>
  );
}
