import React, { useState } from "react";
import { motion } from "framer-motion";
import "@google/model-viewer/dist/model-viewer.min.js";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import InputBar from "./components/InputBar";
import ChatBox from "./components/ChatBox";
import ModelViewer from "./components/ModelViewer";
import ReactionViewer from "./components/ReactionViewer";
import HomeGrid from "./components/HomeGrid";
import "./App.css";

function App() {
  const [mode, setMode] = useState("home");
  const [prompt, setPrompt] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [modelUrl, setModelUrl] = useState(null);
  const [reactionData, setReactionData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);

    const newMsg = { sender: "user", text: prompt };
    setChatHistory((prev) => [...prev, newMsg]);

    try {
      const response = await fetch("http://127.0.0.1:8000/api/agent/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: prompt }),
      });

      const data = await response.json();
      const outputs = data.outputs || {};

      if (outputs.reaction) {
        setMode("reaction");
        setReactionData(outputs.reaction);
        setChatHistory((prev) => [
          ...prev,
          { sender: "bot", text: outputs.chat?.text || "Animating your reaction..." },
        ]);
      } else if (outputs.model) {
        setMode("model");
        setModelUrl("http://127.0.0.1:8000" + outputs.model.glb_url);
        setChatHistory((prev) => [
          ...prev,
          { sender: "bot", text: outputs.chat?.text || "Here’s your 3D model!" },
        ]);
      } else {
        setMode("chat");
        setChatHistory((prev) => [
          ...prev,
          { sender: "bot", text: outputs.chat?.text || "Let’s chat about that!" },
        ]);
      }
    } catch (err) {
      console.error(err);
      setChatHistory((prev) => [
        ...prev,
        { sender: "bot", text: "⚠️ Failed to connect to backend." },
      ]);
    } finally {
      setLoading(false);
      setPrompt("");
    }
  };

  return (
    <>
      <Sidebar isOpen={sidebarOpen} />

      <div className={`meku-theme app-container ${sidebarOpen ? "sidebar-open" : ""}`}>
        <Header onSidebarToggle={() => setSidebarOpen(!sidebarOpen)} />

        {mode === "home" && (
          <>
            <HomeGrid />
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

        {mode === "model" && (
          <motion.div
            className="model-chat-layout px-6 gap-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="flex-[0.6] bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.15)] rounded-2xl overflow-hidden backdrop-blur-md shadow-[0_0_40px_rgba(99,102,241,0.15)] p-2">
              <ModelViewer src={modelUrl} />
            </div>

            <div className="flex-[0.4] flex flex-col bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.15)] rounded-2xl backdrop-blur-md shadow-[0_0_40px_rgba(99,102,241,0.15)]">
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

        {mode === "reaction" && (
          <motion.div
            className="model-chat-layout px-6 gap-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="flex-[0.6] bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.15)] rounded-2xl overflow-hidden backdrop-blur-md shadow-[0_0_40px_rgba(99,102,241,0.15)] p-2">
              <ReactionViewer reactionData={reactionData} />
            </div>

            <div className="flex-[0.4] flex flex-col bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.15)] rounded-2xl backdrop-blur-md shadow-[0_0_40px_rgba(99,102,241,0.15)]">
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
