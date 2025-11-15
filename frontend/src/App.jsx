// src/App.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion } from "framer-motion";
import Split from "react-split";
import { ChevronRight, X } from "lucide-react";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Landing3D from "./components/Landing3D";
import HomeGrid from "./components/HomeGrid";
import ThreeViewer from "./components/ThreeViewer";
import ChatBox from "./components/ChatBox";
import InputBar from "./components/InputBar";
import BackButton from "./components/BackButton";

import "./App.css";

/**
 * App — refactored
 *
 * Responsibilities:
 * - top-level routing between "home", "chat", and "model"
 * - manage chat sessions and model URLs
 * - handle layout split for model viewer + chat
 * - persist lightweight state to localStorage
 *
 * Notes:
 * - the Landing3D component self-manages its diagonal wipe and scroll transforms.
 * - HomeGrid is placed below the hero using paddingTop on the wrapper.
 */

/* ----------------------
   Constants & helpers
   ---------------------- */
const API_BASE = "http://127.0.0.1:8000";
const STORAGE_KEYS = {
  APP_MODE: "appMode",
  MODEL_URL: "modelUrl",
  CHAT_ID: "chatId",
};

function getSavedMode() {
  const saved = localStorage.getItem(STORAGE_KEYS.APP_MODE);
  if (!saved || saved === "undefined" || saved === "null") return "home";
  return saved;
}

/* ----------------------
   App component
   ---------------------- */
export default function App() {
  // ---------- App mode + global state ----------
  const [mode, setMode] = useState(getSavedMode()); // "home" | "chat" | "model"
  const [prompt, setPrompt] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [chatId, setChatId] = useState(null);
  const [modelUrl, setModelUrl] = useState(
    localStorage.getItem("modelUrl") || null
  );
  const [activeModels, setActiveModels] = useState([]);
  const [currentModelIndex, setCurrentModelIndex] = useState(0);

  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // split viewer state
  const [viewerCollapsed, setViewerCollapsed] = useState(false);

  const userId = 1;

  // sizes are percentages for Split: [left%, right%]
  const [sizes, setSizes] = useState(() =>
    viewerCollapsed ? [5, 95] : [60, 40]
  );
  const lastOpenSizesRef = useRef([60, 40]);
  const viewerCollapsedRef = useRef(viewerCollapsed);
  const containerRef = useRef(null);

  // animation state
  const [isAnimating, setIsAnimating] = useState(false);
  const animRef = useRef(null); // to cancel animation frames if needed

  // keep ref in sync with state
  useEffect(() => {
    viewerCollapsedRef.current = viewerCollapsed;
  }, [viewerCollapsed]);

  // Persist some app state
  useEffect(() => {
    localStorage.setItem("appMode", mode);
    if (modelUrl) localStorage.setItem("modelUrl", modelUrl);
    if (chatId) localStorage.setItem("chatId", chatId);
  }, [mode, modelUrl, chatId]);

  // Load saved chat if present
  useEffect(() => {
    const savedChatId = localStorage.getItem("chatId");
    const savedMode = localStorage.getItem("appMode");

    if ((savedMode === "chat" || savedMode === "model") && savedChatId) {
      loadChatFromBackend(savedChatId);
    }
  }, []);


  useEffect(() => {
    if (!chatId) return;

    // Reset sizes whenever entering model mode
    setViewerCollapsed(false);
    setSizes([60, 40]);
    lastOpenSizesRef.current = [60, 40];
  }, [chatId]);


  const cancelAnimation = () => {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    setIsAnimating(false);
  };

  const animateSizes = (from, to, duration = 300) => {
    cancelAnimation();
    setIsAnimating(true);

    const start = performance.now();
    const frames = Math.max(8, Math.round((duration / 16)));
    const leftStart = from[0];
    const leftDelta = to[0] - from[0];

    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const currentLeft = leftStart + leftDelta * ease;
      const currentRight = 100 - currentLeft;
      setSizes([Number(currentLeft.toFixed(2)), Number(currentRight.toFixed(2))]);

      if (t < 1) {
        animRef.current = requestAnimationFrame(step);
      } else {
        animRef.current = null;
        setSizes([Number(to[0]), Number(100 - to[0])]);
        setIsAnimating(false);
        lastOpenSizesRef.current = [Number(to[0]), Number(100 - to[0])];
      }
    };

    animRef.current = requestAnimationFrame(step);
  };

  const checkCollapseState = (newSizes) => {
    if (isAnimating) return;

    const leftPercent = newSizes[0];
    const isCollapsed = viewerCollapsedRef.current;

    if (!isCollapsed && leftPercent < 15) {
      viewerCollapsedRef.current = true;
      animateSizes([leftPercent, 100 - leftPercent], [5, 95], 260);
      setTimeout(() => setViewerCollapsed(true), 0);
      return;
    }

    if (isCollapsed && leftPercent > 15) {
      viewerCollapsedRef.current = false;
      animateSizes([leftPercent, 100 - leftPercent], [60, 40], 260);
      setTimeout(() => setViewerCollapsed(false), 0);
      return;
    }
  };

  const onDrag = (newSizes) => {
    if (isAnimating) return;

    setSizes(newSizes);
    checkCollapseState(newSizes);
  };

  const onDragEnd = (newSizes) => {
    if (isAnimating) return;
    checkCollapseState(newSizes);

    if (!viewerCollapsed && newSizes[0] > 6) {
      lastOpenSizesRef.current = newSizes;
    }
  };


  const triggerCollapse = () => {
    if (isAnimating) return;
    if (animRef.current) {
      animRef.current.cancelAnimation = true;
    }

    cancelAnimation();
    viewerCollapsedRef.current = true;
    setViewerCollapsed(true);
    animateSizes(sizes, [5, 95], 260);
  };

  const triggerExpand = () => {
    if (isAnimating) return;
    cancelAnimation();
    viewerCollapsedRef.current = false;
    setViewerCollapsed(false);
    animateSizes(sizes, [60, 40], 260);
  };

  /* ----------------------
     Backend helpers
     ---------------------- */
  const loadChatFromBackend = useCallback(async (id) => {
    if (!id) return;
    try {
      const res = await fetch(`${API_BASE}/api/chat/${id}/`);
      if (!res.ok) throw new Error("Chat not found");
      const data = await res.json();

      setChatId(id);
      setChatHistory(data.messages || []);
      setActiveModels(data.models || []);

      if (data.models?.length > 0) {
        const first = data.models[0];
        setMode("model");
        setModelUrl(`${API_BASE}${first.modelUrl}`);
        setCurrentModelIndex(0);
      } else {
        setMode("chat");
        setModelUrl(null);
      }
    } catch (err) {
      console.error("Failed to load chat:", err);
      setChatHistory([{ sender: "bot", text: "⚠️ Failed to load chat." }]);
      setMode("chat");
    }
  };

  // 🧠 Handle message submission and backend response
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);
    setChatHistory((prev) => [...prev, { sender: "user", text: prompt }]);

      try {
        const res = await fetch(`${API_BASE}/api/generate-model/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, user_id: userId, chat_id: chatId }),
        });

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || "Server error");
        }
        const data = await res.json();

        // if backend returned a chat id, reload chat
        if (data.chat_id) {
          await loadChatFromBackend(data.chat_id);
        }

      if (data.mode === "model") {
        setMode("model");
        // ensure viewer visible
        viewerCollapsedRef.current = false;
        setViewerCollapsed(false);

        // handle model URL display
        const modelPath =
          "http://127.0.0.1:8000" + (data.model_url || data.models?.[0]?.modelUrl);
        setModelUrl(modelPath);
      }
    } catch (err) {
      console.error("❌ Backend error:", err);
      setChatHistory((prev) => [
        ...prev,
        { sender: "bot", text: "⚠️ Backend connection error." },
      ]);
    } finally {
      setPrompt("");
      setLoading(false);
    }
  };

  const handleSelectSession = (session) => {
    if (!session) return;
    setChatId(session.id);
    loadChatFromBackend(session.id);
    setSidebarOpen(false);
  };

  const handleTemplateSelect = async (item) => {
    const modelPath = "http://127.0.0.1:8000" + item.modelUrl;
    setMode("model");
    setModelUrl(modelPath);

    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/model-chat/?model_name=${encodeURIComponent(
          item.name
        )}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.chat_id) {
          loadChatFromBackend(data.chat_id);
          return;
        }
      } catch (err) {
        console.warn("No chat for template:", err);
      }

      // fallback: put description in chat
      setChatHistory([{ sender: "bot", text: item.description }]);
    },
    [loadChatFromBackend]
  );

  /* ----------------------
     Session selection used by Sidebar
     ---------------------- */
  const handleSelectSession = useCallback(
    (session) => {
      if (!session) return;
      loadChatFromBackend(session.id);
      setSidebarOpen(false);
    },
    [loadChatFromBackend]
  );

  /* ----------------------
     Deleting / refreshing sessions helper (optional)
     ---------------------- */
  const triggerRefresh = useCallback(() => setRefreshTrigger((s) => s + 1), []);

  /* ----------------------
     Derived / memoized values
     ---------------------- */
  const currentAtomData = useMemo(
    () => activeModels[currentModelIndex]?.atom_data || [],
    [activeModels, currentModelIndex]
  );

  /* ----------------------
     When user navigates back to home, clear model/chat state
     ---------------------- */
  useEffect(() => {
    if (mode === "home") {
      setChatHistory([]);
      setChatId(null);
      setModelUrl(null);
      setActiveModels([]);
      setCurrentModelIndex(0);
    }
  }, [mode]);

  /* ----------------------
     Render
     ---------------------- */
  return (
    <>
      <Sidebar
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        onSelectSession={handleSelectSession}
        userId={userId}
        refreshTrigger={refreshTrigger}
      />

      <div className="meku-theme app-container" ref={containerRef}>
        <Header />

        {(mode === "chat" || mode === "model") && (
          <BackButton onClick={() => setMode("home")} />
        )}

        {/* ---------------- HOME MODE ---------------- */}
        {mode === "home" && (
          <>
            {/* Landing hero with diagonal wipe handled internally */}
            <Landing3D />

            {/* HomeGrid placed below the hero. paddingTop ensures it starts after hero. */}
            <div
              id="home-grid"
              className="relative z-[50] w-full"
              style={{ paddingTop: "100vh" }}
            >
              <HomeGrid onSelectModel={handleTemplateSelect} userId={userId} />
            </div>

            {/* Floating input at bottom (home) */}
            <div className="z-[200] fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 pointer-events-none">
              <div className="pointer-events-auto">
                <InputBar
                  prompt={prompt}
                  setPrompt={setPrompt}
                  handleSubmit={handleSubmit}
                  loading={loading}
                />
              </div>
            </div>
          </>
        )}

        {/* ---------------- CHAT MODE ---------------- */}
        {mode === "chat" && (
          <>
            <motion.div className="chat-mode" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="relative flex flex-col h-[85vh] overflow-hidden flex-1 min-w-200 w-300 mt-6 top-16 items-center">
                <div className="flex-1 overflow-y-auto p-4 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.15)] rounded-t-2xl">
                  <ChatBox messages={chatHistory} />
                </div>
                <div className="absolute bottom-2 flex justify-center flex-col items-center border-[rgba(255,255,255,0.15)] p-2 w-[calc(100%-120px)] min-w-[350px]">
                  <InputBar
                    prompt={prompt}
                    setPrompt={setPrompt}
                    handleSubmit={handleSubmit}
                    loading={loading}
                    mode={mode}
                  />
                </div>
              </div>
            </motion.div>
          </>
        )}

        {/* MODEL MODE */}
        {mode === "model" && (
          <motion.div className="model-chat-layout relative h-[calc(100vh-4rem)] px-4 mt-10 rounded-2xl overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Split
              className="flex h-full w-full"
              sizes={sizes}
              minSize={[50, 300]}
              gutterSize={5}
              snapOffset={10}
              expandToMin
              onDrag={handleSplitDrag}
              onDragEnd={handleSplitDragEnd}
            >
              {/* LEFT: 3D Viewer column */}
              <div className="relative flex flex-col overflow-hidden mt-6">
                {/* collapse toggle */}
                {viewerCollapsed ? (
                  <div className="absolute top-1/2 left-2 -translate-y-1/2 z-30">
                    <button
                      onClick={() => {
                        // expand via animation
                        triggerExpand();
                      }}
                      className="bg-[rgba(255,255,255,0.12)] hover:bg-[rgba(255,255,255,0.25)] text-white rounded-full w-7 h-7 flex items-center justify-center"
                      onClick={() => setViewerCollapsed(false)}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="absolute top-2 left-2 z-20">
                      <button
                        onClick={() => {
                          // collapse via animation
                          triggerCollapse();
                        }}
                        className="bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.2)] text-white rounded-full w-8 h-8 flex items-center justify-center"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {activeModels.length > 0 && (
                      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[rgba(0,0,0,0.65)] px-5 py-2 rounded-full text-sm text-white shadow-md">
                        {activeModels[currentModelIndex]?.name || "Model"}
                      </div>
                    )}

                    <div className="flex-1 w-full h-full">
                      {modelUrl && (
                        <ThreeViewer key={`${modelUrl}-${viewerCollapsed}`} modelPath={modelUrl} atomData={currentAtomData} />
                      )}
                    </div>

                    {/* model thumbnails carousel */}
                    {activeModels.length > 0 && (
                      <div className="absolute bottom-0 w-full flex items-center justify-center mt-3 py-3 border border-[rgba(255,255,255,0.08)] backdrop-blur-md">
                        {activeModels.map((m, idx) => (
                          <img
                            key={idx}
                            src={`${API_BASE}${m.thumbnail}`}
                            alt={m.name}
                            onClick={() => {
                              setCurrentModelIndex(idx);
                              setModelUrl(`${API_BASE}${m.modelUrl}`);
                            }}
                            className={`w-14 h-14 rounded-xl object-cover cursor-pointer border-2 transition-all ${idx === currentModelIndex ? "border-blue-400 scale-105" : "border-transparent opacity-80 hover:opacity-100"}`}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* RIGHT: Chat */}
              <div className="relative flex flex-col h-full overflow-hidden flex-1 mt-6 items-center">
                <div className="flex-1 overflow-y-auto p-4 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.15)] rounded-tr-2xl">
                  <ChatBox messages={chatHistory} />
                </div>
                <div className="absolute bottom-5 flex justify-center flex-col items-center border-[rgba(255,255,255,0.15)] p-2 w-[calc(100%-120px)] min-w-[350px]">
                  <InputBar prompt={prompt} setPrompt={setPrompt} handleSubmit={handleSubmit} loading={loading} mode={mode} />
                </div>
              </div>
            </Split>
          </motion.div>
        )}
      </div>
    </>
  );
}
