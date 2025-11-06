import React from "react";
import { motion } from "framer-motion";

export default function Sidebar({ isOpen }) {
  return (
    <motion.div
      initial={{ x: "-100%" }}
      animate={{ x: isOpen ? 0 : "-100%" }}
      transition={{ type: "spring", stiffness: 120, damping: 18 }}
      className="sidebar px-10 pt-16 pb-6"
    >
    <h2 className="text-lg font-semibold mb-6 ml-12 bg-linear-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
        Menu
    </h2>

      <ul className="space-y-4 text-gray-300 w-full">
        <li className="hover:text-indigo-300 cursor-pointer transition-all">Previous Chats</li>
        <li className="hover:text-indigo-300 cursor-pointer transition-all">Settings</li>
        <li className="hover:text-indigo-300 cursor-pointer transition-all">About</li>
      </ul>
    </motion.div>
  );
}
