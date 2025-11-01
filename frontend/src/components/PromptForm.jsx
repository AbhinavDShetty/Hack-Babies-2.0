import { useState } from "react";
import { submitPrompt } from "../api/api";

export default function PromptForm({ onJobCreated }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await submitPrompt(prompt);
      onJobCreated(data.job_id);
      setPrompt("");
    } catch (err) {
      alert("Failed to submit prompt");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="prompt-form">
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe your chemical reaction..."
        rows={4}
        cols={50}
      />
      <br />
      <button type="submit" disabled={loading}>
        {loading ? "Generating..." : "Generate 3D Model"}
      </button>
    </form>
  );
}
