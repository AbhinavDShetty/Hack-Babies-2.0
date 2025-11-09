
import requests
from .vector_search import fetch_molecule_from_pubchem
import re

OLLAMA_GENERATE = "http://localhost:11434/api/generate"
MODEL_NAME = "gpt-oss:20b"

SYSTEM_INSTR = """
You are an expert 3D model planner for a web app. Given a user prompt and supporting context,
produce a JSON object ONLY (no extra text) with this schema:
{
  "title": "A Short descriptive title",
  "description": "Detailed description of the model"
  "kind": "molecule|general|procedural",
  "format": "glb|obj|pdb|sdf",
  "params": { ... } ,
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

# def parse_prompt_to_plan(prompt: str) -> dict:
#     """
#     Parse a user prompt into a structured plan.
#     Detects if it's a molecule prompt and tries to get SMILES from PubChem if not given.
#     """
#     smiles_match = re.search(r"([A-Za-z0-9@+\-\[\]\(\)=#$]+)", prompt)
#     molecule_name = None

#     if "molecule" in prompt.lower() or smiles_match:
#         if not smiles_match:
#             # Extract the likely molecule name (e.g., "water", "glucose")
#             words = prompt.split()
#             molecule_name = next((w for w in words if w.isalpha()), None)

#         smiles = smiles_match.group(1) if smiles_match else None

#         # 🔍 Try PubChem lookup if SMILES not found
#         if not smiles and molecule_name:
#             info = fetch_molecule_from_pubchem(molecule_name)
#             smiles = info["smiles"] if info else None

#         return {
#             "kind": "molecule",
#             "params": {
#                 "smiles": smiles,
#                 "name": molecule_name or "unknown"
#             }
#         }

#     # fallback general 3D object
#     return {
#         "kind": "general",
#         "params": {"description": prompt}
#     }
