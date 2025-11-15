import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import MoleculeCard from "./MoleculeCard";

export default function HomeGrid({ onSelectModel, userId }) {
  const [data, setData] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/templates/");
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Error fetching templates:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <section
      className="
        w-screen min-h-screen 
        px-10 md:px-20 
        pt-36 pb-20
        backdrop-blur-2xl
        bg-[rgba(0,0,0,0.25)]
        border-t border-[rgba(255,255,255,0.12)]
      "
      style={{ transition: "opacity 0.35s ease-out" }}
    >
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
        className="text-6xl md:text-7xl font-bold text-white mb-20 text-center"
      >
        Explore Molecules
      </motion.h2>

      {loading ? (
        <div className="text-center text-gray-300 text-lg">Loading...</div>
      ) : (
        <div className="flex flex-col gap-28">
          {Object.entries(data).map(([category, items]) => {
            const isExpanded = expanded === category;
            const hasMore = items.length > 4;

            return (
              <div key={category}>
                {/* CATEGORY HEADER */}
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-3xl font-bold text-white">
                    {category === "custom" ? "My Creations" : category}
                  </h3>

                  {hasMore && (
                    <button
                      onClick={() => setExpanded(isExpanded ? null : category)}
                      className="text-sm text-gray-300 hover:text-white"
                    >
                      {isExpanded ? "Show Less ▲" : "Show More ▼"}
                    </button>
                  )}
                </div>

                {/* GRID */}
                <motion.div
                  layout
                  animate={{
                    height: isExpanded ? "auto" : hasMore ? "430px" : "auto",
                  }}
                  transition={{ type: "spring", stiffness: 70, damping: 20 }}
                  className="overflow-hidden"
                >
                  <div className="grid gap-14 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 p-4">
                    {items.map((item, i) => (
                      <MoleculeCard
                        key={i}
                        item={item}
                        onSelect={onSelectModel}
                      />
                    ))}
                  </div>

                  {!isExpanded && hasMore && (
                    <div className="w-full h-32 mt-6 bg-linear-to-t from-black/60 to-transparent pointer-events-none"></div>
                  )}
                </motion.div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
