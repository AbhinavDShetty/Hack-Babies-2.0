import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

export default function ChatBox({ messages }) {
  return (
    <div
      className="chatbox flex flex-col gap-3 p-6 overflow-y-auto"
      style={{
        height: "calc(100vh - 200px)",
        background: "rgba(255,255,255,0.04)",
        borderRadius: "1rem",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`p-3 rounded-2xl max-w-[80%] prose prose-invert break-words ${
            msg.sender === "user"
              ? "self-end bg-gradient-to-r from-blue-500 to-indigo-500 text-white"
              : "self-start bg-[rgba(255,255,255,0.1)] text-gray-200"
          }`}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              p: ({ children }) => <p className="mb-2">{children}</p>,
              code: ({ inline, children }) =>
                inline ? (
                  <code className="bg-black/20 px-1 py-0.5 rounded">
                    {children}
                  </code>
                ) : (
                  <pre className="bg-black/40 p-2 rounded-lg overflow-x-auto text-sm">
                    <code>{children}</code>
                  </pre>
                ),
            }}
          >
            {msg.text}
          </ReactMarkdown>
        </div>
      ))}
    </div>
  );
}
