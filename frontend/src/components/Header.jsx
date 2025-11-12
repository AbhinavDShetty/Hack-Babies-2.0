import React from "react";
import { motion } from "framer-motion";
import { Menu } from "lucide-react";

export default function Header({ onSidebarToggle }) {
  return (
    <>
      <motion.div
        className="header w-full text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="logo title">Moleculens.</div>
      </motion.div>
    </>
  );
}
