import React from "react";

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
          className={`p-3 rounded-2xl max-w-[80%] ${
            msg.sender === "user"
              ? "self-end bg-linear-to-r from-blue-500 to-indigo-500 text-white"
              : "self-start bg-[rgba(255,255,255,0.1)] text-gray-200"
          }`}
        >
          {msg.text}
        </div>
      ))}
    </div>
  );
}
