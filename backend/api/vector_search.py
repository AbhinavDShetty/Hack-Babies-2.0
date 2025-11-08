# backend/api/vector_search.py
from sentence_transformers import SentenceTransformer
import faiss, numpy as np, json, re, os
import pubchempy as pcp
from pathlib import Path
from .llm_client import query_llm

# --- Embedding Model Setup ---
EMBED_MODEL_NAME = os.getenv("EMBED_MODEL", "all-MiniLM-L6-v2")
_embed_model = SentenceTransformer(EMBED_MODEL_NAME)

_index = None
_documents = []


def build_index(docs):
    """Builds FAISS index for semantic search."""
    global _index, _documents
    _documents = docs
    embs = _embed_model.encode(docs, convert_to_numpy=True, normalize_embeddings=True)
    d = embs.shape[1]
    _index = faiss.IndexFlatIP(d)
    _index.add(np.array(embs, dtype='float32'))


def retrieve_context(query: str, k: int = 3):
    """Retrieves the top-k relevant text chunks from FAISS index."""
    if not _index or not _documents:
        return ""
    q_emb = _embed_model.encode([query], convert_to_numpy=True, normalize_embeddings=True)
    D, I = _index.search(np.array(q_emb, dtype='float32'), k)
    hits = [ _documents[idx] for idx in I[0] if 0 <= idx < len(_documents) ]
    return "\n\n".join(hits)


def load_docs_from_file(path):
    """Loads docs (JSON or text) and builds FAISS index."""
    with open(path, 'r', encoding='utf-8') as f:
        docs = json.load(f) if path.endswith(".json") else [l.strip() for l in f if l.strip()]
    build_index(docs)


# Path to molecule DB
DATA_PATH = Path(__file__).resolve().parent / "molecule_data.json"


# --- PubChem Integration ---
def fetch_molecule_from_pubchem(name: str):
    """Fetch SMILES + IUPAC from PubChem and update local DB."""
    try:
        results = pcp.get_compounds(name, 'name')
        if not results:
            return None

        comp = results[0]
        smiles = comp.canonical_smiles
        desc = comp.iupac_name or f"Compound related to {name}"

        new_entry = {"name": name, "smiles": smiles, "desc": desc}

        # Save locally
        docs = []
        if DATA_PATH.exists():
            with open(DATA_PATH, 'r', encoding='utf-8') as f:
                docs = json.load(f)
        else:
            DATA_PATH.write_text("[]", encoding='utf-8')

        # Avoid duplicates
        if not any(d["name"].lower() == name.lower() for d in docs):
            docs.append(new_entry)
            with open(DATA_PATH, 'w', encoding='utf-8') as f:
                json.dump(docs, f, indent=2)
            print(f"✅ Added new molecule to database: {name}")

        # Rebuild FAISS index
        build_index([d["desc"] for d in docs])
        return new_entry
    except Exception as e:
        print(f"❌ PubChem lookup failed for {name}: {e}")
        return None


# --- Main LLM + Retrieval Pipeline ---
def retrieve_with_reasoning(prompt: str):
    """
    Retrieve context and query the LLM to extract SMILES.
    If the LLM or FAISS fails, fallback to PubChem automatically.
    """
    context = retrieve_context(prompt)
    llm_prompt = f"""
You are a chemistry assistant. Based on the following context and user query,
output a JSON object with keys: 'smiles' and 'reasoning' and 'response'.

Context:
{context}

User query:
{prompt}

Example:
{{
    "smiles": "CCO",
    "reasoning": "User asked for rubbing alcohol, which is ethanol."
    "response": "Ethanol is a common molecule used in rubbing alcohol. Here is the 3D model of ethanol."
}}
"""

    try:
        response_text = query_llm(llm_prompt, timeout=180, retries=1)
    except Exception as e:
        print("⚠️ LLM query failed:", e)
        response_text = ""

    smiles = ""
    reasoning = ""
    response = ""

    # Try to parse LLM JSON
    if response_text:
        try:
            match = re.search(r"\{.*\}", response_text, re.DOTALL)
            if match:
                data = json.loads(match.group(0))
                smiles = data.get("smiles", "")
                reasoning = data.get("reasoning", "")
                response = data.get("response", "")
            else:
                reasoning = response_text.strip()
                response = response_text.strip()
        except Exception:
            reasoning = response_text.strip()
            response = response_text.strip()

    # Fallback to PubChem if LLM failed
    if not smiles:
        pubchem_data = fetch_molecule_from_pubchem(prompt)
        if pubchem_data:
            smiles = pubchem_data.get("smiles", "")
            reasoning += f"\n(Fetched from PubChem: {pubchem_data.get('desc')})"
            response += f"\nHere is the 3D model of {pubchem_data.get('name')}."
        else:
            reasoning += "\n⚠️ Could not find molecule in PubChem."
            response += "\nSorry, I couldn't find the molecule you're looking for."

    return {"smiles": smiles, "reasoning": reasoning, "response": response}
