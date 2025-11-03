# # ==========================================================
# # MCP Client powered by Llama 3 (local Ollama)
# # ==========================================================

# import asyncio
# import os
# import sys
# import json
# import urllib.request
# from typing import Optional
# from contextlib import AsyncExitStack
# import re
# import ast

# # MCP client imports
# from mcp import ClientSession, StdioServerParameters
# from mcp.client.stdio import stdio_client


# class MCPClient:
#     def __init__(self):
#         """Initialize the MCP client and Llama 3 (Ollama) configuration."""
#         self.session: Optional[ClientSession] = None
#         self.exit_stack = AsyncExitStack()

#         # Ollama local model config
#         self.ollama_url = "http://localhost:11434/api/generate"
#         self.model = "gpt-oss:20b"

#     async def connect_to_server(self, server_script_path: str):
#         """Connect to the MCP server and list available tools."""

#         command = "python" if server_script_path.endswith(".py") else "node"
#         server_params = StdioServerParameters(command=command, args=[server_script_path])

#         # Establish communication with the MCP server
#         stdio_transport = await self.exit_stack.enter_async_context(stdio_client(server_params))
#         self.stdio, self.write = stdio_transport

#         # Create and initialize session
#         self.session = await self.exit_stack.enter_async_context(ClientSession(self.stdio, self.write))
#         await self.session.initialize()

#         # List available tools
#         response = await self.session.list_tools()
#         tools = response.tools
#         print("\nConnected to server with tools:", [tool.name for tool in tools])

#         # Convert tools into readable format for the model
#         self.tool_descriptions = convert_mcp_tools_to_prompt(tools)

#     def call_llama_local(self, prompt: str) -> str:
#         """Send a prompt to local Llama 3 (via Ollama) and return the response."""
#         payload = json.dumps({
#             "model": self.model,
#             "prompt": prompt,
#             "stream": False
#         }).encode("utf-8")

#         req = urllib.request.Request(
#             self.ollama_url,
#             data=payload,
#             headers={"Content-Type": "application/json"}
#         )

#         with urllib.request.urlopen(req) as response:
#             data = json.loads(response.read().decode("utf-8"))

#         return data.get("response", "").strip()

    

#     async def process_query(self, query: str) -> str:
#         """
#         Process a user query using Llama 3 and execute MCP tools automatically
#         when suggested by the model.
#         """
#         def build_llama_prompt(self, query: str) -> str:
#             """Create a well-structured prompt that provides context to Llama 3."""
#             return f"""
#                     You are a local AI assistant connected to a Model Context Protocol (MCP) server.

#                     The server provides the following tools:
#                     {self.tool_descriptions}

#                     Your task:
#                     - Understand the user's request.
#                     - Suggest which MCP tool to use and what arguments might be needed.
#                     - If no tool is needed, just answer the query directly
#                     User query:
#                     {query}
#                     """

#         # Call Llama 3
#         prompt = build_llama_prompt(self, query)
#         response_text = self.call_llama_local(prompt)
#         return response_text


#     async def chat_loop(self):
#         """Run an interactive REPL chat loop."""
#         print("\nMCP Client Started! Type 'quit' to exit.")
#         while True:
#             query = input("\n Query: ").strip()
#             if query.lower() == "quit":
#                 break
#             response = await self.process_query(query)
#             try:
#                 print("\nResponse:" + response)
#             except Exception as e:
#                 print(f"Error processing response: {e}")

#     async def cleanup(self):
#         """Clean up resources."""
#         await self.exit_stack.aclose()


# # ==========================================================
# # Utility Functions
# # ==========================================================

# def clean_schema(schema):
#     """Remove unwanted 'title' fields from JSON schema recursively."""
#     if isinstance(schema, dict):
#         schema.pop("title", None)
#         if "properties" in schema and isinstance(schema["properties"], dict):
#             for key in schema["properties"]:
#                 schema["properties"][key] = clean_schema(schema["properties"][key])
#     return schema


# def convert_mcp_tools_to_prompt(mcp_tools):
#     """Convert MCP tools into natural language format for Llama 3 prompts."""
#     tool_descriptions = []
#     for tool in mcp_tools:
#         schema = clean_schema(tool.inputSchema)
#         tool_text = f"""
# Tool Name: {tool.name}
# Description: {tool.description}
# Expected Input Schema: {json.dumps(schema, indent=2)}
# """
#         tool_descriptions.append(tool_text.strip())
#     return "\n\n".join(tool_descriptions)


# # ==========================================================
# # Entry Point
# # ==========================================================

# async def main():
#     """Start the MCP client."""
#     if len(sys.argv) < 2:
#         print("Usage: python client.py <path_to_server_script>")
#         sys.exit(1)

#     client = MCPClient()
#     try:
#         await client.connect_to_server(sys.argv[1])
#         await client.chat_loop()
#     finally:
#         await client.cleanup()


# if __name__ == "__main__":
#     asyncio.run(main())





#---------------------------------------------------------------------------------------


# # ==========================================================
# # MCP Client powered by GPT-OSS (local Ollama) with LangChain
# # ==========================================================

# import asyncio
# import os
# import sys
# import json
# import urllib.request
# from typing import Optional, Dict, Any, List
# from contextlib import AsyncExitStack
# import re

# # MCP client imports
# from mcp import ClientSession, StdioServerParameters
# from mcp.client.stdio import stdio_client

# # LangChain imports
# from langchain_community.llms import Ollama
# from langchain_core.prompts import PromptTemplate
# from langchain_core.callbacks.streaming_stdout import StreamingStdOutCallbackHandler


# class ThoughtProcessCallback(StreamingStdOutCallbackHandler):
#     """Custom callback to show the model's thinking process."""
    
#     def __init__(self):
#         super().__init__()
#         self.current_text = ""
        
#     def on_llm_start(self, serialized: Dict[str, Any], prompts: List[str], **kwargs) -> None:
#         print("\n🤔 [GPT-OSS Thinking...]")
        
#     def on_llm_new_token(self, token: str, **kwargs) -> None:
#         print(token, end="", flush=True)
#         self.current_text += token
        
#     def on_llm_end(self, response, **kwargs) -> None:
#         print("\n✓ [Thinking Complete]\n")


# class MCPClient:
#     def __init__(self):
#         """Initialize the MCP client and GPT-OSS (Ollama) configuration."""
#         self.session: Optional[ClientSession] = None
#         self.exit_stack = AsyncExitStack()

#         # Initialize LangChain Ollama with streaming
#         print("🔧 Initializing GPT-OSS model...")
#         self.callback = ThoughtProcessCallback()
        
#         self.llm = Ollama(
#             model="gpt-oss:20b",
#             base_url="http://localhost:11434",
#             callbacks=[self.callback]
#         )
        
#         # Tool execution prompt template
#         self.tool_prompt_template = PromptTemplate(
#             input_variables=["tools", "query", "conversation_history"],
#             template="""You are an AI assistant with access to MCP (Model Context Protocol) tools for Blender automation.

# Available Tools:
# {tools}

# Conversation History:
# {conversation_history}

# User Query: {query}

# Instructions:
# 1. Analyze the user's request carefully
# 2. If a tool is needed, respond with ONLY a JSON object in this exact format:
# {{"tool": "tool_name", "arguments": {{"arg1": "value1", "arg2": "value2"}}}}

# 3. If no tool is needed, provide a helpful text response

# Important:
# - For Blender code execution, use the "blender:execute_blender_code" tool
# - Keep code concise and functional
# - Always use proper Python syntax for Blender
# - Do NOT include markdown code blocks in tool arguments
# - Respond with EITHER a tool call JSON OR regular text, not both

# Your response:"""
#         )
        
#         self.chain = self.tool_prompt_template | self.llm
#         self.conversation_history = []

#     async def connect_to_server(self, server_script_path: str):
#         """Connect to the MCP server and list available tools."""
#         print(f"🔌 Connecting to MCP server: {server_script_path}")

#         command = "python" if server_script_path.endswith(".py") else "node"
#         server_params = StdioServerParameters(command=command, args=[server_script_path])

#         # Establish communication with the MCP server
#         stdio_transport = await self.exit_stack.enter_async_context(stdio_client(server_params))
#         self.stdio, self.write = stdio_transport

#         # Create and initialize session
#         self.session = await self.exit_stack.enter_async_context(ClientSession(self.stdio, self.write))
#         await self.session.initialize()

#         # List available tools
#         response = await self.session.list_tools()
#         tools = response.tools
#         print(f"✓ Connected! Available tools: {[tool.name for tool in tools]}\n")

#         # Convert tools into readable format for the model
#         self.tool_descriptions = self.convert_tools_to_description(tools)
#         self.tools_map = {tool.name: tool for tool in tools}

#     def convert_tools_to_description(self, mcp_tools) -> str:
#         """Convert MCP tools into a clear format for GPT-OSS."""
#         descriptions = []
#         for tool in mcp_tools:
#             schema = self.clean_schema(tool.inputSchema)
#             required = schema.get("required", [])
#             properties = schema.get("properties", {})
            
#             params_desc = []
#             for param_name, param_info in properties.items():
#                 param_type = param_info.get("type", "string")
#                 is_required = "REQUIRED" if param_name in required else "optional"
#                 param_desc = f"  - {param_name} ({param_type}, {is_required})"
#                 if "description" in param_info:
#                     param_desc += f": {param_info['description']}"
#                 params_desc.append(param_desc)
            
#             tool_text = f"""
# Tool: {tool.name}
# Purpose: {tool.description}
# Parameters:
# {chr(10).join(params_desc) if params_desc else '  None'}
# """
#             descriptions.append(tool_text.strip())
        
#         return "\n\n".join(descriptions)

#     def clean_schema(self, schema: Dict) -> Dict:
#         """Remove unwanted 'title' fields from JSON schema recursively."""
#         if isinstance(schema, dict):
#             schema = schema.copy()
#             schema.pop("title", None)
#             if "properties" in schema and isinstance(schema["properties"], dict):
#                 schema["properties"] = {
#                     key: self.clean_schema(value) 
#                     for key, value in schema["properties"].items()
#                 }
#         return schema

#     async def execute_tool(self, tool_name: str, arguments: Dict[str, Any]) -> str:
#         """Execute an MCP tool and return the result."""
#         print(f"\n⚙️  Executing tool: {tool_name}")
#         print(f"📥 Arguments: {json.dumps(arguments, indent=2)}")
        
#         try:
#             result = await self.session.call_tool(tool_name, arguments)
#             print(f"✓ Tool execution complete")
            
#             # Format the result
#             if hasattr(result, 'content'):
#                 content_str = ""
#                 for content in result.content:
#                     if hasattr(content, 'text'):
#                         content_str += content.text
#                 return content_str
#             return str(result)
            
#         except Exception as e:
#             error_msg = f"❌ Error executing tool: {str(e)}"
#             print(error_msg)
#             return error_msg

#     def extract_tool_call(self, response: str) -> Optional[tuple]:
#         """Extract tool name and arguments from model response."""
#         # Try to find JSON in the response
#         json_pattern = r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}'
#         matches = re.finditer(json_pattern, response, re.DOTALL)
        
#         for match in matches:
#             try:
#                 json_str = match.group()
#                 data = json.loads(json_str)
                
#                 if "tool" in data and "arguments" in data:
#                     return (data["tool"], data["arguments"])
#             except json.JSONDecodeError:
#                 continue
        
#         return None

#     async def process_query(self, query: str) -> str:
#         """Process a user query using GPT-OSS and execute MCP tools automatically."""
        
#         # Build conversation history string
#         history_str = ""
#         for entry in self.conversation_history[-3:]:  # Last 3 exchanges
#             history_str += f"User: {entry['user']}\nAssistant: {entry['assistant']}\n\n"
        
#         # Call the LangChain chain
#         print(f"\n💭 Processing query: '{query}'")
        
#         try:
#             response = self.chain.invoke(
#                 {"context_for_prompt": [], "query": query, "conversation_history": history_str, "tools": self.tool_descriptions}
#             )
            
#             # Check if response contains a tool call
#             tool_call = self.extract_tool_call(response)
            
#             if tool_call:
#                 tool_name, arguments = tool_call
#                 print(f"\n🎯 Model suggested tool: {tool_name}")
                
#                 # Execute the tool
#                 result = await self.execute_tool(tool_name, arguments)
                
#                 # Add to conversation history
#                 self.conversation_history.append({
#                     "user": query,
#                     "assistant": f"Executed {tool_name}: {result}"
#                 })
                
#                 return f"Tool Result:\n{result}"
#             else:
#                 # Regular response
#                 self.conversation_history.append({
#                     "user": query,
#                     "assistant": response
#                 })
#                 return response
                
#         except Exception as e:
#             error_msg = f"❌ Error processing query: {str(e)}"
#             print(error_msg)
#             return error_msg

#     async def chat_loop(self):
#         """Run an interactive REPL chat loop."""
#         print("\n" + "="*60)
#         print("MCP Client with GPT-OSS Started!")
#         print("="*60)
#         print("\nCommands:")
#         print("  - Type your request to interact with Blender")
#         print("  - 'quit' or 'exit' to close")
#         print("  - 'clear' to clear conversation history")
#         print("  - 'history' to show conversation history")
#         print("="*60 + "\n")
        
#         while True:
#             try:
#                 query = input("🗣️  You: ").strip()
                
#                 if query.lower() in ["quit", "exit"]:
#                     print("\n👋 Goodbye!")
#                     break
                    
#                 if query.lower() == "clear":
#                     self.conversation_history = []
#                     print("🧹 Conversation history cleared")
#                     continue
                    
#                 if query.lower() == "history":
#                     print("\n📜 Conversation History:")
#                     for i, entry in enumerate(self.conversation_history, 1):
#                         print(f"\n--- Exchange {i} ---")
#                         print(f"User: {entry['user']}")
#                         print(f"Assistant: {entry['assistant'][:100]}...")
#                     continue
                
#                 if not query:
#                     continue
                
#                 response = await self.process_query(query)
#                 print(f"\n🤖 Assistant: {response}\n")
                
#             except KeyboardInterrupt:
#                 print("\n\n👋 Interrupted. Goodbye!")
#                 break
#             except Exception as e:
#                 print(f"\n❌ Error in chat loop: {e}\n")

#     async def cleanup(self):
#         """Clean up resources."""
#         print("\n🧹 Cleaning up...")
#         await self.exit_stack.aclose()


# # ==========================================================
# # Entry Point
# # ==========================================================

# async def main():
#     """Start the MCP client."""
#     if len(sys.argv) < 2:
#         print("Usage: python client.py <path_to_server_script>")
#         print("Example: python client.py blender_server.py")
#         sys.exit(1)

#     client = MCPClient()
#     try:
#         await client.connect_to_server(sys.argv[1])
#         await client.chat_loop()
#     finally:
#         await client.cleanup()


# if __name__ == "__main__":
#     try:
#         asyncio.run(main())
#     except KeyboardInterrupt:
#         print("\n👋 Shutting down...")
#     except Exception as e:
#         print(f"❌ Fatal error: {e}")
#         sys.exit(1)




#---------------------------------------------------------------------------------------
#---------------------------------------------------------------------------------------
#---------------------------------------------------------------------------------------
#---------------------------------------------------------------------------------------
#---------------------------------------------------------------------------------------
#---------------------------------------------------------------------------------------
#---------------------------------------------------------------------------------------
#---------------------------------------------------------------------------------------

# ==========================================================
# MCP Client powered by GPT-OSS (local Ollama) with LangChain
# ==========================================================

import asyncio
import os
import sys
import json
import urllib.request
from typing import Optional, Dict, Any, List
from contextlib import AsyncExitStack
import re

# MCP client imports
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

# LangChain imports
from langchain_community.llms import Ollama
from langchain_core.prompts import PromptTemplate
from langchain_core.callbacks.streaming_stdout import StreamingStdOutCallbackHandler


class ThoughtProcessCallback(StreamingStdOutCallbackHandler):
    """Callback to display GPT-OSS's native chain-of-thought output."""
    
    def __init__(self):
        super().__init__()
        self.current_text = ""
        
    def on_llm_start(self, serialized: Dict[str, Any], prompts: List[str], **kwargs) -> None:
        print("\n[GPT-OSS Response]")
        print("-" * 70)
        
    def on_llm_new_token(self, token: str, **kwargs) -> None:
        # Simply print the token as-is to show native chain-of-thought
        print(token, end="", flush=True)
        self.current_text += token
        
    def on_llm_end(self, response, **kwargs) -> None:
        print("\n" + "-" * 70)


class MCPClient:
    def __init__(self):
        """Initialize the MCP client and GPT-OSS (Ollama) configuration."""
        self.session: Optional[ClientSession] = None
        self.exit_stack = AsyncExitStack()

        # Initialize LangChain Ollama with streaming
        print("🔧 Initializing GPT-OSS model...")
        self.callback = ThoughtProcessCallback()
        
        self.llm = Ollama(
            model="gpt-oss:20b",
            base_url="http://localhost:11434",
            callbacks=[self.callback],
            verbose=True
        )
        
        # Tool execution prompt template
        self.tool_prompt_template = PromptTemplate(
            input_variables=["tools", "query", "conversation_history"],
            template="""You are an AI assistant with access to MCP (Model Context Protocol) tools for Blender automation.

Available Tools:
{tools}

Conversation History:
{conversation_history}

User Query: {query}

Instructions:
1. Analyze the user's request carefully
2. If a tool is needed, respond with ONLY a JSON object in this exact format:
{{"tool": "tool_name", "arguments": {{"arg1": "value1", "arg2": "value2"}}}}

3. If no tool is needed, provide a helpful text response

Important:
- For Blender code execution, use the "blender:execute_blender_code" tool
- Keep code concise and functional
- Always use proper Python syntax for Blender
- Do NOT include markdown code blocks in tool arguments
- Respond with EITHER a tool call JSON OR regular text, not both

Your response:"""
        )
        
        self.chain = self.tool_prompt_template | self.llm
        self.conversation_history = []

    async def connect_to_server(self, server_script_path: str):
        """Connect to the MCP server and list available tools."""
        print(f"🔌 Connecting to MCP server: {server_script_path}")

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
        print(f"✓ Connected! Available tools: {[tool.name for tool in tools]}\n")

        # Convert tools into readable format for the model
        self.tool_descriptions = self.convert_tools_to_description(tools)
        self.tools_map = {tool.name: tool for tool in tools}

    def convert_tools_to_description(self, mcp_tools) -> str:
        """Convert MCP tools into a clear format for GPT-OSS."""
        descriptions = []
        for tool in mcp_tools:
            schema = self.clean_schema(tool.inputSchema)
            required = schema.get("required", [])
            properties = schema.get("properties", {})
            
            params_desc = []
            for param_name, param_info in properties.items():
                param_type = param_info.get("type", "string")
                is_required = "REQUIRED" if param_name in required else "optional"
                param_desc = f"  - {param_name} ({param_type}, {is_required})"
                if "description" in param_info:
                    param_desc += f": {param_info['description']}"
                params_desc.append(param_desc)
            
            tool_text = f"""
Tool: {tool.name}
Purpose: {tool.description}
Parameters:
{chr(10).join(params_desc) if params_desc else '  None'}
"""
            descriptions.append(tool_text.strip())
        
        return "\n\n".join(descriptions)

    def clean_schema(self, schema: Dict) -> Dict:
        """Remove unwanted 'title' fields from JSON schema recursively."""
        if isinstance(schema, dict):
            schema = schema.copy()
            schema.pop("title", None)
            if "properties" in schema and isinstance(schema["properties"], dict):
                schema["properties"] = {
                    key: self.clean_schema(value) 
                    for key, value in schema["properties"].items()
                }
        return schema

    async def execute_tool(self, tool_name: str, arguments: Dict[str, Any]) -> str:
        """Execute an MCP tool and return the result."""
        print(f"\n" + "="*70)
        print(f"⚙️  EXECUTING TOOL: {tool_name}")
        print("="*70)
        print(f"📥 Arguments:")
        print(json.dumps(arguments, indent=2))
        print("-"*70)
        
        try:
            print("🔄 Calling MCP server...")
            result = await self.session.call_tool(tool_name, arguments)
            print("✅ Tool execution successful!")
            print("-"*70)
            
            # Format the result
            if hasattr(result, 'content'):
                content_str = ""
                for content in result.content:
                    if hasattr(content, 'text'):
                        content_str += content.text
                
                print("📤 Result preview:")
                preview = content_str[:200] + "..." if len(content_str) > 200 else content_str
                print(preview)
                print("="*70)
                return content_str
            
            result_str = str(result)
            print("📤 Result preview:")
            preview = result_str[:200] + "..." if len(result_str) > 200 else result_str
            print(preview)
            print("="*70)
            return result_str
            
        except Exception as e:
            error_msg = f"❌ Error executing tool: {str(e)}"
            print(error_msg)
            import traceback
            print(f"🐛 Traceback:\n{traceback.format_exc()}")
            print("="*70)
            return error_msg

    def extract_tool_call(self, response: str) -> Optional[tuple]:
        """Extract tool name and arguments from model response."""
        # Try to find JSON in the response
        json_pattern = r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}'
        matches = re.finditer(json_pattern, response, re.DOTALL)
        
        for match in matches:
            try:
                json_str = match.group()
                data = json.loads(json_str)
                
                if "tool" in data and "arguments" in data:
                    return (data["tool"], data["arguments"])
            except json.JSONDecodeError:
                continue
        
        return None

    async def process_query(self, query: str) -> str:
        """Process a user query using GPT-OSS and execute MCP tools automatically."""
        
        # Build conversation history string
        history_str = ""
        for entry in self.conversation_history[-3:]:  # Last 3 exchanges
            history_str += f"User: {entry['user']}\nAssistant: {entry['assistant']}\n\n"
        
        # Call the LangChain chain
        print(f"\n💭 Processing query: '{query}'")
        
        try:
            response = self.chain.invoke(
                {"context_for_prompt": [], "query": query, "conversation_history": history_str, "tools": self.tool_descriptions}
            )
            
            # Check if response contains a tool call
            tool_call = self.extract_tool_call(response)
            
            if tool_call:
                tool_name, arguments = tool_call
                print(f"\n🎯 Model suggested tool: {tool_name}")
                
                # Execute the tool
                result = await self.execute_tool(tool_name, arguments)
                
                # Add to conversation history
                self.conversation_history.append({
                    "user": query,
                    "assistant": f"Executed {tool_name}: {result}"
                })
                
                return f"Tool Result:\n{result}"
            else:
                # Regular response
                self.conversation_history.append({
                    "user": query,
                    "assistant": response
                })
                return response
                
        except Exception as e:
            error_msg = f"❌ Error processing query: {str(e)}"
            print(error_msg)
            return error_msg

    async def chat_loop(self):
        """Run an interactive REPL chat loop."""
        print("\n" + "="*60)
        print("🚀 MCP Client with GPT-OSS Started!")
        print("="*60)
        print("\nCommands:")
        print("  - Type your request to interact with Blender")
        print("  - 'quit' or 'exit' to close")
        print("  - 'clear' to clear conversation history")
        print("  - 'history' to show conversation history")
        print("="*60 + "\n")
        
        while True:
            try:
                query = input("🗣️  You: ").strip()
                
                if query.lower() in ["quit", "exit"]:
                    print("\n👋 Goodbye!")
                    break
                    
                if query.lower() == "clear":
                    self.conversation_history = []
                    print("🧹 Conversation history cleared")
                    continue
                    
                if query.lower() == "history":
                    print("\n📜 Conversation History:")
                    for i, entry in enumerate(self.conversation_history, 1):
                        print(f"\n--- Exchange {i} ---")
                        print(f"User: {entry['user']}")
                        print(f"Assistant: {entry['assistant'][:100]}...")
                    continue
                
                if not query:
                    continue
                
                response = await self.process_query(query)
                print(f"\n🤖 Assistant: {response}\n")
                
            except KeyboardInterrupt:
                print("\n\n👋 Interrupted. Goodbye!")
                break
            except Exception as e:
                print(f"\n❌ Error in chat loop: {e}\n")

    async def cleanup(self):
        """Clean up resources."""
        print("\n🧹 Cleaning up...")
        await self.exit_stack.aclose()


# ==========================================================
# Entry Point
# ==========================================================

async def main():
    """Start the MCP client."""
    if len(sys.argv) < 2:
        print("Usage: python client.py <path_to_server_script>")
        print("Example: python client.py blender_server.py")
        sys.exit(1)

    client = MCPClient()
    try:
        await client.connect_to_server(sys.argv[1])
        await client.chat_loop()
    finally:
        await client.cleanup()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Shutting down...")
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        sys.exit(1)


#---------------------------------------------------------------------------------------
#---------------------------------------------------------------------------------------
#---------------------------------------------------------------------------------------
#---------------------------------------------------------------------------------------
#---------------------------------------------------------------------------------------
#---------------------------------------------------------------------------------------
#---------------------------------------------------------------------------------------
# # ==========================================================