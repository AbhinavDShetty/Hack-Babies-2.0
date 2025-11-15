import React from "react";

export default function MoleculeCard({ item, onSelect }) {
  return (
    <div
      onClick={() => onSelect(item)}
      className="
        group relative cursor-pointer
        rounded-2xl
        bg-white/[0.03]
        border border-white/[0.08]
        backdrop-blur-xl
        transition-all duration-300

        hover:bg-white/[0.06]
        hover:border-white/[0.15]
        hover:scale-[1.015]

        shadow-[0_4px_12px_rgba(0,0,0,0.20)]
        hover:shadow-[0_6px_20px_rgba(0,0,0,0.30)]

        flex items-center justify-center
        overflow-hidden
      "
      style={{ aspectRatio: "4/3" }}
    >
      {/* Molecule thumbnail container */}
      <div
        className="
          w-[75%] h-[75%]
          rounded-xl
          bg-[#0b1220]/70
          border border-white/[0.05]
          flex items-center justify-center
          transition-all duration-300
          group-hover:bg-[#0f172a]/80
        "
      >
        <img
          src={`http://127.0.0.1:8000${item.thumbnail}`}
          alt={item.name}
          className="
            w-[70%] h-[70%] object-contain
            transition-all duration-300
            group-hover:scale-105
            group-hover:opacity-100 opacity-90
          "
        />
      </div>

      {/* Floating minimal name label */}
      <div
        className="
          absolute bottom-3 left-1/2 -translate-x-1/2
          px-3 py-1 rounded-full
          text-xs font-medium text-white/90
          bg-white/[0.06] backdrop-blur-xl
          border border-white/[0.1]

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
