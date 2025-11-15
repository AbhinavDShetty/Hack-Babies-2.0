import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Trash2,
  Menu,
  X,
  Star,
  StarOff,
  Search,
  MessageCircle,
} from "lucide-react";

export default function Sidebar({
  isOpen,
  setIsOpen,
  onSelectSession,
  userId,
  refreshTrigger,
}) {
  const [sessions, setSessions] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // NEW — deletion confirmation stack
  const [pendingConfirmations, setPendingConfirmations] = useState([]);
  const CONFIRM_WINDOW_MS = 5000;

  // LocalStorage key for pinned sessions
  const LS_PINNED_KEY = "pinned_sessions";

  // Helpers for localStorage
  const loadPinnedFromStorage = () => {
    try {
      return JSON.parse(localStorage.getItem(LS_PINNED_KEY)) || [];
    } catch {
      return [];
    }
  };

  const savePinnedToStorage = (ids) => {
    localStorage.setItem(LS_PINNED_KEY, JSON.stringify(ids));
  };

  // Normalize backend sessions
  const normalize = (arr = []) =>
    (arr || []).map((s) => ({
      id: s.id,
      idStr: String(s.id),
      title: s.title || s.name || `Session ${s.id}`,
      preview:
        s.preview ||
        (s.messages && s.messages.length
          ? s.messages[s.messages.length - 1].text
          : ""),
      thumbnail: s.thumbnail || s.thumb || null,
      model_name:
        s.model_name || (s.models && s.models[0] && s.models[0].name) || null,
      pinned: !!s.pinned,
      updated_at:
        s.updated_at ||
        s.modified_at ||
        s.created_at ||
        new Date().toISOString(),
      raw: s,
    }));

  // Fetch sessions
  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/chats/?user_id=${userId}`
      );

      if (!res.ok) throw new Error("Failed to fetch chat sessions");

      const data = await res.json();

      const normalized = normalize(data);

      // Load pinned IDs from localStorage and apply them
      const storedPinned = loadPinnedFromStorage();
      normalized.forEach((s) => {
        if (storedPinned.includes(s.id)) {
          s.pinned = true;
        }
      });

      // pinned first → recent first
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
  }, [isOpen, userId, refreshTrigger]);

  // ───────────────────────────────
  // Deletion Scheduling System
  // ───────────────────────────────
  const scheduleConfirmation = (id) => {
    const idStr = String(id);
    const session =
      sessions.find((s) => s.idStr === idStr) ||
      sessions.find((s) => String(s.id) === idStr) ||
      null;

    if (pendingConfirmations.some((p) => p.idStr === idStr)) return;

    const timeoutId = setTimeout(() => {
      cancelConfirmation(idStr);
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

  const cancelConfirmation = (idStr) => {
    setPendingConfirmations((prev) => {
      const found = prev.find((p) => p.idStr === idStr);
      if (found?.timeoutId) clearTimeout(found.timeoutId);
      return prev.filter((p) => p.idStr !== idStr);
    });
  };

  const confirmDeletion = async (idStr) => {
    cancelConfirmation(idStr);

    // Remove from UI
    setSessions((prev) =>
      prev.filter((s) => s.idStr !== idStr && String(s.id) !== idStr)
    );

    // Also remove from pinned storage
    const pinnedIds = loadPinnedFromStorage();
    const updatedPinned = pinnedIds.filter((pid) => String(pid) !== idStr);
    savePinnedToStorage(updatedPinned);

    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/chat/${idStr}/delete/`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        console.error("Failed to delete:", await res.text());
        fetchSessions();
      }
    } catch (err) {
      console.error("❌ Error deleting chat:", err);
      fetchSessions();
    }
  };

  const handleDelete = (id) => scheduleConfirmation(id);

  // ───────────────────────────────
  // Pinning System (persistent)
  // ───────────────────────────────
  const togglePin = async (id) => {
    setSessions((prev) => {
      const newList = prev
        .map((s) => {
          if (s.id === id) return { ...s, pinned: !s.pinned };
          return s;
        })
        .sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (b.pinned && !a.pinned) return 1;
          return new Date(b.updated_at) - new Date(a.updated_at);
        });

      // Update localStorage
      const pinnedIds = newList.filter((s) => s.pinned).map((s) => s.id);
      savePinnedToStorage(pinnedIds);

      return newList;
    });

    // Also sync with backend
    try {
      await fetch(`http://127.0.0.1:8000/api/session-pin/${id}/`, {
        method: "POST",
      });
    } catch (err) {
      console.warn("⚠️ Pin toggle failed, refetching", err);
      fetchSessions();
    }
  };

  // Filter search
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return sessions;
    return sessions.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.preview || "").toLowerCase().includes(q) ||
        (s.model_name || "").toLowerCase().includes(q)
    );
  }, [sessions, search]);

  const lastPending = pendingConfirmations.length
    ? pendingConfirmations[pendingConfirmations.length - 1]
    : null;

  const [countdown, setCountdown] = useState(0);
  useEffect(() => {
    if (!lastPending) return setCountdown(0);
    const tick = () => {
      const remain = lastPending.requestedAt + CONFIRM_WINDOW_MS - Date.now();
      setCountdown(Math.max(0, Math.ceil(remain / 1000)));
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [lastPending]);

  // ───────────────────────────────
  // Rendering
  // ───────────────────────────────
  return (
    <>
      {/* Floating open button */}
      {!isOpen && (
        <motion.button
          onClick={() => setIsOpen(true)}
          initial={{ x: -60, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="fixed top-4 left-5 z-20 text-white p-3 rounded-full shadow-lg backdrop-blur-md hover:text-slate-300"
        >
          <Menu size={25} />
        </motion.button>
      )}

      {/* Sidebar */}
      <motion.div
        initial={{ x: -300 }}
        animate={{ x: isOpen ? 0 : -300 }}
        transition={{ duration: 0.35, ease: "easeInOut" }}
        className="fixed left-0 top-0 h-full w-[280px] bg-[rgba(15,23,42,0.97)] border-r border-white/10 shadow-lg backdrop-blur-xl z-40 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">
            <MessageCircle size={22} className="inline m-1" />
            All Chats
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-300 hover:text-red-400 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-white/10">
          <div className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-md">
            <Search className="w-4 h-4 text-white/70" />
            <input
              className="bg-transparent outline-none w-full text-sm text-white placeholder-white/40"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats or models..."
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-white/60 hover:text-white text-xs"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto custom-scroll p-2">
          {loading && (
            <p className="text-gray-400 text-sm p-3">Loading sessions…</p>
          )}

          {!loading && filtered.length === 0 && (
            <p className="text-gray-400 text-sm text-center mt-4">
              No chats found.
            </p>
          )}

          {!loading &&
            filtered.map((s) => (
              <motion.div
                key={s.id}
                whileHover={{ scale: 1.02 }}
                className="flex items-center justify-between p-2 mb-2 rounded-xl cursor-pointer bg-white/5 hover:bg-indigo-500/20 transition-all"
                onClick={() => {
                  onSelectSession(s.raw || s);
                  setIsOpen(false);
                }}
              >
                {/* Thumbnail + text */}
                <div className="flex items-center gap-3 overflow-hidden">
                  {s.thumbnail ? (
                    <img
                      src={
                        s.thumbnail.startsWith("http")
                          ? s.thumbnail
                          : `http://127.0.0.1:8000${s.thumbnail}`
                      }
                      className="w-10 h-10 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-gray-300 text-sm">
                      💬
                    </div>
                  )}

                  <div className="flex flex-col overflow-hidden">
                    <span className="text-white font-medium truncate max-w-[140px]">
                      {s.title}
                    </span>
                    <span className="text-gray-400 text-xs truncate max-w-[140px]">
                      {s.preview ||
                        (s.model_name
                          ? `Model: ${s.model_name}`
                          : "No preview")}
                    </span>
                  </div>
                </div>

                {/* Pin + Delete */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePin(s.id);
                    }}
                    className="p-1 rounded hover:bg-white/5"
                  >
                    {s.pinned ? (
                      <Star size={16} className="text-yellow-400" />
                    ) : (
                      <StarOff size={16} className="text-white/50" />
                    )}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(s.id);
                    }}
                    className="p-1 rounded hover:bg-white/5"
                  >
                    <Trash2 size={14} className="text-white/60" />
                  </button>
                </div>
              </motion.div>
            ))}
        </div>
      </motion.div>

      {/* Delete confirmation popup */}
      {lastPending && (
        <div className="fixed left-6 bottom-6 z-[9999] bg-black/85 text-white rounded-xl shadow-xl px-4 py-3 flex items-center gap-3 max-w-[420px]">
          <div className="flex-1 text-sm">
            Confirm delete
            <strong className="mx-1">
              {lastPending.session?.title || "session"}
            </strong>
            ?
          </div>

          <button
            onClick={() => confirmDeletion(lastPending.idStr)}
            className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-white"
          >
            Confirm
          </button>

          <button
            onClick={() => cancelConfirmation(lastPending.idStr)}
            className="bg-white/10 hover:bg-white/20 px-3 py-1 rounded"
          >
            Cancel
          </button>

          {countdown > 0 && (
            <div className="text-xs text-white/50 ml-2">({countdown}s)</div>
          )}
        </div>
      )}
    </>
  );
}
