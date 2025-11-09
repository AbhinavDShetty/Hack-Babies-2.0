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
  const [mode, setMode] = useState(localStorage.getItem("appMode") || "home");
  const [prompt, setPrompt] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [chatId, setChatId] = useState(null); // Active chat session ID
  const [modelUrl, setModelUrl] = useState(localStorage.getItem("modelUrl") || null);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const userId = 1; // Placeholder until auth added

  // Persist mode and model between refreshes
  useEffect(() => {
    localStorage.setItem("appMode", mode);
    if (modelUrl) localStorage.setItem("modelUrl", modelUrl);
  }, [mode, modelUrl]);

  // --- 🧠 Load chat messages from backend ---
  const loadChatFromBackend = async (id) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/chat/${id}/`);
      if (!res.ok) throw new Error("Chat not found");
      const data = await res.json();
      setChatHistory(data.messages || []);
      setMode(data.mode);
      setChatId(id);
      if (data.mode === "model" && data.model_url) {
        setModelUrl("http://127.0.0.1:8000" + data.model_url);
      }
    } catch (err) {
      console.error("❌ Failed to load chat:", err);
      setChatHistory([{ sender: "bot", text: "⚠️ Failed to load chat." }]);
    }
  };

  // --- 🚀 Handle prompt submission ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);

    const newMsg = { sender: "user", text: prompt };
    if (mode === "home") setChatHistory([newMsg]);
    else setChatHistory((prev) => [...prev, newMsg]);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/generate-model/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          user_id: userId,
          chat_id: chatId, // ✅ continue same session if exists
        }),
      });

      const data = await res.json();

      // --- INVALID / CHAT MODE ---
      if (["invalid", "chat"].includes(data.mode)) {
        setMode("chat");
        setChatHistory((prev) => [
          ...prev,
          { sender: "bot", text: data.response },
        ]);
        if (data.chat_id) {
          setChatId(data.chat_id);
          setRefreshTrigger((r) => r + 1); // 🔄 update sidebar
        }
      }

      // --- MODEL MODE ---
      else if (data.mode === "model") {
        const modelPath = "http://127.0.0.1:8000" + data.model_url;
        setMode("model");
        setModelUrl(modelPath);
        setChatId(data.chat_id || null);
        setChatHistory([{ sender: "bot", text: data.response }]);
        setRefreshTrigger((r) => r + 1); // 🔄 refresh sidebar
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

  // --- 🧭 Sidebar session click ---
  const handleSelectSession = (session) => {
    setMode(session.mode);
    setChatId(session.id);
    loadChatFromBackend(session.id);
  };

  // --- 🎨 Template model selection ---
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
          return;
        }
      }
    } catch {
      console.warn("⚠️ No existing chat for model, starting fresh.");
    }

    setChatHistory([{ sender: "bot", text: item.description }]);
  };

  // --- 🔙 Back to Home ---
  const handleBackToHome = () => {
    setMode("home");
    setModelUrl(null);
    setChatId(null);
    setChatHistory([]);
    localStorage.removeItem("modelUrl");
    localStorage.setItem("appMode", "home");
  };

  return (
    <>
      <Sidebar
        isOpen={sidebarOpen}
        onSelectSession={handleSelectSession}
        userId={userId}
        refreshTrigger={refreshTrigger} // 🔄 refresh sidebar
      />
      <div className={`meku-theme app-container ${sidebarOpen ? "sidebar-open" : ""}`}>
        <Header onSidebarToggle={() => setSidebarOpen(!sidebarOpen)} />

        {(mode === "chat" || mode === "model") && (
          <BackButton onClick={handleBackToHome} />
        )}

        {/* 🏠 Home View */}
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

        {/* 💬 Chat Mode */}
        {["chat", "invalid"].includes(mode) && (
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

        {/* 🧬 Model Mode */}
        {mode === "model" && (
          <motion.div
            className="model-chat-layout px-6 gap-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="flex-[0.6] h-full rounded-2xl overflow-hidden border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] shadow-[0_0_30px_rgba(99,102,241,0.2)]">
              <ThreeViewer key={modelUrl} modelPath={modelUrl} />
            </div>

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
