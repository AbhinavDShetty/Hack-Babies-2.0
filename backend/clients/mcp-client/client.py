# ==========================================================
# MCP Client powered by Llama 3 (local Ollama)
# ==========================================================

import asyncio
import os
import sys
import json
import urllib.request
from typing import Optional
from contextlib import AsyncExitStack
import re
import ast

# MCP client imports
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


class MCPClient:
    def __init__(self):
        """Initialize the MCP client and Llama 3 (Ollama) configuration."""
        self.session: Optional[ClientSession] = None
        self.exit_stack = AsyncExitStack()

        # Ollama local model config
        self.ollama_url = "http://localhost:11434/api/generate"
        self.model = "llama3:8b"

    async def connect_to_server(self, server_script_path: str):
        """Connect to the MCP server and list available tools."""

        command = "python" if server_script_path.endswith(".py") else "node"
        server_params = StdioServerParameters(command=command, args=[server_script_path])

        # Establish communication with the MCP server
        stdio_transport = await self.exit_stack.enter_async_context(stdio_client(server_params))
        self.stdio, self.write = stdio_transport

        # Create and initialize session
        self.session = await self.exit_stack.enter_async_context(ClientSession(self.stdio, self.write))
        await self.session.initialize()

        # List available tools
        response = await self.session.list_tools()
        tools = response.tools
        print("\nConnected to server with tools:", [tool.name for tool in tools])

        # Convert tools into readable format for the model
        self.tool_descriptions = convert_mcp_tools_to_prompt(tools)

    def call_llama_local(self, prompt: str) -> str:
        """Send a prompt to local Llama 3 (via Ollama) and return the response."""
        payload = json.dumps({
            "model": self.model,
            "prompt": prompt,
            "stream": False
        }).encode("utf-8")

        req = urllib.request.Request(
            self.ollama_url,
            data=payload,
            headers={"Content-Type": "application/json"}
        )

        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode("utf-8"))

        return data.get("response", "").strip()

    

    async def process_query(self, query: str) -> str:
        """
        Process a user query using Llama 3 and execute MCP tools automatically
        when suggested by the model.
        """
        def build_llama_prompt(self, query: str) -> str:
            """Create a well-structured prompt that provides context to Llama 3."""
            return f"""
                    You are a local AI assistant connected to a Model Context Protocol (MCP) server.

                    The server provides the following tools:
                    {self.tool_descriptions}

                    Your task:
                    - Understand the user's request.
                    - Suggest which MCP tool to use and what arguments might be needed.
                    - If no tool is needed, just answer the query directly and do not return NoneType.
                    User query:
                    {query}
                    """

        # Call Llama 3
        prompt = build_llama_prompt(self, query)
        response_text = self.call_llama_local(prompt)
        print("\nLlama 3 Response:\n", response_text)


    async def chat_loop(self):
        """Run an interactive REPL chat loop."""
        print("\nMCP Client Started! Type 'quit' to exit.")
        while True:
            query = input("\n Query: ").strip()
            if query.lower() == "quit":
                break
            response = await self.process_query(query)
            try:
                print("\n" + response)
            except Exception as e:
                print(f"Error processing response: {e}")

    async def cleanup(self):
        """Clean up resources."""
        await self.exit_stack.aclose()


# ==========================================================
# Utility Functions
# ==========================================================

def clean_schema(schema):
    """Remove unwanted 'title' fields from JSON schema recursively."""
    if isinstance(schema, dict):
        schema.pop("title", None)
        if "properties" in schema and isinstance(schema["properties"], dict):
            for key in schema["properties"]:
                schema["properties"][key] = clean_schema(schema["properties"][key])
    return schema


def convert_mcp_tools_to_prompt(mcp_tools):
    """Convert MCP tools into natural language format for Llama 3 prompts."""
    tool_descriptions = []
    for tool in mcp_tools:
        schema = clean_schema(tool.inputSchema)
        tool_text = f"""
Tool Name: {tool.name}
Description: {tool.description}
Expected Input Schema: {json.dumps(schema, indent=2)}
"""
        tool_descriptions.append(tool_text.strip())
    return "\n\n".join(tool_descriptions)


# ==========================================================
# Entry Point
# ==========================================================

async def main():
    """Start the MCP client."""
    if len(sys.argv) < 2:
        print("Usage: python client.py <path_to_server_script>")
        sys.exit(1)

    client = MCPClient()
    try:
        await client.connect_to_server(sys.argv[1])
        await client.chat_loop()
    finally:
        await client.cleanup()


if __name__ == "__main__":
    asyncio.run(main())
