import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import InputBar from "./components/InputBar";
import ChatBox from "./components/ChatBox";
import ThreeViewer from "./components/ThreeViewer";
import HomeGrid from "./components/HomeGrid";
import BackButton from "./components/BackButton";
import Landing3D from "./components/Landing3D";
import Header from "./components/Header";
import Split from "react-split";
import { ChevronRight, X, Star, StarOff, Search, Trash2, Menu } from "lucide-react";
import "./App.css";

/* -----------------------------
   Inline Sidebar with Confirm-as-Popup (bottom-left)
   ----------------------------- */
function Sidebar({ isOpen, setIsOpen, onSelectSession, userId, refreshTrigger }) {
  const [sessions, setSessions] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // pendingConfirmations: array of { id, idStr, session, timeoutId, requestedAt }
  // We show a popup for the most recent pending confirmation.
  const [pendingConfirmations, setPendingConfirmations] = useState([]);
  const CONFIRM_WINDOW_MS = 5000;

  const normalize = (arr = []) =>
    (arr || []).map((s) => ({
      id: s.id,
      idStr: String(s.id),
      title: s.title || s.name || `Session ${s.id}`,
      preview:
        s.preview ||
        (s.messages && s.messages.length ? s.messages[s.messages.length - 1].text : ""),
      thumbnail: s.thumbnail || s.thumb || null,
      model_name: s.model_name || (s.models && s.models[0] && s.models[0].name) || null,
      pinned: !!s.pinned,
      updated_at: s.updated_at || s.modified_at || s.created_at || new Date().toISOString(),
      raw: s,
    }));

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/sessions/${userId}/`);
      if (!res.ok) throw new Error("Failed to fetch sessions");
      const data = await res.json();
      const normalized = normalize(data);

      // sort pinned first then newest
      normalized.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (b.pinned && !a.pinned) return 1;
        return new Date(b.updated_at) - new Date(a.updated_at);
      });

      setSessions(normalized);
    } catch (err) {
      console.error("❌ Error fetching sessions:", err);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, userId, refreshTrigger]);

  // scheduleConfirmation: when user clicks trash, create pending confirmation
  const scheduleConfirmation = (id) => {
    const idStr = String(id);
    const session = sessions.find((s) => s.idStr === idStr) || sessions.find((s) => String(s.id) === idStr) || null;

    // prevent duplicate confirmations for same id
    if (pendingConfirmations.some((p) => p.idStr === idStr)) return;

    const timeoutId = setTimeout(() => {
      // auto-cancel after window expires
      setPendingConfirmations((prev) => prev.filter((p) => p.idStr !== idStr));
    }, CONFIRM_WINDOW_MS);

    const entry = {
      id,
      idStr,
      session,
      timeoutId,
      requestedAt: Date.now(),
    };

    setPendingConfirmations((prev) => [...prev, entry]);
  };

  // cancel confirmation (Cancel clicked or timeout)
  const cancelConfirmation = (idStr) => {
    setPendingConfirmations((prev) => {
      const found = prev.find((p) => p.idStr === idStr);
      if (found && found.timeoutId) clearTimeout(found.timeoutId);
      return prev.filter((p) => p.idStr !== idStr);
    });
  };

  // confirm deletion (user pressed Confirm in popup)
  const confirmDeletion = async (idStr) => {
    // clear pending
    setPendingConfirmations((prev) => {
      const found = prev.find((p) => p.idStr === idStr);
      if (found && found.timeoutId) clearTimeout(found.timeoutId);
      return prev.filter((p) => p.idStr !== idStr);
    });

    // optimistic UI removal
    setSessions((prev) => prev.filter((s) => String(s.id) !== idStr && s.idStr !== idStr));

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/chat/${idStr}/delete/`, {
        method: "DELETE",
      });
      if (!res.ok) {
        console.error("Failed to delete on server:", await res.text());
        // restore list to be safe
        fetchSessions();
      }
    } catch (err) {
      console.error("❌ Error deleting chat:", err);
      fetchSessions();
    }
  };

  // Handler when trash icon clicked: schedule confirmation instead of immediate deletion
  const handleDelete = (id) => {
    scheduleConfirmation(id);
  };

  const togglePin = async (id) => {
    setSessions((prev) =>
      prev
        .map((s) => (s.id === id ? { ...s, pinned: !s.pinned } : s))
        .sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (b.pinned && !a.pinned) return 1;
          return new Date(b.updated_at) - new Date(a.updated_at);
        })
    );

    try {
      await fetch(`http://127.0.0.1:8000/api/session-pin/${id}/`, { method: "POST" });
    } catch (err) {
      console.warn("⚠️ Pin toggle failed on server, refetching.", err);
      fetchSessions();
    }
  };

  const filtered = useMemo(() => {
    const q = (search || "").toLowerCase().trim();
    if (!q) return sessions;
    return sessions.filter(
      (s) =>
        (s.title || "").toLowerCase().includes(q) ||
        (s.preview || "").toLowerCase().includes(q) ||
        (s.model_name || "").toLowerCase().includes(q)
    );
  }, [sessions, search]);

  // show most recent pending confirmation in popup (if any)
  const lastPending = pendingConfirmations.length ? pendingConfirmations[pendingConfirmations.length - 1] : null;

  // countdown for last pending confirmation (seconds remaining)
  const [countdown, setCountdown] = useState(0);
  useEffect(() => {
    if (!lastPending) {
      setCountdown(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, lastPending.requestedAt + CONFIRM_WINDOW_MS - Date.now());
      setCountdown(Math.ceil(remaining / 1000));
      if (remaining <= 0) {
        setCountdown(0);
      }
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [lastPending]);

  return (
    <>
      {/* Floating Menu Button when Sidebar is CLOSED */}
      {!isOpen && (
        <motion.button
          onClick={() => setIsOpen(true)}
          initial={{ x: -60, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.28 }}
          className="fixed top-4 left-5 z-50 text-white p-3 rounded-full shadow-lg backdrop-blur-md hover:cursor-pointer hover:text-slate-300"
          aria-label="Open sessions"
        >
          <Menu size={20} />
        </motion.button>
      )}

      <motion.aside
        initial={{ x: -320 }}
        animate={{ x: isOpen ? 0 : -320 }}
        transition={{ duration: 0.35, ease: "easeInOut" }}
        className="fixed left-0 top-0 h-full w-[280px] bg-[rgba(15,23,42,0.97)] border-r border-[rgba(255,255,255,0.08)] shadow-lg backdrop-blur-xl z-40 flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-white">💬 Sessions</span>
            <span className="text-xs text-white/40">({sessions.length})</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-300 hover:text-white p-1 rounded"
              title="Close"
              aria-label="Close sessions"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-3 border-b border-[rgba(255,255,255,0.03)]">
          <div className="flex items-center gap-2 bg-white/6 px-3 py-2 rounded-md">
            <Search className="w-4 h-4 text-white/50" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sessions or models..."
              className="bg-transparent outline-none w-full text-sm text-white placeholder-white/40"
              aria-label="Search sessions"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-white/60 hover:text-white ml-1 text-xs"
                aria-label="Clear search"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scroll p-2">
          {loading && <div className="p-3 text-sm text-white/60">Loading sessions…</div>}

          {!loading && filtered.length === 0 && (
            <div className="p-4 text-sm text-white/60">No sessions found. Start a new conversation.</div>
          )}

          {!loading &&
            filtered.map((s) => (
              <motion.div
                key={s.id}
                whileHover={{ scale: 1.01 }}
                className="flex items-center justify-between p-2 mb-2 rounded-lg cursor-pointer bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)] transition-all"
                onClick={() => {
                  onSelectSession && onSelectSession(s.raw || s);
                  setIsOpen(false);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onSelectSession && onSelectSession(s.raw || s);
                    setIsOpen(false);
                  }
                }}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  {s.thumbnail ? (
                    <img
                      src={s.thumbnail.startsWith("http") ? s.thumbnail : `http://127.0.0.1:8000${s.thumbnail}`}
                      alt="thumb"
                      className="w-11 h-11 rounded-md object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-md bg-[rgba(255,255,255,0.03)] flex items-center justify-center text-xs text-white/60 flex-shrink-0">
                      💬
                    </div>
                  )}

                  <div className="flex flex-col overflow-hidden">
                    <span className="text-sm text-white font-medium truncate max-w-[150px]">{s.title}</span>
                    <span className="text-xs text-white/50 truncate max-w-[150px]">
                      {s.preview || (s.model_name ? `Model: ${s.model_name}` : "No preview")}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePin(s.id);
                    }}
                    title={s.pinned ? "Unpin session" : "Pin session"}
                    className="p-1 rounded hover:bg-white/5"
                    aria-pressed={s.pinned}
                  >
                    {s.pinned ? <Star size={16} className="text-yellow-400" /> : <StarOff size={16} className="text-white/60" />}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(s.id); // now schedules confirmation popup
                    }}
                    title="Delete session"
                    className="p-1 rounded hover:bg-white/5"
                  >
                    <Trash2 size={14} className="text-white/60" />
                  </button>
                </div>
              </motion.div>
            ))}
        </div>

        {/* Footer: Close only */}
        
      </motion.aside>

      {/* Confirmation Popup (bottom-left) */}
      {lastPending && (
        <div
          className="fixed left-6 bottom-6 z-[9999] bg-[rgba(0,0,0,0.85)] text-white rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 max-w-[420px]"
          role="dialog"
          aria-live="assertive"
        >
          <div className="flex-1 text-sm">
            Confirm delete{" "}
            <strong className="mx-1">{lastPending.session ? lastPending.session.title : "session"}</strong>?
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => confirmDeletion(lastPending.idStr)}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
            >
              Confirm
            </button>

            <button
              onClick={() => cancelConfirmation(lastPending.idStr)}
              className="bg-white/6 hover:bg-white/10 text-white px-3 py-1 rounded"
            >
              Cancel
            </button>

            {countdown > 0 && <div className="text-xs text-white/50 ml-2">({countdown}s)</div>}
          </div>
        </div>
      )}
    </>
  );
}

/* -----------------------------
   Main App
   ----------------------------- */
function App() {
  const savedMode = localStorage.getItem("appMode");
  const initialMode =
    savedMode && savedMode !== "undefined" && savedMode !== "null"
      ? savedMode
      : "home";

  const [mode, setMode] = useState(initialMode);
  const [prompt, setPrompt] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [chatId, setChatId] = useState(null);
  const [modelUrl, setModelUrl] = useState(localStorage.getItem("modelUrl") || null);
  const [activeModels, setActiveModels] = useState([]);
  const [currentModelIndex, setCurrentModelIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [viewerCollapsed, setViewerCollapsed] = useState(false);
  const userId = 1;

  // Split layout sizing
  const [sizes, setSizes] = useState(() => (viewerCollapsed ? [8, 92] : [60, 40]));
  const lastOpenSizesRef = useRef([60, 40]);
  const containerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("appMode", mode);
    if (modelUrl) localStorage.setItem("modelUrl", modelUrl);
  }, [mode, modelUrl]);

  // Sync collapse state with split sizes
  useEffect(() => {
    if (viewerCollapsed) {
      setSizes([8, 92]);
    } else {
      setSizes(lastOpenSizesRef.current || [60, 40]);
      setTimeout(() => window.dispatchEvent(new Event("resize")), 200);
    }
  }, [viewerCollapsed]);

  // Auto collapse/expand detection based on actual px width
  const checkCollapseState = (newSizes) => {
    if (!containerRef.current) return;
    const totalWidth = containerRef.current.offsetWidth;
    const leftWidthPx = (totalWidth * newSizes[0]) / 100;

    // Collapse threshold < 50px
    if (!viewerCollapsed && leftWidthPx < 50) {
      setViewerCollapsed(true);
      setSizes([8, 92]);
      return;
    }

    // Expand threshold > 50px
    if (viewerCollapsed && leftWidthPx > 50) {
      setViewerCollapsed(false);
      lastOpenSizesRef.current = newSizes;
      setSizes(newSizes);
      return;
    }
  };

  const onDrag = (newSizes) => {
    setSizes(newSizes);
    checkCollapseState(newSizes);
  };

  const onDragEnd = (newSizes) => {
    checkCollapseState(newSizes);
    if (!viewerCollapsed && newSizes[0] > 8) {
      lastOpenSizesRef.current = newSizes;
    }
  };

  // --- Backend handling ---
  const loadChatFromBackend = async (id) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/chat/${id}/`);
      if (!res.ok) throw new Error("Chat not found");
      const data = await res.json();

      setChatHistory(data.messages || []);
      setActiveModels(data.models || []);
      setChatId(id);

      if (data.models && data.models.length > 0) {
        setMode("model");
        const firstModel = data.models[0];
        setModelUrl("http://127.0.0.1:8000" + firstModel.modelUrl);
        setCurrentModelIndex(0);
      } else {
        setMode("chat");
        setModelUrl(null);
      }
    } catch (err) {
      console.error("❌ Failed to load chat:", err);
      setChatHistory([{ sender: "bot", text: "⚠️ Failed to load chat." }]);
      setMode("chat");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);

    const userMsg = { sender: "user", text: prompt };
    setChatHistory((prev) => [...prev, userMsg]);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/generate-model/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          user_id: userId,
          chat_id: chatId,
        }),
      });

      const data = await res.json();

      if (["invalid", "chat"].includes(data.mode)) {
        if (mode !== "model") setMode("chat");
        setChatHistory((prev) => [...prev, { sender: "bot", text: data.response }]);
        if (data.chat_id) setChatId(data.chat_id);
      } else if (data.mode === "model") {
        if (data.models?.length) {
          const newModels = data.models;
          const newModel = newModels[newModels.length - 1];
          const modelPath = "http://127.0.0.1:8000" + newModel.modelUrl;

          setMode("model");
          setModelUrl(modelPath);
          setChatId(data.chat_id || chatId);
          setActiveModels(newModels);
          setCurrentModelIndex(newModels.length - 1);
        } else if (data.model_url) {
          const singleModel = {
            modelUrl: data.model_url,
            thumbnail: data.thumbnail,
            name: data.title || "Generated Model",
            atom_data: data.atoms || [],
          };
          setMode("model");
          setModelUrl("http://127.0.0.1:8000" + data.model_url);
          setChatId(data.chat_id || chatId);
          setActiveModels((prev) => [...prev, singleModel]);
          setCurrentModelIndex((prev) => prev + 1);
        }
        setChatHistory((prev) => [...prev, { sender: "bot", text: data.response }]);
        setViewerCollapsed(false);
      }
    } catch (err) {
      console.error("❌ Backend error:", err);
      setChatHistory((prev) => [
        ...prev,
        { sender: "bot", text: "⚠️ Backend connection error." },
      ]);
    } finally {
      setLoading(false);
      setPrompt("");
    }
  };

  const handleSelectSession = (session) => {
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
        `http://127.0.0.1:8000/api/model-chat/?model_name=${encodeURIComponent(item.name)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.chat_id) {
          setChatId(data.chat_id);
          setChatHistory(data.messages || []);
          setActiveModels(data.models || []);
          return;
        }
      }
    } catch {
      console.warn("⚠️ No existing chat for model, starting new one.");
    }
    setChatHistory([{ sender: "bot", text: item.description }]);
  };

  const currentAtomData = activeModels[currentModelIndex]?.atom_data || [];

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
        {(mode === "chat" || mode === "model") && <BackButton onClick={() => setMode("home")} />}

        {/* HOME MODE */}
        {mode === "home" && (
          <>
            <Landing3D />
            <div id="home-grid" style={{ scrollMarginTop: "100vh" }}>
              <HomeGrid onSelectModel={handleTemplateSelect} userId={userId} />
            </div>
          </>
        )}

        {/* MODEL MODE */}
        {mode === "model" && (
          <motion.div
            className="model-chat-layout relative h-[calc(100vh-4rem)] px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Split
              className="flex h-full w-full"
              sizes={sizes}
              minSize={[8, 300]}
              gutterSize={8}
              snapOffset={10}
              expandToMin={true}
              onDrag={onDrag}
              onDragEnd={onDragEnd}
            >
              {/* LEFT: Viewer */}
              <div className="relative flex flex-col transition-all duration-300 ease-in-out overflow-hidden">
                {viewerCollapsed ? (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30">
                    <button
                      onClick={() => setViewerCollapsed(false)}
                      className="bg-[rgba(255,255,255,0.12)] hover:bg-[rgba(255,255,255,0.25)] text-white rounded-full w-7 h-7 flex items-center justify-center transition-all"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Collapse button */}
                    <div className="absolute top-2 left-2 z-20">
                      <button
                        onClick={() => setViewerCollapsed(true)}
                        className="bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.2)] text-white rounded-full w-8 h-8 flex items-center justify-center shadow-md"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {/* Title */}
                    {activeModels.length > 0 && (
                      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[rgba(0,0,0,0.65)] px-5 py-2 rounded-full text-sm text-white shadow-md backdrop-blur-md z-10">
                        {activeModels[currentModelIndex]?.name || "Model"}
                      </div>
                    )}

                    {/* Viewer */}
                    <div className="flex-1 w-full h-full">
                      {modelUrl && (
                        <ThreeViewer
                          key={`${modelUrl}-${viewerCollapsed}`}
                          modelPath={modelUrl}
                          atomData={currentAtomData}
                        />
                      )}
                    </div>

                    {/* Original thumbnail strip (kept as in original App) */}
                    {activeModels.length > 0 && (
                      <div className="absolute bottom-0 w-full flex items-center justify-center mt-3 py-3 rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] backdrop-blur-md">
                        {activeModels.map((m, idx) => (
                          <img
                            key={idx}
                            src={`http://127.0.0.1:8000${m.thumbnail}`}
                            alt={m.name}
                            onClick={() => {
                              setCurrentModelIndex(idx);
                              setModelUrl("http://127.0.0.1:8000" + m.modelUrl);
                            }}
                            className={`w-14 h-14 rounded-lg object-cover cursor-pointer border-2 transition-all ${
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

              {/* RIGHT: Chat */}
              <div className="relative flex flex-col h-full overflow-hidden flex-1 min-w-0">
                <div className="flex-1 overflow-y-auto p-4 chat-box bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.15)] rounded-2xl">
                  <ChatBox messages={chatHistory} />
                </div>
                <div className="p-3 border-t border-[rgba(255,255,255,0.15)]">
                  <InputBar
                    prompt={prompt}
                    setPrompt={setPrompt}
                    handleSubmit={handleSubmit}
                    loading={loading}
                    mode={mode}
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

export default App;
