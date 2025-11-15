import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trash2, Menu, X } from "lucide-react";

export default function Sidebar({
  isOpen,
  setIsOpen,
  onSelectSession,
  userId,
  refreshTrigger,
}) {
  const [sessions, setSessions] = useState([]);

  // Fetch all chat sessions (unified model + chat)
  const fetchSessions = async () => {
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/chats/?user_id=${userId}`
      );

      if (!res.ok) throw new Error("Failed to fetch chat sessions");

      const data = await res.json();
      setSessions(data); // your existing state setter
    } catch (error) {
      console.error("❌ Error fetching sessions:", error);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [userId, refreshTrigger]);

  // Handle chat deletion
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this chat?")) return;
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/chat/${id}/delete/`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== id));
      } else {
        console.error("Failed to delete chat:", await res.text());
      }
    } catch (err) {
      console.error("❌ Error deleting chat:", err);
    }
  };

  return (
    <>
      {/* Floating Menu Button when Sidebar is CLOSED */}
      {!isOpen && (
        <motion.button
          onClick={() => setIsOpen(true)}
          initial={{ x: -60, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="fixed top-4 left-5 z-50 text-white p-3 rounded-full shadow-lg backdrop-blur-md hover:cursor-pointer hover:text-slate-300"
        >
          <Menu size={25} />
        </motion.button>
      )}

      {/* Sidebar Panel */}
      <motion.div
        initial={{ x: -300 }}
        animate={{ x: isOpen ? 0 : -300 }}
        transition={{ duration: 0.35, ease: "easeInOut" }}
        className="fixed left-0 top-0 h-full w-[280px] bg-[rgba(15,23,42,0.97)] border-r border-[rgba(255,255,255,0.1)] shadow-lg backdrop-blur-xl z-40 flex flex-col overflow-hidden"
      >
        {/* Header Section with Close Button */}
        <div className="flex items-center justify-between p-4 border-b border-[rgba(255,255,255,0.1)]">
          <h2 className="text-lg font-semibold text-white">💬 All Chats</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-300 hover:text-red-400 transition"
            title="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto custom-scroll p-2">
          {sessions.length === 0 ? (
            <p className="text-gray-400 text-sm text-center mt-4">
              No chats yet. Start a new conversation!
            </p>
          ) : (
            sessions.map((s) => (
              <motion.div
                key={s.id}
                whileHover={{ scale: 1.02 }}
                className="flex items-center justify-between p-2 mb-2 rounded-xl cursor-pointer bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(99,102,241,0.15)] transition-all"
                onClick={() => onSelectSession(s)}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  {s.thumbnail ? (
                    <img
                      src={
                        s.thumbnail.startsWith("http")
                          ? s.thumbnail
                          : `http://127.0.0.1:8000${s.thumbnail}`
                      }
                      alt="thumbnail"
                      className="w-10 h-10 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-[rgba(255,255,255,0.08)] flex items-center justify-center text-gray-300 text-sm">
                      💬
                    </div>
                  )}

                  <div className="flex flex-col overflow-hidden">
                    <span className="text-white font-medium truncate max-w-[140px]">
                      {s.title || "Untitled Chat"}
                    </span>
                    <span className="text-gray-400 text-xs truncate">
                      {s.model_name
                        ? `Model: ${s.model_name}`
                        : "No models yet"}
                    </span>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(s.id);
                  }}
                  className="text-gray-400 hover:text-red-400 transition"
                  title="Delete chat"
                >
                  <Trash2 size={16} />
                </button>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    </>
  );
}
