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
  const [chatId, setChatId] = useState(
    () => localStorage.getItem(STORAGE_KEYS.CHAT_ID) || null
  );
  const [modelUrl, setModelUrl] = useState(
    () => localStorage.getItem(STORAGE_KEYS.MODEL_URL) || null
  );
  const [activeModels, setActiveModels] = useState([]);
  const [currentModelIndex, setCurrentModelIndex] = useState(0);

  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // split viewer state
  const [viewerCollapsed, setViewerCollapsed] = useState(false);
  const [sizes, setSizes] = useState(() =>
    viewerCollapsed ? [8, 92] : [60, 40]
  );
  const lastOpenSizesRef = useRef([60, 40]);

  const containerRef = useRef(null);

  // static user id for now (replace with real auth later)
  const userId = 1;

  /* ----------------------
     Persistence
     ---------------------- */
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.APP_MODE, mode);
  }, [mode]);

  useEffect(() => {
    if (modelUrl) localStorage.setItem(STORAGE_KEYS.MODEL_URL, modelUrl);
    else localStorage.removeItem(STORAGE_KEYS.MODEL_URL);
  }, [modelUrl]);

  useEffect(() => {
    if (chatId) localStorage.setItem(STORAGE_KEYS.CHAT_ID, chatId);
    else localStorage.removeItem(STORAGE_KEYS.CHAT_ID);
  }, [chatId]);

  /* ----------------------
     Viewer collapse / split logic
     ---------------------- */
  useEffect(() => {
    // restore sizes or collapse
    if (viewerCollapsed) {
      setSizes([8, 92]);
    } else {
      setSizes(lastOpenSizesRef.current);
      // force resize so ThreeViewer reflows
      setTimeout(() => window.dispatchEvent(new Event("resize")), 200);
    }
  }, [viewerCollapsed]);

  const checkCollapseState = useCallback(
    (newSizes) => {
      if (!containerRef.current) return;
      const totalWidth = containerRef.current.offsetWidth;
      const leftPx = (totalWidth * newSizes[0]) / 100;
      // if left column becomes too small — collapse
      if (!viewerCollapsed && leftPx < 50) {
        setViewerCollapsed(true);
        setSizes([8, 92]);
        return;
      }
      if (viewerCollapsed && leftPx > 50) {
        setViewerCollapsed(false);
        lastOpenSizesRef.current = newSizes;
        setSizes(newSizes);
        return;
      }
    },
    [viewerCollapsed]
  );

  const handleSplitDrag = (newSizes) => {
    setSizes(newSizes);
    checkCollapseState(newSizes);
  };

  const handleSplitDragEnd = (newSizes) => {
    checkCollapseState(newSizes);
    if (!viewerCollapsed && newSizes[0] > 8)
      lastOpenSizesRef.current = newSizes;
    if (!viewerCollapsed && newSizes[0] > 8)
      lastOpenSizesRef.current = newSizes;
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
  }, []);

  useEffect(() => {
    // On mount, if saved mode/chat exist, try to reload them.
    const savedMode = localStorage.getItem(STORAGE_KEYS.APP_MODE);
    const savedChat = localStorage.getItem(STORAGE_KEYS.CHAT_ID);
    if ((savedMode === "chat" || savedMode === "model") && savedChat) {
      loadChatFromBackend(savedChat);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ----------------------
     Submit handler
     ---------------------- */
  const handleSubmit = useCallback(
    async (e) => {
      if (e && e.preventDefault) e.preventDefault();
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
          setViewerCollapsed(false);
          const path = `${API_BASE}${
            data.model_url || data.models?.[0]?.modelUrl
          }`;
          setModelUrl(path);
        }

        setChatHistory((prev) => [
          ...prev,
          { sender: "bot", text: data.response || "✅ Done" },
        ]);
      } catch (err) {
        console.error("Backend error:", err);
        setChatHistory((prev) => [
          ...prev,
          { sender: "bot", text: "⚠️ Backend connection error." },
        ]);
      } finally {
        setPrompt("");
        setLoading(false);
      }
    },
    [prompt, chatId, loadChatFromBackend]
  );

  /* ----------------------
     Template selection (HomeGrid / MoleculeCard)
     ---------------------- */
  const handleTemplateSelect = useCallback(
    async (item) => {
      if (!item) return;
      const modelPath = `${API_BASE}${item.modelUrl}`;
      setMode("model");
      setModelUrl(modelPath);

      try {
        const res = await fetch(
          `${API_BASE}/api/model-chat/?model_name=${encodeURIComponent(
            item.name
          )}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.chat_id) {
            await loadChatFromBackend(data.chat_id);
            return;
          }
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
          <motion.div
            className="chat-mode"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="relative flex flex-col h-[85vh] overflow-hidden flex-1 min-w-200 w-300 mt-6 top-16 items-center">
              <div className="flex-1 overflow-y-auto p-4 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.15)] rounded-t-2xl">
                <ChatBox messages={chatHistory} />
              </div>

              <div className="absolute bottom-2 flex justify-center flex-col items-center p-2 w-[calc(100%-120px)] min-w-[350px]">
                <InputBar
                  prompt={prompt}
                  setPrompt={setPrompt}
                  handleSubmit={handleSubmit}
                  loading={loading}
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* ---------------- MODEL MODE ---------------- */}
        {mode === "model" && (
          <motion.div
            className="model-chat-layout relative h-[calc(100vh-4rem)] px-4 mt-10 rounded-2xl overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Split
              className="flex h-full w-full"
              sizes={sizes}
              minSize={[8, 300]}
              gutterSize={8}
              snapOffset={10}
              expandToMin
              onDrag={handleSplitDrag}
              onDragEnd={handleSplitDragEnd}
            >
              {/* LEFT: 3D Viewer column */}
              <div className="relative flex flex-col overflow-hidden mt-6">
                {/* collapse toggle */}
                {viewerCollapsed ? (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30">
                    <button
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
                        onClick={() => setViewerCollapsed(true)}
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
                      {modelUrl ? (
                        <ThreeViewer
                          key={`${modelUrl}-${viewerCollapsed}`}
                          modelPath={modelUrl}
                          atomData={currentAtomData}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          No model selected
                        </div>
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
                            className={`w-14 h-14 rounded-xl object-cover cursor-pointer border-2 transition-all ${
                              idx === currentModelIndex
                                ? "border-blue-400 scale-105"
                                : "border-transparent opacity-80 hover:opacity-100"
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* RIGHT: Chat column */}
              <div className="relative flex flex-col h-full overflow-hidden flex-1 min-w-0 mt-6 items-center">
                <div className="flex-1 overflow-y-auto p-4 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.15)] rounded-tr-2xl">
                  <ChatBox messages={chatHistory} />
                </div>

                <div className="absolute bottom-5 flex justify-center flex-col items-center p-2 w-[calc(100%-120px)] min-w-[350px]">
                  <InputBar
                    prompt={prompt}
                    setPrompt={setPrompt}
                    handleSubmit={handleSubmit}
                    loading={loading}
                  />
                </div>
              </div>
            </Split>
          </motion.div>
        )}
      </div>
    </>
  );
}
