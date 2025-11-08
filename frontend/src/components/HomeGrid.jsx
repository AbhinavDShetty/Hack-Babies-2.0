import React, { useState } from "react";
import { motion } from "framer-motion";

const sampleData = {
  molecules: [
    { name: "Water Molecule", thumb: "/images/molecule1.jpg" },
    { name: "Glucose Structure", thumb: "/images/molecule2.jpg" },
    { name: "Caffeine Model", thumb: "/images/molecule3.jpg" },
    { name: "DNA Helix", thumb: "/images/molecule4.jpg" },
    { name: "Ethanol Molecule", thumb: "/images/molecule5.jpg" },
    { name: "Aspirin Structure", thumb: "/images/molecule6.jpg" },
    { name: "Cholesterol Model", thumb: "/images/molecule7.jpg" },
  ],
  reactions: [
    { name: "Combustion", thumb: "/images/reaction1.jpg" },
    { name: "Photosynthesis", thumb: "/images/reaction2.jpg" },
    { name: "Acid-Base Reaction", thumb: "/images/reaction3.jpg" },
  ],
  custom: [
    { name: "My Sucrose Blend", thumb: "/images/custom1.jpg" },
    { name: "Experiment Model", thumb: "/images/custom2.jpg" },
  ],
};

export default function HomeGrid() {
  const [expanded, setExpanded] = useState(null);

  const toggleCategory = (category) => {
    setExpanded(expanded === category ? null : category);
  };

  return (
    <div className="home-grid-section w-full flex flex-col gap-12 max-w-[1200px] mx-auto">
      {Object.entries(sampleData).map(([category, items]) => {
        const isExpanded = expanded === category;
        const hasMore = items.length > 4;

        return (
          <div key={category} className="w-full relative">
            {/* Category Header */}
            <motion.div
              className="flex justify-between items-center cursor-pointer mb-4 select-none"
              onClick={() => hasMore && toggleCategory(category)}
              whileHover={{ scale: hasMore ? 1.02 : 1 }}
            >
              <h2 className="text-xl font-bold bg-linear-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent capitalize">
                {category === "custom" ? "My Creations" : category}
              </h2>

              {hasMore && (
                <span className="text-sm text-slate-400">
                  {isExpanded ? "Show Less ▲" : "Show More ▼"}
                </span>
              )}
            </motion.div>

            {/* Smooth Expandable Grid Container */}
            <motion.div
              layout
              animate={{
                height: isExpanded ? "auto" : hasMore ? "180px" : "auto",
                opacity: 1,
              }}
              transition={{
                type: "spring",
                stiffness: 80,
                damping: 20,
              }}
              className="overflow-hidden relative px-1"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-4">
                {items.map((item, i) => (
                  <motion.div
                    key={i}
                    className="molecule-card transition-transform"
                    whileHover={{ scale: 1.05 }}
                  >
                    <img
                      src={item.thumb}
                      alt={item.name}
                      className="molecule-thumb"
                    />
                    <div className="molecule-title">{item.name}</div>
                  </motion.div>
                ))}
              </div>

              {/* Fade gradient overlay for collapsed state */}
              {hasMore && !isExpanded && (
                <div className="absolute bottom-0 left-0 w-full h-20 bg-linear-to-t from-[#0f172a] to-transparent pointer-events-none" />
              )}
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}