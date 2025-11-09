
import requests
from .vector_search import fetch_molecule_from_pubchem
import re

OLLAMA_GENERATE = "http://localhost:11434/api/generate"
MODEL_NAME = "gpt-oss:20b"

SYSTEM_INSTR = """
You are an expert 3D model planner for a web app. Given a user prompt and supporting context,
produce a JSON object ONLY (no extra text) with this schema:
{
  "kind": "molecule|general|procedural",
  "format": "glb|obj|pdb|sdf",
  "params": { ... } 
}
If the prompt is about a molecule, include "smiles" or "name" in params. Keep responses valid JSON.
"""

def call_ollama(prompt: str, context: str = "", stream: bool = False, timeout: int = 300):
    full_prompt = f"{SYSTEM_INSTR}\n\nContext:\n{context}\n\nUser Prompt:\n{prompt}"
    payload = {
        "model": MODEL_NAME,
        "prompt": full_prompt,
        "stream": stream,
        # structured format supported by Ollama; optional:
        "format": "json"
    }
    resp = requests.post(OLLAMA_GENERATE, json=payload, timeout=timeout)
    resp.raise_for_status()
    data = resp.json()
    # Ollama returns a "response" key for non-streaming usage (or structured)
    # If you used format=json, you may get parsed JSON; safest: read .get("response")
    return data.get("response") if isinstance(data, dict) else data
