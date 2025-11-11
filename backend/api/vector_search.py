# backend/api/vector_search.py

from sentence_transformers import SentenceTransformer, util
import torch
import faiss
import numpy as np
import json
import re
import os
import pubchempy as pcp
from pathlib import Path
from .llm_client import query_llm

# =====================
# PATHS & MODEL SETUP
# =====================
BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "geeksforgeeks_chemistry_final.json"
INDEX_PATH = BASE_DIR / "chemistry_index.faiss"
DOCS_PATH = BASE_DIR / "chemistry_docs.json"

EMBED_MODEL_NAME = os.getenv("EMBED_MODEL", "all-MiniLM-L6-v2")
_embed_model = SentenceTransformer(EMBED_MODEL_NAME)

_index = None
_documents = []


# =====================
# CORE HELPERS
# =====================
def chunk_text(text, chunk_size=400):
    """Split long paragraphs into smaller semantic chunks."""
    sentences = text.split(". ")
    chunks, current = [], ""
    for s in sentences:
        if len(current) + len(s) < chunk_size:
            current += s + ". "
        else:
            chunks.append(current.strip())
            current = s + ". "
    if current.strip():
        chunks.append(current.strip())
    return chunks


# =====================
# INDEX BUILDING
# =====================
def build_index():
    """Build FAISS index from the JSON dataset."""
    global _index, _documents

    if not DATA_PATH.exists():
        print(f"⚠️ Data file not found: {DATA_PATH}. Creating empty dataset.")
        DATA_PATH.write_text("[]", encoding="utf-8")
        return

    print(f"📚 Loading dataset from {DATA_PATH.name}...")
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    all_texts = []
    for entry in data:
        content = entry.get("content", "").strip()
        desc = entry.get("description", "")
        if content:
            chunks = chunk_text(content)
            for c in chunks:
                text = f"{desc}\n\n{c}" if desc else c
                all_texts.append(text)

    print(f"🧩 Total text chunks: {len(all_texts)}")

    if not all_texts:
        print("⚠️ No text chunks to build FAISS index. Aborting build.")
        return

    # Build embeddings
    embs = _embed_model.encode(all_texts, convert_to_numpy=True, normalize_embeddings=True)
    d = embs.shape[1]
    _index = faiss.IndexFlatIP(d)
    _index.add(np.array(embs, dtype="float32"))
    _documents = all_texts

    # Save index and docs for faster reload next time
    faiss.write_index(_index, str(INDEX_PATH))
    with open(DOCS_PATH, "w", encoding="utf-8") as f:
        json.dump(_documents, f, indent=2)

    print(f"✅ FAISS index built and saved ({len(_documents)} entries)")


# =====================
# INDEX LOADING
# =====================
def load_index(force_rebuild=False):
    """
    Load FAISS index and documents from disk.
    If missing or forced, rebuilds automatically.
    """
    global _index, _documents

    try:
        if force_rebuild or not (INDEX_PATH.exists() and DOCS_PATH.exists()):
            print("🧠 FAISS index missing or rebuild requested — building fresh...")
            build_index()
            return True

        print(f"⚡ Loading cached FAISS index from disk...")
        _index = faiss.read_index(str(INDEX_PATH))

        with open(DOCS_PATH, "r", encoding="utf-8") as f:
            _documents = json.load(f)

        print(f"✅ Loaded {_index.ntotal} vectors from FAISS index.")
        return True

    except Exception as e:
        print(f"❌ Failed to load FAISS index: {e}")
        print("🔁 Attempting to rebuild FAISS index...")
        build_index()
        return False


# =====================
# CONTEXT RETRIEVAL
# =====================
def retrieve_context(query: str, k: int = 5):
    """
    Retrieve top-k relevant text chunks for the query.
    If the FAISS index isn't loaded or fails, a safe fallback is used.
    """
    global _index, _documents

    if not _index or not _documents:
        print("⚠️ Index not loaded, calling load_index()...")
        load_index()

    if not _index or not _documents:
        print("🚫 No FAISS index available — returning empty context.")
        return "No context available. (FAISS index not built yet.)"

    try:
        print("🔍 Encoding query and searching index...")
        q_emb = _embed_model.encode([query], convert_to_numpy=True, normalize_embeddings=True)
        D, I = _index.search(np.array(q_emb, dtype="float32"), k)
        hits = [_documents[idx] for idx in I[0] if 0 <= idx < len(_documents)]
        return "\n\n".join(hits) if hits else "No relevant context found."
    except Exception as e:
        print(f"❌ FAISS search failed: {e}")
        return "Error while searching context."


# =====================
# PUBCHEM INTEGRATION
# =====================
def fetch_molecule_from_pubchem(name: str):
    """Fetch SMILES + IUPAC from PubChem and update local DB."""
    try:
        results = pcp.get_compounds(name, "name")
        if not results:
            return None

        comp = results[0]
        smiles = comp.canonical_smiles
        desc = comp.iupac_name or f"Compound related to {name}"

        new_entry = {"name": name, "smiles": smiles, "desc": desc}

        # Load or create dataset
        docs = []
        if DATA_PATH.exists():
            with open(DATA_PATH, "r", encoding="utf-8") as f:
                docs = json.load(f)
        else:
            DATA_PATH.write_text("[]", encoding="utf-8")

        # Avoid duplicates
        if not any(d["name"].lower() == name.lower() for d in docs):
            docs.append(new_entry)
            with open(DATA_PATH, "w", encoding="utf-8") as f:
                json.dump(docs, f, indent=2)
            print(f"✅ Added new molecule to database: {name}")

        # Rebuild FAISS index
        build_index()
        return new_entry
    except Exception as e:
        print(f"❌ PubChem lookup failed for {name}: {e}")
        return None


# =====================
# MAIN RETRIEVAL + LLM
# =====================
def retrieve_with_reasoning(prompt: str, chat_history: str = "") -> dict:
    """
    Retrieve context and query the LLM to extract SMILES.
    If the LLM or FAISS fails, fallback to PubChem automatically.
    """
    context = retrieve_context(prompt)
    llm_prompt = f"""
You are a chemistry assistant. Based on the following context and user query,
output a JSON object with keys: 'smiles', 'title', 'response', and 'reasoning'.

Previous Conversation:
{chat_history}

Context:
{context}

User query:
{prompt}

Example:
{{
    "smiles": "CCO",
    "title": "Ethanol Molecule",
    "reasoning": "User asked for rubbing alcohol, which is ethanol.",
    "response": "Ethanol is a common molecule used in rubbing alcohol. Here is the 3D model of ethanol."
}}
"""

    try:
        response_text = query_llm(llm_prompt, timeout=180, retries=1, model_name="gpt-oss:20b")
    except Exception as e:
        print("⚠️ LLM query failed:", e)
        response_text = ""

    smiles, reasoning, title = "", "", ""

    # Try to parse LLM JSON
    if response_text:
        try:
            match = re.search(r"\{.*\}", response_text, re.DOTALL)
            if match:
                data = json.loads(match.group(0))
                smiles = data.get("smiles", "")
                reasoning = data.get("reasoning", "")
                title = data.get("title", "")
            else:
                reasoning = response_text.strip()
        except Exception:
            reasoning = response_text.strip()

    # Fallback to PubChem if LLM failed
    if not smiles:
        pubchem_data = fetch_molecule_from_pubchem(prompt)
        if pubchem_data:
            smiles = pubchem_data.get("smiles", "")
            reasoning += f"\n(Fetched from PubChem: {pubchem_data.get('desc')})"
        else:
            reasoning += "\n⚠️ Could not find molecule in PubChem."

    response = retrieve_contextual_answer(prompt, chat_history)

    return {"smiles": smiles, "reasoning": reasoning, "response": response, "title": title}


# =====================
# CHAT-STYLE ANSWER
# =====================
def retrieve_contextual_answer(prompt: str, chat_history: str = "") -> dict:
    """Retrieve relevant context and query LLM for conversational answer."""
    context = retrieve_context(prompt)
    llm_prompt = f"""
You are a chemistry tutor chatbot.
Using the context below and your own knowledge,
answer the user's question in a clear, concise way.

Previous Conversation:
{chat_history}

Context:
{context}

User query:
{prompt}

Guidelines:
- Be factually accurate and friendly.
- If you don’t know, say you’re not sure.
- Only answer chemistry-related questions.
Return ONLY JSON with "answer" and "title".
Example:
{{"answer": "Water is made of hydrogen and oxygen.", "title": "Composition of Water"}}
"""

    try:
        response_text = query_llm(llm_prompt, timeout=120, retries=1, model_name="gpt-oss:20b").strip()
        match = re.search(r"\{.*\}", response_text, re.DOTALL)
        if match:
            parsed = json.loads(match.group(0))
            return {
                "answer": parsed.get("answer", "").strip(),
                "title": parsed.get("title", "").strip(),
            }
        else:
            return {"answer": response_text, "title": ""}
    except Exception as e:
        print("⚠️ LLM chat query failed:", e)
        return {"answer": "⚠️ Sorry, I couldn't retrieve an answer at the moment.", "title": "Error"}


# =====================
# PROMPT CLASSIFICATION
# =====================
def classify_prompt_mode(prompt: str, chat_history: str) -> str:
    """Classify whether a prompt is for 'chat' or 'model'."""
    llm_prompt = f"""
You are an intelligent assistant that classifies chemistry-related queries.
Decide if the user's input is for chatting (asking a question)
or generating a molecule/reaction model.

Respond with ONLY: "chat", "model", or "invalid".
"""
    try:
        response = query_llm(llm_prompt, timeout=300, retries=1, model_name="llama3:8b").strip().lower()
        if "model" in response:
            return "model"
        if "chat" in response:
            return "chat"
        return "invalid"
    except Exception as e:
        print("⚠️ Failed to classify prompt:", e)
        return "chat"


# =====================
# MODEL EXISTENCE CHECK
# =====================
def check_existing_model_with_llm(prompt: str, all_models: list) -> dict:
    """
    Hybrid method:
    1. Use MiniLM for top-k semantic similarity.
    2. Ask LLM to confirm closest match.
    """
    if not all_models:
        return {"exists": False, "name": None, "model_file": None, "response": ""}

    all_models = list(all_models)
    texts = [f"{m.name}. {m.description or ''}" for m in all_models]
    model_embs = _embed_model.encode(texts, convert_to_tensor=True, normalize_embeddings=True)
    query_emb = _embed_model.encode(prompt, convert_to_tensor=True, normalize_embeddings=True)

    cos_scores = util.cos_sim(query_emb, model_embs)[0]
    top_k = min(3, len(all_models))
    top_indices = torch.topk(cos_scores, k=top_k)[1].cpu().tolist()
    candidate_models = [all_models[i] for i in top_indices]

    model_summaries = "\n".join(
        [f"- {m.name}: {m.description[:200]} (file: {m.model_file.url if m.model_file else 'N/A'})"
         for m in candidate_models]
    )

    llm_prompt = f"""
You are a chemistry assistant verifying if stored molecule models match a user's request.
Candidate models:
{model_summaries}

User request:
"{prompt}"

Respond in JSON:
{{"exists": true/false, "name": "...", "model_file": "...", "response": "..."}}"""

    try:
        result_text = query_llm(llm_prompt, timeout=120, retries=1, model_name="gpt-oss:20b")
        match = re.search(r"\{.*\}", result_text, re.DOTALL)
        if match:
            parsed = json.loads(match.group(0))
            return {
                "exists": bool(parsed.get("exists", False)),
                "name": parsed.get("name"),
                "response": parsed.get("response", ""),
                "model_file": parsed.get("model_file"),
            }
        return {"exists": False, "name": None, "model_file": None, "response": ""}
    except Exception as e:
        print("⚠️ check_existing_model_with_llm failed:", e)
        return {"exists": False, "name": None, "model_file": None, "response": ""}
