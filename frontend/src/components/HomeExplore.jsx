// src/components/HomeExplore.jsx
import React, { useEffect, useState } from "react";
import MoleculeCard from "./MoleculeCard";

export default function HomeExplore({ onSelectModel, userId }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch("http://127.0.0.1:8000/api/templates/");
      const json = await res.json();
      setItems(Object.values(json).flat());
    };
    fetchData();
  }, []);

  return (
    <section
      id="home-explore"
      className="
        w-full min-h-screen 
        px-8 md:px-24 
        pt-32 pb-32
        bg-white/10 backdrop-blur-3xl
        border-t border-white/10
        shadow-[0_-10px_40px_rgba(0,0,0,0.4)]
      "
    >
      {/* HEADER */}
      <h2 className="text-5xl md:text-7xl font-bold text-white text-center mb-16 tracking-tight">
        Explore Molecules
      </h2>

      {/* GRID */}
      <div
        className="
          grid 
          grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 
          gap-12
        "
      >
        {items.map((item, idx) => (
          <MoleculeCard key={idx} item={item} onSelect={onSelectModel} />
        ))}
      </div>
    </section>
  );
}
