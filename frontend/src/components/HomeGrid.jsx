// src/HomeGrid.jsx
import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import MoleculeCard from "./MoleculeCard";

export default function HomeGrid({ onSelectModel, userId }) {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  // which category is expanded (grid mode)
  const [expanded, setExpanded] = useState(null);

  // refs for each row container
  const rowRefs = useRef([]);
  const CARD_WIDTH = 280 + 40; // card width + gap approximation

  /* ---------------- FETCH DATA ---------------- */
  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/templates/");
        const json = await res.json();
        if (cancelled) return;
        setData(json);
        // create a ref for each incoming category (will be stable for render)
        rowRefs.current = Object.keys(json).map(() => React.createRef());
      } catch (err) {
        console.error("Error fetching templates:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ------------------ INITIALIZE CAROUSEL POSITIONS ------------------
     Use ResizeObserver + requestAnimationFrame + fallbacks to ensure
     we only set scrollLeft once the scroll container has a usable scrollWidth.
  --------------------------------------------------------------------- */
  useEffect(() => {
    const observers = [];
    const timers = [];

    Object.entries(data).forEach(([categoryName, items], index) => {
      // we only want carousel behaviour for >= 3 items (your rule)
      if (!items || items.length < 3) return;
      if (expanded === categoryName) return; // expanded = grid mode, skip

      const ref = rowRefs.current[index];
      if (!ref || !ref.current) return;
      const el = ref.current;

      // Handler that sets the initial centered scroll position (middle copy)
      const initPosition = () => {
        try {
          // total width of one logical set
          const totalOneSet = items.length * CARD_WIDTH;
          // set scrollLeft to the middle copy start
          // but ensure scrollWidth > clientWidth (otherwise it's meaningless)
          if (el.scrollWidth > el.clientWidth) {
            // Use .scrollLeft assignment (no smooth) to avoid jank
            el.scrollLeft = totalOneSet;
            return true;
          }
        } catch (err) {
          // ignore
        }
        return false;
      };

      // 1) Try immediate (sometimes already ready)
      if (initPosition()) return;

      // 2) Use ResizeObserver to wait until layout stabilizes
      if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => {
          if (initPosition()) {
            ro.disconnect();
          }
        });
        ro.observe(el);
        observers.push(ro);
      }

      // 3) Also do a rAF + small timeout fallback to catch cases where ResizeObserver doesn't fire
      const rafId = requestAnimationFrame(() => {
        const t = setTimeout(() => {
          initPosition();
        }, 60); // small delay to allow layout
        timers.push(t);
      });
      timers.push(rafId);
    });

    // Cleanup
    return () => {
      observers.forEach((ro) => {
        try {
          ro.disconnect();
        } catch (e) { }
      });
      timers.forEach((t) => {
        try {
          clearTimeout(t);
        } catch (e) { }
      });
    };
  }, [data, expanded]);

  /* ---------------- SCROLL / INFINITE LOGIC ---------------- */
  const scrollAmount = 320;

  const handleInfiniteScroll = (ref, itemsLength) => {
    const el = ref.current;
    if (!el || !itemsLength) return;

    // total width of one logical set (approx)
    const total = itemsLength * CARD_WIDTH;
    const viewport = el.clientWidth;
    const maxScroll = el.scrollWidth - viewport;

    // when we reach near either edge, jump back into the middle copy region
    // little epsilon to avoid wobble
    if (el.scrollLeft <= 5) {
      // jump to middle (no smooth)
      el.scrollLeft = total;
    } else if (el.scrollLeft >= maxScroll - 5) {
      el.scrollLeft = total - viewport;
    }
  };

  /* ---------------- RENDER ---------------- */
  return (
    <section
      className="w-screen min-h-screen px-10 md:px-20 pt-36 pb-20 backdrop-blur-2xl bg-[rgba(0,0,0,0.25)] border-t border-[rgba(255,255,255,0.12)]"
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
          {Object.entries(data).map(([category, items], index) => {
            const ref = rowRefs.current[index];
            const isCarousel = Array.isArray(items) && items.length >= 3;
            const isExpanded = expanded === category;

            // duplicate only in carousel mode (and only for visual seamless loop)
            const loopItems = isCarousel && !isExpanded ? [...items, ...items, ...items] : items;

            // show nav buttons when there are more than 4 cards (same logic you had)
            const showButtons = isCarousel && items.length > 4;

            return (
              <div key={category} className="relative">
                {/* header */}
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-3xl font-bold text-white">
                    {category === "custom"
                      ? "My Creations"
                      : category.charAt(0).toUpperCase() + category.slice(1) + "s"}
                  </h3>

                  {/* show more/less only for carousel mode */}
                  {isCarousel && (
                    <button
                      onClick={() => setExpanded(isExpanded ? null : category)}
                      className="text-sm text-gray-300 hover:text-white transition"
                    >
                      {isExpanded ? "Show Less ▲" : "Show More ▼"}
                    </button>
                  )}
                </div>

                {/* content */}
                <div className="relative">
                  {/* if not carousel OR expanded => grid */}
                  {(!isCarousel || isExpanded) && (
                    <motion.div
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.35 }}
                      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 px-2"
                    >
                      {items.map((item, i) => (
                        <div key={i}>
                          <MoleculeCard
                            item={item}
                            onSelect={onSelectModel}
                            userId={userId}
                            onDelete={(id) => {
                              setData((prev) => ({
                                ...prev,
                                custom: prev.custom.filter((m) => m.id !== id)
                              }));
                            }}
                          />
                        </div>
                      ))}
                    </motion.div>
                  )}

                  {/* carousel */}
                  {isCarousel && !isExpanded && (
                    <div className="relative group">
                      {/* fades */}
                      <div className="pointer-events-none absolute left-0 top-0 h-full w-32 bg-linear-to-r from-[rgba(0,0,0,0.7)] to-transparent opacity-80 z-10"></div>
                      <div className="pointer-events-none absolute right-0 top-0 h-full w-32 bg-linear-to-l from-[rgba(0,0,0,0.7)] to-transparent opacity-80 z-10"></div>

                      {/* left button (only when showButtons) */}
                      {showButtons && (
                        <button
                          onClick={() => ref?.current?.scrollBy({ left: -scrollAmount, behavior: "smooth" })}
                          className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/30 hover:cursor-pointer hover:shadow-[0_0_25px_rgba(200,100,255,0.7)] hover:scale-110 transition-all duration-300 p-3 rounded-full text-white shadow-lg opacity-0 group-hover:opacity-100 hidden md:flex z-30"
                        >
                          <ChevronLeft size={26} />
                        </button>
                      )}

                      <div
                        ref={ref}
                        onScroll={() => handleInfiniteScroll(ref, items.length)}
                        className="flex gap-10 overflow-x-scroll px-2 pb-2 scroll-smooth scrollbar-hide snap-x snap-mandatory"
                      >
                        {loopItems.map((item, i) => (
                          <div key={i} className="snap-center shrink-0 w-[280px]">
                            <MoleculeCard
                              item={item}
                              onSelect={onSelectModel}
                              userId={userId}
                              onDelete={(id) => {
                                setData((prev) => ({
                                  ...prev,
                                  custom: prev.custom.filter((m) => m.id !== id)
                                }));
                              }}
                            />
                          </div>
                        ))}
                      </div>

                      {showButtons && (
                        <button
                          onClick={() => ref?.current?.scrollBy({ left: scrollAmount, behavior: "smooth" })}
                          className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/30 hover:cursor-pointer hover:shadow-[0_0_25px_rgba(200,100,255,0.7)] hover:scale-110 transition-all duration-300 p-3 rounded-full text-white shadow-lg opacity-0 group-hover:opacity-100 hidden md:flex z-30"
                        >
                          <ChevronRight size={26} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
