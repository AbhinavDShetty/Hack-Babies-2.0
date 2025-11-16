import React from "react";
import { X } from "lucide-react"; // Optional: nice icon

export default function MoleculeCard({ item, onSelect, userId, onDelete }) {

  // DELETE HANDLER
  const handleDelete = async (e) => {
    e.stopPropagation(); // prevent triggering onSelect
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/user/${userId}/models/delete/${item.id}/`,
        { method: "DELETE" }
      );

      if (!res.ok) throw new Error("Delete failed");
      if (onDelete) onDelete(item.id); // callback to parent to refresh UI

    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  return (
    <div
      onClick={() => onSelect(item)}
      className="
        group/card relative cursor-pointer
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
      {/* ---- DELETE BUTTON ---- */}
      <button
        onClick={handleDelete}
        className="
          absolute top-2 right-2 z-30
          opacity-0 group-hover/card:opacity-100
          transition-all duration-300

          bg-[rgba(255,40,40,0.25)]
          hover:bg-[rgba(255,40,40,0.45)]
          border border-red-400/40
          backdrop-blur-md
          text-white
          w-8 h-8 rounded-full

          flex items-center justify-center
          hover:scale-110 active:scale-95
          shadow-[0_0_10px_rgba(255,0,0,0.45)]
        "
      >
        <X size={16} />
      </button>

      {/* FULL COVER IMAGE */}
      <img
        src={`http://127.0.0.1:8000${item.thumbnail}`}
        alt={item.name}
        className="
          absolute inset-0 w-full h-full
          object-cover
          transition-transform duration-500
          group-hover/card:scale-110
        "
      />

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/20 group-hover/card:bg-black/30 transition-all duration-300"></div>

      {/* Floating minimal name label */}
      <div
        className="
          absolute bottom-3 left-1/2 -translate-x-1/2
          px-3 py-1 rounded-full
          text-xs font-medium text-white/90
          bg-black/40 backdrop-blur-md
          border border-white/10
          opacity-0 translate-y-2
          group-hover/card:opacity-100 group-hover/card:translate-y-0
          transition-all duration-300
        "
      >
        {item.name}
      </div>
    </div>
  );
}
