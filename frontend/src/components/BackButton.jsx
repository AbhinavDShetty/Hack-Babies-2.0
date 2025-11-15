import React from "react";
import { ArrowLeft } from "lucide-react";

export default function BackButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-5 py-2.5 rounded-full 
                 border border-[rgba(255,255,255,0.15)] 
                 bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(99,102,241,0.2)] 
                 transition-all duration-300 backdrop-blur-md 
                 shadow-[0_0_15px_rgba(99,102,241,0.25)] 
                 text-white fixed top-7 left-20 z-500 cursor-pointer"
    >
      <ArrowLeft size={20} />
      <span className="font-medium">Back</span>
    </button>
  );
}
