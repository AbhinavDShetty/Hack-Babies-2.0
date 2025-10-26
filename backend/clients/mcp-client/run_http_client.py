import asyncio
import sys
import json
from mcp.client.session_group import ClientSessionGroup, StreamableHttpParameters

async def interactive(url: str):
    group = ClientSessionGroup()
    try:
        server_params = StreamableHttpParameters(url=url)
        session = await group.connect_to_server(server_params)

        # List tools
        tools = (await session.list_tools()).tools
        print("Available tools:")
        for t in tools:
            print(f"- {t.name}: {t.description}")

        # Simple interactive loop to call tools
        while True:
            q = input("\nTool to call (or 'quit'): ").strip()
            if q.lower() == 'quit':
                break
            matching = [t for t in tools if t.name == q]
            if not matching:
                print("Tool not found. Choose one of:")
                for t in tools:
                    print(f" - {t.name}")
                continue
            tool_name = matching[0].name
            raw_args = input("JSON args (or empty for none): ").strip()
            args = json.loads(raw_args) if raw_args else {}
            print(f"Calling {tool_name} with {args}...")
            res = await session.call_tool(tool_name, args)
            print("Result:")
            print(res)
    finally:
        try:
            await group.__aexit__(None, None, None)
        except Exception:
            pass

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: python run_http_client.py http://host:port')
        sys.exit(1)
    asyncio.run(interactive(sys.argv[1]))
