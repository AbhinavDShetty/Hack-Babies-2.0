import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import InputBar from "./components/InputBar";
import ChatBox from "./components/ChatBox";
import ThreeViewer from "./components/ThreeViewer";
import HomeGrid from "./components/HomeGrid";
import BackButton from "./components/BackButton";
import "./App.css";

function App() {
  // --- STATE ---
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
  const userId = 1;

  // --- PERSIST ---
  useEffect(() => {
    localStorage.setItem("appMode", mode);
    if (modelUrl) localStorage.setItem("modelUrl", modelUrl);
  }, [mode, modelUrl]);

  // --- AUTO RESET MODE ---
  useEffect(() => {
    const savedModel = localStorage.getItem("modelUrl");
    if ((mode === "chat" || mode === "model") && !chatId && !savedModel) {
      setMode("home");
    }
  }, []);

  // --- LOAD CHAT FROM BACKEND ---
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

  // --- HANDLE SUBMIT ---
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
        setMode("chat");
        setChatHistory((prev) => [...prev, { sender: "bot", text: data.response }]);
        if (data.chat_id) {
          setChatId(data.chat_id);
          setRefreshTrigger((r) => r + 1);
        }
      } else if (data.mode === "model") {
        const modelPath = "http://127.0.0.1:8000" + data.model_url;
        const newModel = {
          name: data.title || "Generated Model",
          modelUrl: data.model_url,
          thumbnail: data.thumbnail,
        };

        setMode("model");
        setModelUrl(modelPath);
        setChatId(data.chat_id || chatId);
        setActiveModels((prev) => [...prev, newModel]);
        setCurrentModelIndex(activeModels.length); // set to new model
        setChatHistory((prev) => [...prev, { sender: "bot", text: data.response }]);
        setRefreshTrigger((r) => r + 1);
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

  // --- SIDEBAR SESSION SELECT ---
  const handleSelectSession = (session) => {
    setChatId(session.id);
    loadChatFromBackend(session.id);
  };

  // --- TEMPLATE SELECT ---
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

  // --- MODEL NAVIGATION ---
  const handleNextModel = () => {
    if (currentModelIndex < activeModels.length - 1) {
      const nextIndex = currentModelIndex + 1;
      setCurrentModelIndex(nextIndex);
      const nextModel = activeModels[nextIndex];
      setModelUrl("http://127.0.0.1:8000" + nextModel.modelUrl);
    }
  };

  const handlePrevModel = () => {
    if (currentModelIndex > 0) {
      const prevIndex = currentModelIndex - 1;
      setCurrentModelIndex(prevIndex);
      const prevModel = activeModels[prevIndex];
      setModelUrl("http://127.0.0.1:8000" + prevModel.modelUrl);
    }
  };

  // --- BACK TO HOME ---
  const handleBackToHome = () => {
    setMode("home");
    setModelUrl(null);
    setChatId(null);
    setChatHistory([]);
    setActiveModels([]);
    localStorage.removeItem("modelUrl");
    localStorage.setItem("appMode", "home");
  };

  useEffect(() => {
    const handleKey = (e) => {
      if (mode === "model") {
        if (e.key === "ArrowRight") handleNextModel();
        if (e.key === "ArrowLeft") handlePrevModel();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [mode, currentModelIndex, activeModels]);


  // --- RENDER ---
  return (
    <>
      <Sidebar
        isOpen={sidebarOpen}
        onSelectSession={handleSelectSession}
        userId={userId}
        refreshTrigger={refreshTrigger}
      />

      <div className={`meku-theme app-container ${sidebarOpen ? "sidebar-open" : ""}`}>
        <Header
          onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
        />

        {(mode === "chat" || mode === "model") && (
          <BackButton onClick={handleBackToHome} />
        )}

        {/* 🏠 HOME MODE */}
        {mode === "home" && (
          <>
            <HomeGrid onSelectModel={handleTemplateSelect} userId={userId} />
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[80%] max-w-[700px] px-4">
              <InputBar
                prompt={prompt}
                setPrompt={setPrompt}
                handleSubmit={handleSubmit}
                loading={loading}
                mode={mode}
              />
            </div>
          </>
        )}

        {/* 💬 CHAT MODE */}
        {mode === "chat" && (
          <>
            <motion.div
              className="chat-mode"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="w-250 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.15)] rounded-2xl overflow-hidden backdrop-blur-md shadow-[0_0_40px_rgba(99,102,241,0.15)]">
                <ChatBox messages={chatHistory} />
              </div>
            </motion.div>

            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-300 max-w-[700px] px-4">
              <InputBar
                prompt={prompt}
                setPrompt={setPrompt}
                handleSubmit={handleSubmit}
                loading={loading}
                mode={mode}
              />
            </div>
          </>
        )}

        {/* 🧬 MODEL MODE */}
        {mode === "model" && (
          <motion.div
            className="model-chat-layout px-6 gap-6 relative"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {/* 🧬 MODEL VIEWER COLUMN */}
            <div className="flex flex-col flex-[0.6]">
              {/* Model Viewer Box */}
              <div className="relative h-full rounded-2xl overflow-hidden border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] shadow-[0_0_30px_rgba(99,102,241,0.2)]">
                {/* Model Name at Top */}
                {activeModels.length > 0 && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[rgba(0,0,0,0.65)] px-5 py-2 rounded-full text-sm text-white shadow-md backdrop-blur-md z-20">
                    {activeModels[currentModelIndex]?.name || "Model"}
                    <span className="ml-2 text-gray-400 text-xs">
                      ({currentModelIndex + 1}/{activeModels.length})
                    </span>
                  </div>
                )}

                {/* 3D Viewer */}
                {modelUrl && (
                  <motion.div
                    key={modelUrl}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="w-full h-full"
                  >
                    <ThreeViewer modelPath={modelUrl} />
                  </motion.div>
                )}
              </div>

              {/* 🖼️ Thumbnails + Arrows BELOW the Viewer */}
              {activeModels.length > 0 && (
                <div className="relative flex items-center justify-center mt-4 py-3 rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] backdrop-blur-md shadow-[0_0_20px_rgba(99,102,241,0.1)]">
                  {/* ← Left Arrow */}
                  {currentModelIndex > 0 && (
                    <button
                      onClick={handlePrevModel}
                      className="absolute left-4 bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.25)] text-white rounded-full w-9 h-9 flex items-center justify-center text-lg shadow-lg backdrop-blur-md transition-all"
                    >
                      ←
                    </button>
                  )}

                  {/* Thumbnails */}
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
                        className={`w-14 h-14 rounded-lg object-cover cursor-pointer border-2 transition-all ${idx === currentModelIndex
                            ? "border-blue-400 scale-105"
                            : "border-transparent opacity-80 hover:opacity-100"
                          }`}
                      />
                    ))}
                  </div>

                  {/* → Right Arrow */}
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
            </div>

            {/* 💬 CHAT COLUMN */}
            <div className="flex-[0.4] flex flex-col h-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.15)] rounded-2xl shadow-[0_0_40px_rgba(99,102,241,0.15)]">
              <div className="flex-1 overflow-y-auto p-4 chat-box">
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
          </motion.div>
        )}
      </div>
    </>
  );

}

export default App;
