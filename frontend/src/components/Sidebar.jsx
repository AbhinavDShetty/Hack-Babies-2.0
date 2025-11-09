import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trash2, MessageSquare, Box } from "lucide-react";

export default function Sidebar({ isOpen, onSelectSession, userId, refreshTrigger }) {
  const [sessions, setSessions] = useState([]);
  const [activeTab, setActiveTab] = useState("chat");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) fetchSessions();
  }, [userId, refreshTrigger]); // 👈 re-fetch whenever trigger changes

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const res = await fetch(`http://127.0.0.1:8000/api/sessions/${userId}/`);
      const data = await res.json();
      console.log("📦 Sidebar updated sessions:", data);
      setSessions(data || []);
    } catch (err) {
      console.error("❌ Failed to fetch sessions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteChat = async (id) => {
    if (!window.confirm("Delete this chat?")) return;
    await fetch(`http://127.0.0.1:8000/api/chat/${id}/delete/`, { method: "DELETE" });
    fetchSessions();
  };

  const handleDeleteModel = async (id) => {
    if (!window.confirm("Delete this model and its chats?")) return;
    await fetch(`http://127.0.0.1:8000/api/model/${id}/delete/`, { method: "DELETE" });
    fetchSessions();
  };

  const filtered = sessions.filter((s) => s.mode === activeTab);

  return (
    <motion.div
      className={`fixed left-0 top-0 h-full bg-[rgba(15,15,20,0.95)] backdrop-blur-md text-white 
        w-[280px] border-r border-[rgba(255,255,255,0.1)] shadow-lg z-50 
        transition-transform duration-500 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
    >
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-center p-4 border-b border-[rgba(255,255,255,0.1)]">
          <h2 className="text-lg font-semibold">My Sessions</h2>
        </div>

        {/* Tabs */}
        <div className="flex justify-around mt-2 mb-3 text-sm">
          <button
            onClick={() => setActiveTab("chat")}
            className={`px-4 py-1 rounded-full ${
              activeTab === "chat"
                ? "bg-blue-500/30 border border-blue-400/40"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <MessageSquare size={14} className="inline mr-1" /> Chats
          </button>
          <button
            onClick={() => setActiveTab("model")}
            className={`px-4 py-1 rounded-full ${
              activeTab === "model"
                ? "bg-purple-500/30 border border-purple-400/40"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Box size={14} className="inline mr-1" /> Models
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-2">
          {loading && <p className="text-center text-gray-500 mt-4">Loading...</p>}
          {!loading && filtered.length === 0 && (
            <p className="text-center text-gray-500 mt-4">No {activeTab}s yet.</p>
          )}

          {filtered.map((s) => (
            <motion.div
              key={s.id}
              whileHover={{ scale: 1.02 }}
              className="flex items-center justify-between bg-[rgba(255,255,255,0.05)] 
                         hover:bg-[rgba(255,255,255,0.1)] p-3 rounded-lg mb-2 cursor-pointer transition-all"
              onClick={() => onSelectSession(s)}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                {activeTab === "model" && (
                  <img
                    src={s.thumbnail ? "http://127.0.0.1:8000" + s.thumbnail : "/default-thumb.png"}
                    alt="thumb"
                    className="w-10 h-10 rounded-lg object-cover"
                  />
                )}
                <div>
                  <p className="font-medium text-sm truncate w-[140px]">{s.title}</p>
                  <p className="text-[11px] text-gray-400">{s.created_at}</p>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  activeTab === "chat"
                    ? handleDeleteChat(s.id)
                    : handleDeleteModel(s.model_id);
                }}
                className="text-red-400 hover:text-red-500 transition"
              >
                <Trash2 size={16} />
              </button>
            </motion.div>
          ))}
        </div>

        <div className="text-center text-xs text-gray-500 py-3 border-t border-[rgba(255,255,255,0.1)]">
          © Chemistry AI — {new Date().getFullYear()}
        </div>
      </div>
    </motion.div>
  );
}
