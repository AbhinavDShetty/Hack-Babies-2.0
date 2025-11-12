import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import Sidebar from "./components/Sidebar";
import InputBar from "./components/InputBar";
import ChatBox from "./components/ChatBox";
import ThreeViewer from "./components/ThreeViewer";
import HomeGrid from "./components/HomeGrid";
import BackButton from "./components/BackButton";
import Landing3D from "./components/Landing3D";
import Header from "./components/Header";
import Split from "react-split";
import { ChevronRight, X } from "lucide-react";
import "./App.css";

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

  const onDragEnd = (newSizes) => {
    setSizes(newSizes);
    if (!viewerCollapsed && newSizes[0] > 8) {
      lastOpenSizesRef.current = newSizes;
    }
  };

  const onDrag = (newSizes) => {
    if (viewerCollapsed && newSizes[0] > 10) {
      setViewerCollapsed(false);
      lastOpenSizesRef.current = newSizes;
      setSizes(newSizes);
    } else {
      setSizes(newSizes);
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

  const handleNextModel = () => {
    if (currentModelIndex < activeModels.length - 1) {
      const nextIndex = currentModelIndex + 1;
      setCurrentModelIndex(nextIndex);
      setModelUrl("http://127.0.0.1:8000" + activeModels[nextIndex].modelUrl);
    }
  };

  const handlePrevModel = () => {
    if (currentModelIndex > 0) {
      const prevIndex = currentModelIndex - 1;
      setCurrentModelIndex(prevIndex);
      setModelUrl("http://127.0.0.1:8000" + activeModels[prevIndex].modelUrl);
    }
  };

  const handleBackToHome = () => {
    setMode("home");
    setModelUrl(null);
    setChatId(null);
    setChatHistory([]);
    setActiveModels([]);
    localStorage.removeItem("modelUrl");
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
      <div className="meku-theme app-container">
        <Header />
        {(mode === "chat" || mode === "model") && <BackButton onClick={handleBackToHome} />}

        {/* HOME MODE */}
        {mode === "home" && (
          <>
            <Landing3D />
            <div id="home-grid" style={{ scrollMarginTop: "100vh" }}>
              <HomeGrid onSelectModel={handleTemplateSelect} userId={userId} />
            </div>
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[80%] max-w-[700px] px-4">
              <InputBar prompt={prompt} setPrompt={setPrompt} handleSubmit={handleSubmit} loading={loading} mode={mode} />
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
                        <span className="ml-2 text-gray-400 text-xs">
                          ({currentModelIndex + 1}/{activeModels.length})
                        </span>
                      </div>
                    )}

                    {/* Viewer */}
                    <div className="flex-1 w-full h-full">
                      {modelUrl && (
                        <ThreeViewer
                          key={`${modelUrl}-${currentModelIndex}-${viewerCollapsed ? "closed" : "open"}`}
                          modelPath={modelUrl}
                          atomData={currentAtomData}
                        />
                      )}
                    </div>

                    {/* Carousel */}
                    {activeModels.length > 0 && (
                      <div className="absolute bottom-0 w-full flex items-center justify-center mt-3 py-3 rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] backdrop-blur-md shadow-[0_0_20px_rgba(99,102,241,0.1)]">
                        {currentModelIndex > 0 && (
                          <button
                            onClick={handlePrevModel}
                            className="absolute left-4 bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.25)] text-white rounded-full w-9 h-9 flex items-center justify-center text-lg shadow-lg backdrop-blur-md transition-all"
                          >
                            ←
                          </button>
                        )}

                        <div className="flex gap-2 overflow-x-auto px-12 custom-scroll">
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

                        {currentModelIndex < activeModels.length - 1 && (
                          <button
                            onClick={handleNextModel}
                            className="absolute right-4 bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.25)] text-white rounded-full w-9 h-9 flex items-center justify-center text-lg shadow-lg backdrop-blur-md transition-all"
                          >
                            →
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* RIGHT: Chat */}
              <div className="relative flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 chat-box bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.15)] rounded-2xl shadow-[0_0_40px_rgba(99,102,241,0.15)]">
                  <ChatBox messages={chatHistory} />
                </div>
                <div className="p-3 border-t border-[rgba(255,255,255,0.15)]">
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

export default App;
