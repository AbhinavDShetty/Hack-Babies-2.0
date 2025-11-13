// src/components/Sidebar.jsx
import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Trash2, Menu, X, Search, Star, StarOff, MoreHorizontal, Edit, Plus } from "lucide-react";

/**
 * Sidebar with Session Groups / Folders
 *
 * - Folders persisted in localStorage at key: `sidebar_folders_${userId}`
 * - Session -> folder mapping persisted at key: `sidebar_folder_map_${userId}`
 *
 * No backend changes required.
 */

const FOLDERS_KEY = (userId) => `sidebar_folders_${userId}`;
const FOLDER_MAP_KEY = (userId) => `sidebar_folder_map_${userId}`;

function loadFolders(userId) {
  try {
    const raw = localStorage.getItem(FOLDERS_KEY(userId));
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
function saveFolders(userId, folders) {
  localStorage.setItem(FOLDERS_KEY(userId), JSON.stringify(folders));
}

function loadFolderMap(userId) {
  try {
    const raw = localStorage.getItem(FOLDER_MAP_KEY(userId));
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
function saveFolderMap(userId, map) {
  localStorage.setItem(FOLDER_MAP_KEY(userId), JSON.stringify(map));
}

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

  // folder UI state (local)
  const [folders, setFolders] = useState(() => loadFolders(userId)); // [{id, name, collapsed}]
  const [folderMap, setFolderMap] = useState(() => loadFolderMap(userId)); // { [sessionId]: folderId }
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [openActionsFor, setOpenActionsFor] = useState(null); // session id for actions menu
  const [creatingFolder, setCreatingFolder] = useState(false);

  // fetch sessions from backend
  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/sessions/${userId}/`);
      if (!res.ok) throw new Error("Failed to fetch sessions");
      const data = await res.json();

      // Normalize session objects
      const normalized = (data || []).map((s) => ({
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

      // Apply folder mapping (from local storage)
      const map = loadFolderMap(userId);
      const applied = normalized.map((s) => ({ ...s, folderId: map[String(s.id)] || null }));
      setSessions(applied);
    } catch (err) {
      console.error("❌ Error fetching sessions:", err);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  // initial load
  useEffect(() => {
    setFolders(loadFolders(userId));
    setFolderMap(loadFolderMap(userId));
  }, [userId]);

  useEffect(() => {
    if (isOpen) fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, userId, refreshTrigger]);

  // helpers to manage folders
  const createFolder = (name) => {
    const id = `f_${Date.now()}`;
    const newFolder = { id, name: name || "Untitled", collapsed: false };
    const next = [newFolder, ...folders];
    setFolders(next);
    saveFolders(userId, next);
    setCreatingFolder(false);
    setNewFolderName("");
  };

  const renameFolder = (folderId, name) => {
    const next = folders.map((f) => (f.id === folderId ? { ...f, name } : f));
    setFolders(next);
    saveFolders(userId, next);
    setEditingFolderId(null);
  };

  const deleteFolder = (folderId) => {
    // remove folder and clear mapping for sessions in that folder
    const nextFolders = folders.filter((f) => f.id !== folderId);
    setFolders(nextFolders);
    saveFolders(userId, nextFolders);

    const nextMap = { ...loadFolderMap(userId) };
    Object.keys(nextMap).forEach((sid) => {
      if (nextMap[sid] === folderId) delete nextMap[sid];
    });
    setFolderMap(nextMap);
    saveFolderMap(userId, nextMap);

    // also update sessions state
    setSessions((prev) => prev.map((s) => (s.folderId === folderId ? { ...s, folderId: null } : s)));
  };

  const toggleFolderCollapse = (folderId) => {
    const next = folders.map((f) => (f.id === folderId ? { ...f, collapsed: !f.collapsed } : f));
    setFolders(next);
    saveFolders(userId, next);
  };

  const moveSessionToFolder = (sessionId, folderId) => {
    const idStr = String(sessionId);
    const nextMap = { ...loadFolderMap(userId) };
    if (!folderId) {
      // move to ungrouped
      delete nextMap[idStr];
    } else {
      nextMap[idStr] = folderId;
    }
    setFolderMap(nextMap);
    saveFolderMap(userId, nextMap);

    // update sessions list UI immediately
    setSessions((prev) => prev.map((s) => (String(s.id) === idStr ? { ...s, folderId: folderId || null } : s)));
    setOpenActionsFor(null);
  };

  // Delete session (keeping existing behavior: optimistic removal + immediate delete request)
  // This function will remove session and also clear mapping
  const handleDeleteSession = async (id) => {
    const idStr = String(id);
    // optimistic: remove from UI
    setSessions((prev) => prev.filter((s) => String(s.id) !== idStr));

    // remove mapping if present
    const nextMap = { ...loadFolderMap(userId) };
    if (nextMap[idStr]) {
      delete nextMap[idStr];
      setFolderMap(nextMap);
      saveFolderMap(userId, nextMap);
    }

    try {
      await fetch(`http://127.0.0.1:8000/api/chat/${id}/delete/`, { method: "DELETE" });
    } catch (err) {
      console.error("❌ Error deleting chat:", err);
      // on failure, re-fetch sessions to restore
      fetchSessions();
    }
  };

  const togglePin = async (id) => {
    // optimistic UI toggle
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, pinned: !s.pinned } : s)));
    try {
      await fetch(`http://127.0.0.1:8000/api/session-pin/${id}/`, { method: "POST" });
    } catch (err) {
      console.warn("⚠️ Pin toggle failed on server, refetching.", err);
      fetchSessions();
    }
  };

  // filtering and grouping
  const q = (search || "").toLowerCase().trim();
  const filtered = useMemo(() => {
    if (!q) return sessions;
    return sessions.filter(
      (s) =>
        (s.title || "").toLowerCase().includes(q) ||
        (s.preview || "").toLowerCase().includes(q) ||
        (s.model_name || "").toLowerCase().includes(q)
    );
  }, [sessions, search]);

  // compute sessions per folder
  const sessionsByFolder = useMemo(() => {
    const map = {};
    // ensure every folder id exists
    folders.forEach((f) => (map[f.id] = []));
    map["__ungrouped__"] = [];
    filtered.forEach((s) => {
      const fid = s.folderId || "__ungrouped__";
      if (!map[fid]) map[fid] = [];
      map[fid].push(s);
    });
    // pinned logic: keep pinned in their folder but they can be shown first when rendering inside folder
    Object.keys(map).forEach((k) => {
      map[k].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (b.pinned && !a.pinned) return 1;
        return new Date(b.updated_at) - new Date(a.updated_at);
      });
    });
    return map;
  }, [filtered, folders]);

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

      {/* Sidebar Panel */}
      <motion.aside
        initial={{ x: -320 }}
        animate={{ x: isOpen ? 0 : -320 }}
        transition={{ duration: 0.35, ease: "easeInOut" }}
        className="fixed left-0 top-0 h-full w-[300px] bg-[rgba(15,23,42,0.97)] border-r border-[rgba(255,255,255,0.08)] shadow-lg backdrop-blur-xl z-40 flex flex-col overflow-hidden"
      >
        {/* Header */}
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

        {/* Create folder + Search */}
        <div className="p-3 border-b border-[rgba(255,255,255,0.03)] flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sessions or models..."
              className="bg-white/6 outline-none w-full px-3 py-2 rounded text-sm text-white placeholder-white/40"
              aria-label="Search sessions"
            />
            <button
              title="New folder"
              onClick={() => {
                setCreatingFolder(true);
                setTimeout(() => {
                  const el = document.getElementById("new-folder-input");
                  if (el) el.focus();
                }, 40);
              }}
              className="p-2 rounded bg-white/5 hover:bg-white/8"
            >
              <Plus size={14} />
            </button>
          </div>

          {creatingFolder && (
            <div className="flex gap-2">
              <input
                id="new-folder-input"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                className="bg-transparent outline-none w-full px-3 py-2 rounded text-sm text-white placeholder-white/40 border border-white/6"
              />
              <button
                onClick={() => {
                  if (newFolderName.trim()) createFolder(newFolderName.trim());
                }}
                className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-sm"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setCreatingFolder(false);
                  setNewFolderName("");
                }}
                className="px-3 py-2 rounded bg-white/6 hover:bg-white/8 text-sm"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Body: Pinned first (optionally) and Folder list */}
        <div className="flex-1 overflow-y-auto custom-scroll p-2">
          {loading && <div className="p-3 text-sm text-white/60">Loading sessions…</div>}

          {/* Pinned across all folders? If you prefer pinned global section, uncomment below and show pinned sessions not in folders */}
          {/* Pinned global section example (optional) */}
          {/* const globalPinned = sessions.filter(s => s.pinned && !s.folderId); */}
          {/* render globalPinned here if desired */}

          {/* Render each folder */}
          {folders.map((folder) => {
            const items = sessionsByFolder[folder.id] || [];
            return (
              <div key={folder.id} className="mb-3">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleFolderCollapse(folder.id)}
                      className="text-white/60 p-1 rounded hover:bg-white/3"
                      aria-label="Toggle folder"
                    >
                      {folder.collapsed ? "▶" : "▾"}
                    </button>
                    {editingFolderId === folder.id ? (
                      <input
                        value={folder.name}
                        onChange={(e) =>
                          setFolders((prev) => prev.map((f) => (f.id === folder.id ? { ...f, name: e.target.value } : f)))
                        }
                        onBlur={() => renameFolder(folder.id, folder.name)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") renameFolder(folder.id, folder.name);
                        }}
                        className="bg-transparent outline-none text-white font-medium text-sm"
                      />
                    ) : (
                      <span className="text-sm text-white font-medium">{folder.name}</span>
                    )}
                    <span className="text-xs text-white/40">({items.length})</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingFolderId(folder.id === editingFolderId ? null : folder.id);
                      }}
                      className="p-1 rounded hover:bg-white/3 text-white/60"
                      title="Rename folder"
                    >
                      <Edit size={14} />
                    </button>

                    <button
                      onClick={() => deleteFolder(folder.id)}
                      className="p-1 rounded hover:bg-white/3 text-white/60"
                      title="Delete folder (moves sessions back to ungrouped)"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {!folder.collapsed && items.length > 0 && (
                  <div className="mt-2">
                    {items.map((s) => (
                      <motion.div
                        key={s.id}
                        whileHover={{ scale: 1.01 }}
                        className="flex items-center justify-between p-2 mb-2 rounded-lg cursor-pointer bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)] transition-all"
                        onClick={() => {
                          onSelectSession && onSelectSession(s.raw || s);
                          setIsOpen(false);
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
                            <span className="text-sm text-white font-medium truncate max-w-[150px]">
                              {s.title}
                            </span>
                            <span className="text-xs text-white/50 truncate max-w-[150px]">
                              {s.preview || (s.model_name ? `Model: ${s.model_name}` : "No preview")}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 relative">
                          {/* Actions menu trigger */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenActionsFor(openActionsFor === s.id ? null : s.id);
                            }}
                            title="Actions"
                            className="p-1 rounded hover:bg-white/5"
                          >
                            <MoreHorizontal size={14} />
                          </button>

                          {/* Actions menu */}
                          {openActionsFor === s.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-8 top-8 z-50 w-44 rounded-lg bg-[rgba(8,10,14,0.98)] border border-[rgba(255,255,255,0.06)] shadow-lg p-2"
                            >
                              <div className="flex flex-col gap-1 text-sm">
                                <button
                                  onClick={() => {
                                    // Move to folder list
                                    setOpenActionsFor(null);
                                    const target = prompt(
                                      `Move "${s.title}" to folder (enter folder name or leave empty to ungroup):\nExisting folders: ${folders
                                        .map((f) => f.name)
                                        .join(", ")}`
                                    );
                                    if (target === null) return;
                                    const trimmed = (target || "").trim();
                                    if (!trimmed) {
                                      moveSessionToFolder(s.id, null);
                                      return;
                                    }
                                    // if folder exists, find and move; else create then move
                                    const existing = folders.find((f) => f.name.toLowerCase() === trimmed.toLowerCase());
                                    if (existing) {
                                      moveSessionToFolder(s.id, existing.id);
                                    } else {
                                      // create new folder and move
                                      const newId = `f_${Date.now()}`;
                                      const newF = { id: newId, name: trimmed, collapsed: false };
                                      const next = [newF, ...folders];
                                      setFolders(next);
                                      saveFolders(userId, next);
                                      moveSessionToFolder(s.id, newId);
                                    }
                                  }}
                                  className="px-2 py-1 rounded hover:bg-white/3 text-left"
                                >
                                  Move to folder...
                                </button>

                                <button
                                  onClick={() => {
                                    setOpenActionsFor(null);
                                    // toggle pin
                                    togglePin(s.id);
                                  }}
                                  className="px-2 py-1 rounded hover:bg-white/3 text-left"
                                >
                                  {s.pinned ? "Unpin" : "Pin"}
                                </button>

                                <button
                                  onClick={() => {
                                    setOpenActionsFor(null);
                                    handleDeleteSession(s.id);
                                  }}
                                  className="px-2 py-1 rounded hover:bg-white/3 text-left text-red-400"
                                >
                                  Delete
                                </button>
                              </div>

                              <div className="mt-2 text-xs text-white/50">Or pick a folder:</div>
                              <div className="mt-1 flex flex-col gap-1">
                                <button
                                  onClick={() => {
                                    moveSessionToFolder(s.id, null);
                                  }}
                                  className="text-xs px-2 py-1 rounded hover:bg-white/3 text-left"
                                >
                                  Ungrouped
                                </button>

                                {folders.map((f) => (
                                  <button
                                    key={f.id}
                                    onClick={() => {
                                      moveSessionToFolder(s.id, f.id);
                                    }}
                                    className="text-xs px-2 py-1 rounded hover:bg-white/3 text-left"
                                  >
                                    {f.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* folder empty state */}
                {!folder.collapsed && items.length === 0 && (
                  <div className="text-sm text-white/40 px-2 py-2">No sessions in this folder.</div>
                )}
              </div>
            );
          })}

          {/* Ungrouped section */}
          <div className="mb-3">
            <div className="flex items-center justify-between px-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-white font-medium">All</span>
                <span className="text-xs text-white/40">({(sessionsByFolder["__ungrouped__"] || []).length})</span>
              </div>

              <div className="flex items-center gap-1">
                {/* optional: add global controls */}
              </div>
            </div>

            <div>
              {(sessionsByFolder["__ungrouped__"] || []).map((s) => (
                <motion.div
                  key={s.id}
                  whileHover={{ scale: 1.01 }}
                  className="flex items-center justify-between p-2 mb-2 rounded-lg cursor-pointer bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.04)] transition-all"
                  onClick={() => {
                    onSelectSession && onSelectSession(s.raw || s);
                    setIsOpen(false);
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
                      <span className="text-xs text-white/50 truncate max-w-[150px]">{s.preview || (s.model_name ? `Model: ${s.model_name}` : "No preview")}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenActionsFor(openActionsFor === s.id ? null : s.id);
                      }}
                      title="Actions"
                      className="p-1 rounded hover:bg-white/5"
                    >
                      <MoreHorizontal size={14} />
                    </button>

                    {openActionsFor === s.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-8 top-8 z-50 w-44 rounded-lg bg-[rgba(8,10,14,0.98)] border border-[rgba(255,255,255,0.06)] shadow-lg p-2"
                      >
                        <div className="flex flex-col gap-1 text-sm">
                          <button
                            onClick={() => {
                              setOpenActionsFor(null);
                              const target = prompt(
                                `Move "${s.title}" to folder (enter folder name or leave empty to ungroup):\nExisting folders: ${folders.map((f) => f.name).join(", ")}`
                              );
                              if (target === null) return;
                              const trimmed = (target || "").trim();
                              if (!trimmed) {
                                moveSessionToFolder(s.id, null);
                                return;
                              }
                              const existing = folders.find((f) => f.name.toLowerCase() === trimmed.toLowerCase());
                              if (existing) {
                                moveSessionToFolder(s.id, existing.id);
                              } else {
                                const newId = `f_${Date.now()}`;
                                const newF = { id: newId, name: trimmed, collapsed: false };
                                const next = [newF, ...folders];
                                setFolders(next);
                                saveFolders(userId, next);
                                moveSessionToFolder(s.id, newId);
                              }
                            }}
                            className="px-2 py-1 rounded hover:bg-white/3 text-left"
                          >
                            Move to folder...
                          </button>

                          <button
                            onClick={() => {
                              setOpenActionsFor(null);
                              togglePin(s.id);
                            }}
                            className="px-2 py-1 rounded hover:bg-white/3 text-left"
                          >
                            {s.pinned ? "Unpin" : "Pin"}
                          </button>

                          <button
                            onClick={() => {
                              setOpenActionsFor(null);
                              handleDeleteSession(s.id);
                            }}
                            className="px-2 py-1 rounded hover:bg-white/3 text-left text-red-400"
                          >
                            Delete
                          </button>
                        </div>

                        <div className="mt-2 text-xs text-white/50">Or pick a folder:</div>
                        <div className="mt-1 flex flex-col gap-1">
                          <button
                            onClick={() => {
                              moveSessionToFolder(s.id, null);
                            }}
                            className="text-xs px-2 py-1 rounded hover:bg-white/3 text-left"
                          >
                            Ungrouped
                          </button>

                          {folders.map((f) => (
                            <button
                              key={f.id}
                              onClick={() => {
                                moveSessionToFolder(s.id, f.id);
                              }}
                              className="text-xs px-2 py-1 rounded hover:bg-white/3 text-left"
                            >
                              {f.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[rgba(255,255,255,0.03)] flex items-center justify-between gap-2">
          <div className="text-sm text-white/40">Folders: {folders.length}</div>

          <div>
            <button onClick={() => setIsOpen(false)} className="text-sm text-white/50 hover:text-white px-3 py-1 rounded">
              Close
            </button>
          </div>
        </div>
      </motion.aside>
    </>
  );
}
