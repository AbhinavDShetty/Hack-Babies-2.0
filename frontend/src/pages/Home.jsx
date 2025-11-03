import React, { useState } from "react";
import "@google/model-viewer";

export default function Home() {
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
      const res = await fetch("http://localhost:8000/api/generate/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();

      if (data.status === "completed" && data.result_url) {
        setModelUrl(data.result_url);
      } else {
        throw new Error(data.error || "Model generation failed");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">
        AI 3D Model Generator
      </h1>

      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-xl space-x-2 mb-6"
      >
        <input
          type="text"
          placeholder="Describe your 3D model (e.g., benzene molecule)"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="flex-grow border border-gray-300 p-2 rounded-md focus:ring focus:ring-blue-200"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-50"
        >
          {loading ? "Generating..." : "Generate"}
        </button>
      </form>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {modelUrl && (
        <div className="w-full max-w-3xl h-[500px] border rounded-md shadow">
          <model-viewer
            src={modelUrl}
            alt="Generated 3D model"
            camera-controls
            auto-rotate
            style={{ width: "100%", height: "100%" }}
          ></model-viewer>
        </div>
      )}
    </div>
  );
}
