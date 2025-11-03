import React, { useState } from "react";
import "@google/model-viewer/dist/model-viewer.min.js";
import { motion } from "framer-motion";
import "./App.css";

function App() {
  const [prompt, setPrompt] = useState("");
  const [modelUrl, setModelUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setModelUrl(null);

    try {
      const response = await fetch("http://127.0.0.1:8000/api/generate-model/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) throw new Error("Backend error");

      const data = await response.json();
      if (data.model_url) {
        setModelUrl("http://127.0.0.1:8000" + data.model_url);
      } else {
        setError("No model generated.");
      }
    } catch (err) {
      setError("⚠️ Failed to connect to backend. Please check your Django server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="meku-theme">
      {/* Header */}
      <motion.div
        className="header"
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="logo">🧬 Hack Babies</div>
        <h1 className="title">Build Very Very Beautiful 3D Molecules with a Very Very Simple Prompt</h1>
        <p className="subtitle">
          Describe any molecule or reaction — we’ll generate an interactive 3D model instantly (approx. 5mins).
        </p>
      </motion.div>

      {/* Category Buttons */}
      <motion.div
        className="tags"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <span>Chemical Reaction</span>
        <span>Organic Compound</span>
        <span>Protein Structure</span>
        <span>Material Model</span>
      </motion.div>

      {/* Input Bar */}
      <motion.form
        onSubmit={handleSubmit}
        className="input-box"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <input
          type="text"
          placeholder="Ask AI to create a 3D molecule (e.g., generate 3D model of sucrose)..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "..." : "➤"}
        </button>
      </motion.form>

      {error && <p className="error-text">{error}</p>}

      {/* 3D Model Section */}
      {modelUrl && (
        <motion.div
          className="model-container"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <model-viewer
            src={modelUrl}
            alt="3D Molecule"
            auto-rotate
            camera-controls
            shadow-intensity="1"
            style={{ width: "100%", height: "100%" }}
          />
        </motion.div>
      )}
    </div>
  );
}

export default App;
