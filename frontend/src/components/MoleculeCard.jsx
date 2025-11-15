import React from "react";

export default function MoleculeCard({ item, onSelect }) {
  return (
    <div
      onClick={() => onSelect(item)}
      className="
        group relative cursor-pointer
        rounded-2xl
        bg-white/3
        border border-white/8
        backdrop-blur-xl
        transition-all duration-300
        hover:bg-white/6
        hover:border-white/15
        hover:scale-[1.015]
        shadow-[0_4px_12px_rgba(0,0,0,0.20)]
        hover:shadow-[0_6px_20px_rgba(0,0,0,0.30)]
        overflow-hidden
        flex items-center justify-center
      "
      style={{ aspectRatio: "4/3" }}
    >
      {/* FULL COVER IMAGE */}
      <img
        src={`http://127.0.0.1:8000${item.thumbnail}`}
        alt={item.name}
        className="
          absolute inset-0 w-full h-full
          object-cover
          transition-transform duration-500
          group-hover:scale-110
        "
      />

      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-all duration-300"></div>

      {/* Floating minimal name label */}
      <div
        className="
          absolute bottom-3 left-1/2 -translate-x-1/2
          px-3 py-1 rounded-full
          text-xs font-medium text-white/90
          bg-black/40 backdrop-blur-md
          border border-white/10
          opacity-0 translate-y-2
          group-hover:opacity-100 group-hover:translate-y-0
          transition-all duration-300
        "
      >
        {item.name}
      </div>
    </div>
  );
}
