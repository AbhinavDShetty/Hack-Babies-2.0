# Hack Babies 2.0 Backend

This backend consists of three main components:

- Blender MCP Server
- Chemical Backend (Django)
- MCP Client (LLaMA integration)

## Quick Setup

1. Create a virtual environment and install all components:

```bash
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -e .
```

2. Or install specific components:

```bash
# Just MCP client
pip install -e .[mcp-client]

# Just Chemical backend
pip install -e .[chemical-backend]

# Just Blender MCP
pip install -e .[blender-mcp]
```

3. Alternatively, use the automated setup script to create separate environments:

```bash
.\setup_venvs.ps1
```

## Environment Variables

Create `.env` files in the respective component directories:

### MCP Client (.env)

```
LLAMA_MODEL=llama2
```

### Chemical Backend (.env)

```
DJANGO_SECRET_KEY=your-secret-key
DEBUG=True  # For development
```

## Running Components

1. MCP Client:

```bash
cd clients/mcp-client
python client.py path/to/server_script.py
```

2. Chemical Backend:

```bash
cd chemical_backend
python manage.py migrate
python manage.py runserver
```

3. Blender MCP:

```bash
cd blender-mcp-main
python main.py
```
