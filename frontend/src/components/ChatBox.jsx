import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

export default function ChatBox({ messages }) {
  return (
    <div
      className="chatbox flex flex-col gap-4 p-6 overflow-y-auto"
      style={{
        height: "calc(100vh - 280px)",
        background: "rgba(255,255,255,0.04)",
        borderRadius: "1rem",
        border: "1px solid rgba(255,255,255,0.1)",
        backdropFilter: "blur(10px)",
        scrollbarWidth: "thin",
      }}
    >
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`p-4 rounded-2xl max-w-[80%] text-left leading-relaxed ${
            msg.sender === "user"
              ? "self-end bg-linear-to-r from-blue-500 to-indigo-500 text-white"
              : "self-start bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.12)] text-slate-200"
          }`}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || "");
                return !inline && match ? (
                  <SyntaxHighlighter
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{
                      background: "rgba(15,23,42,0.8)",
                      borderRadius: "0.75rem",
                      padding: "0.75rem",
                      fontSize: "0.9rem",
                    }}
                    {...props}
                  >
                    {String(children).replace(/\n$/, "")}
                  </SyntaxHighlighter>
                ) : (
                  <code
                    className="bg-[rgba(255,255,255,0.15)] rounded px-1 py-0.5 text-sm font-mono text-blue-300"
                    {...props}
                  >
                    {children}
                  </code>
                );
              },
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  {children}
                </a>
              ),
              strong: ({ children }) => (
                <strong className="text-blue-300 font-semibold">
                  {children}
                </strong>
              ),
              li: ({ children }) => (
                <li className="list-disc list-inside">{children}</li>
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
