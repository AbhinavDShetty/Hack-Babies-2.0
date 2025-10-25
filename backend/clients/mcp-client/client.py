# ==========================================================
# MCP Client — LLaMA Version (using Ollama)
# Integrates Blender MCP + Django backend with local LLaMA AI
# ==========================================================

import asyncio
import os
import sys
import json
import subprocess
from typing import Optional
from contextlib import AsyncExitStack

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class MCPClient:
    def __init__(self):
        """Initialize the MCP client and configure LLaMA model (via Ollama)."""
        self.session: Optional[ClientSession] = None
        self.exit_stack = AsyncExitStack()

        # Choose LLaMA model (from .env or default)
        self.llama_model = os.getenv("LLAMA_MODEL", "llama3")

    async def connect_to_server(self, server_script_path: str):
        """Connect to the MCP server and list available tools."""

        # Choose correct command for MCP server
        command = "python" if server_script_path.endswith(".py") else "node"
        server_params = StdioServerParameters(command=command, args=[server_script_path])

        # Connect to MCP server (stdio)
        stdio_transport = await self.exit_stack.enter_async_context(stdio_client(server_params))
        self.stdio, self.write = stdio_transport

        # Create client session
        self.session = await self.exit_stack.enter_async_context(ClientSession(self.stdio, self.write))
        await self.session.initialize()

        # Get available tools
        response = await self.session.list_tools()
        tools = response.tools
        print("\nConnected to server with tools:", [tool.name for tool in tools])

        # Store simplified tool definitions
        self.function_declarations = convert_mcp_tools(tools)

    async def process_query(self, query: str) -> str:
        """
        Process user query with local LLaMA model and execute MCP tools if requested.
        """

        # Build structured prompt for LLaMA
        prompt = f"""
You are an AI assistant that can use the following tools:
{json.dumps(self.function_declarations, indent=2)}

When you need to use a tool, respond ONLY with JSON in this format:
{{
  "tool": "tool_name",
  "args": {{ ... }}
}}
If no tool is needed, answer in plain text.

User query: {query}
"""

        # Run Ollama with the given model
        result = subprocess.run(
            ["ollama", "run", self.llama_model, prompt],
            capture_output=True, text=True
        )

        llama_output = result.stdout.strip()

        # Try to detect JSON tool call
        try:
            tool_call = json.loads(llama_output)
            tool_name = tool_call.get("tool")
            tool_args = tool_call.get("args", {})
            if tool_name:
                print(f"\n[LLaMA requested tool call: {tool_name} with args {tool_args}]\n")
                try:
                    result = await self.session.call_tool(tool_name, tool_args)
                    return f"✅ Tool '{tool_name}' executed successfully.\nResult: {result.content}"
                except Exception as e:
                    return f"❌ Error calling tool '{tool_name}': {str(e)}"
        except json.JSONDecodeError:
            pass

        # If no JSON was found, return plain text
        return llama_output

    async def chat_loop(self):
        """Run interactive chat session with the user."""
        print("\n🤖 MCP Client (LLaMA) Started! Type 'quit' to exit.")

        while True:
            query = input("\nQuery: ").strip()
            if query.lower() == "quit":
                break

            response = await self.process_query(query)
            print("\n" + response)

    async def cleanup(self):
        """Clean up resources before exiting."""
        await self.exit_stack.aclose()


def clean_schema(schema):
    """Recursively removes 'title' fields from schema."""
    if isinstance(schema, dict):
        schema.pop("title", None)
        if "properties" in schema and isinstance(schema["properties"], dict):
            for key in schema["properties"]:
                schema["properties"][key] = clean_schema(schema["properties"][key])
    return schema


def convert_mcp_tools(mcp_tools):
    """
    Convert MCP tools to a simplified dict format for LLaMA prompting.
    """
    tools = []
    for tool in mcp_tools:
        tools.append({
            "name": tool.name,
            "description": tool.description,
            "parameters": clean_schema(tool.inputSchema),
        })
    return tools


async def main():
    """Main function to start the MCP client."""
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
