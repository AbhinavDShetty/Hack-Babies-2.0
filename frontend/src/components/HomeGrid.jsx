import React from "react";
import { motion } from "framer-motion";

const premadeModels = [
  { name: "DNA Helix", thumbnail: "/thumbs/dna.png" },
  { name: "Caffeine Molecule", thumbnail: "/thumbs/caffeine.png" },
  { name: "Glucose Molecule", thumbnail: "/thumbs/glucose.png" },
  { name: "Protein Chain", thumbnail: "/thumbs/protein.png" },
  { name: "Benzene Ring", thumbnail: "/thumbs/benzene.png" },
  { name: "Ammonia Molecule", thumbnail: "/thumbs/ammonia.png" },
];

export default function HomeGrid() {
  return (
    <motion.div
      className="home-grid-section"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="molecule-grid">
        {premadeModels.map((m, i) => (
          <motion.div
            key={i}
            whileHover={{ scale: 1.03 }}
            transition={{ duration: 0.25 }}
            className="molecule-card"
          >
            <img src={m.thumbnail} alt={m.name} className="molecule-thumb" />
            <div className="molecule-title">{m.name}</div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
