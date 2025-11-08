export default function InputBar({ prompt, setPrompt, handleSubmit, loading }) {
  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="input-box"
      >
        <input
          type="text"
          placeholder="Ask AI to create or explain a molecule..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          required
          className=""
        />
        <button
          type="submit"
          disabled={loading}
          className=""
        >
          {loading ? "..." : "➤"}
        </button>
      </form>
      <div class="input-bar-note mt-1 text-center text-[12px] text-gray-400">
        AI can make mistakes. Dont blame us if it does!
      </div>
    </>
  );
}
