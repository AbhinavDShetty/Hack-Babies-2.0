# backend/api/vector_search.py
from sentence_transformers import SentenceTransformer, util
import torch
import faiss, numpy as np, json, re, os
import pubchempy as pcp
from pathlib import Path
from .llm_client import query_llm

DATA_PATH = Path(__file__).resolve().parent / "geeksforgeeks_chemistry_final.json"
INDEX_PATH = Path(__file__).resolve().parent / "chemistry_index.faiss"
DOCS_PATH = Path(__file__).resolve().parent / "chemistry_docs.json"

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


def build_index():
    """Build FAISS index from the JSON dataset."""
    global _index, _documents

    if not DATA_PATH.exists():
        print(f"❌ Data file not found: {DATA_PATH}")
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


def load_index():
    """Load FAISS index from disk if available."""
    global _index, _documents

    if INDEX_PATH.exists() and DOCS_PATH.exists():
        print(f"⚡ Loading cached FAISS index from disk...")
        _index = faiss.read_index(str(INDEX_PATH))
        with open(DOCS_PATH, "r", encoding="utf-8") as f:
            _documents = json.load(f)
        print(f"✅ Loaded {_index.ntotal} vectors.")
        return True
    else:
        print("🧠 Building FAISS index fresh...")
        build_index()
        return False


def retrieve_context(query: str, k: int = 5):
    """Retrieve top-k relevant text chunks for the query."""
    if not _index or not _documents:
        print("⚠️ Index not loaded, calling load_index()...")
        load_index()

    print("Making query embedding and searching in index...")
    q_emb = _embed_model.encode([query], convert_to_numpy=True, normalize_embeddings=True)
    D, I = _index.search(np.array(q_emb, dtype="float32"), k)
    hits = [_documents[idx] for idx in I[0] if 0 <= idx < len(_documents)]
    return "\n\n".join(hits)


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
def retrieve_with_reasoning(prompt: str, chat_history: str = "") -> dict:
    """
    Retrieve context and query the LLM to extract SMILES.
    If the LLM or FAISS fails, fallback to PubChem automatically.
    """
    context = retrieve_context(prompt)
    llm_prompt = f"""
You are a chemistry assistant. Based on the following context and user query,
output a JSON object with keys: 'smiles' , 'title' , 'response' and 'reasoning'.

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
    "reasoning": "User asked for rubbing alcohol, which is ethanol."
    "response": "Ethanol is a common molecule used in rubbing alcohol. Here is the 3D model of ethanol."
}}
"""

    try:
        response_text = query_llm(llm_prompt, timeout=180, retries=1, model_name="gpt-oss:20b")
    except Exception as e:
        print("⚠️ LLM query failed:", e)
        response_text = ""

    smiles = ""
    reasoning = ""
    title = ""

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

    return {"smiles": smiles, "reasoning": reasoning, "response": response.get("answer", response), "title": title}

#===========================================

# Secondary function for chat-style answers
def retrieve_contextual_answer(prompt: str, chat_history: str = "") -> dict:
    """
    Retrieve relevant context from FAISS and query the LLM for a 
    natural-language explanation (chat-style).
    Does NOT extract SMILES or model metadata.
    Returns a dictionary with keys 'answer' and 'title'.
    """
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
- Do NOT answer questions outside chemistry.
- If the question is about anything other than chemistry, respond with something like:
  "I'm here to help with chemistry-related questions. Could you please ask something related to chemistry?"
- Use simple scientific language.
- Do NOT generate molecules or SMILES strings.

You are to only provide a conversational answer.
Return ONLY a JSON object with two keys:
- "answer": the conversational response text
- "title": a concise title summarizing the answer
Example:
{{
  "answer": "Water is a compound made of hydrogen and oxygen in a 2:1 ratio.",
  "title": "Composition of Water"
}}
    """

    try:
        response_text = query_llm(
            llm_prompt,
            timeout=120,
            retries=1,
            model_name="gpt-oss:20b"
        ).strip()

        # Find first valid JSON object in response
        match = re.search(r"\{.*\}", response_text, re.DOTALL)
        if match:
            parsed = json.loads(match.group(0))
            return {
                "answer": parsed.get("answer", "").strip(),
                "title": parsed.get("title", "").strip(),
            }
        else:
            # Fallback if JSON not returned properly
            return {
                "answer": response_text,
                "title": "",
            }

    except Exception as e:
        print("⚠️ LLM chat query failed:", e)
        return {
            "answer": "⚠️ Sorry, I couldn't retrieve an answer at the moment.",
            "title": "Error",
        }
    
#===========================================

# Decide prompt mode with LLM   
def classify_prompt_mode(prompt: str, chat_history: str) -> str:
    """
    Uses a lightweight LLM classification step to decide whether the user 
    wants to 'chat' or 'generate' a model.
    Returns either 'chat' or 'model'.
    """

    llm_prompt = f"""
You are an intelligent assistant that classifies chemistry-related queries.
Decide if the user's input is for chatting (asking a question) 
or generating a molecule/reaction model.

Respond with ONLY one word: "chat" or "model".

If the prompt is not related to chemistry or is unclear, respond with "invalid".

Examples:
- "Explain the structure of DNA" → chat
- "Generate a 3D model of caffeine" → model
- "What is the molecular weight of water?" → chat
- "Make a molecule for glucose" → model
- "Tell me about the properties of ethanol" → chat

Previous Conversation:
{chat_history}

User input:
{prompt}
"""

    try:
        response = query_llm(llm_prompt, timeout=60, retries=1, model_name="llama3:8b").strip().lower()
        if "model" in response:
            return "model"
        if "chat" in response:
            return "chat"
        return "invalid"
    except Exception as e:
        print("⚠️ Failed to classify prompt: (setting default mode as chat)", e)
        # Default to chat to avoid unnecessary model generation
        return "chat"


# ===========================================
# Response Validation Function

# def validate_llm_response(prompt: str, response: str, context: str = "", chat_history: str = "") -> str:
#     """
#     Validates an LLM's response based on chemistry accuracy, context relevance,
#     and logical consistency using a lightweight critic model (llama3:8b).

#     Returns:
#         "valid" or "invalid"
#     """

#     validation_prompt = f"""
# You are an expert chemistry validator AI.
# Your job is to judge whether the assistant's response is factually correct,
# scientifically reasonable, and relevant to the given user query.

# Use the context and conversation provided, but base your judgment on logic and accuracy.

# Previous Conversation:
# {chat_history}

# Relevant Context:
# {context}

# User Query:
# {prompt}

# Assistant Response:
# {response}

# Rules:
# - If the response is factually correct, relevant, and clearly answers the question → respond with "valid".
# - If the response includes incorrect, misleading, off-topic, or nonsensical information → respond with "invalid".
# - Do not include explanations or any text other than one word.

# Answer strictly with one of these two words:
# valid
# invalid
# """

#     try:
#         judgment = query_llm(validation_prompt, timeout=60, retries=1, model_name="llama3:8b").strip().lower()
#         return "valid" if "valid" in judgment else "invalid"
#     except Exception as e:
#         print("⚠️ Response validation failed:", e)
#         return "invalid"


#==========================================
# Hybrid Model Existence Check
def check_existing_model_with_llm(prompt: str, all_models: list) -> dict:
    """
    Hybrid method:
    1. Use MiniLM to find top-k semantically similar models.
    2. Ask GPT-OSS-20B to verify if one matches the requested prompt.
    Returns:
        {
          "exists": bool,
          "name": str or None,
          "model_file": str or None,
          "response": str
        }
    """

    # If there are no models, skip check
    if not all_models:
        return {"exists": False, "name": None, "model_file": None, "response": ""}

    # Convert queryset to list so we can index freely
    all_models = list(all_models)

    # Step 1 — Encode all models
    texts = [f"{m.name}. {m.description or ''}" for m in all_models]
    model_embs = _embed_model.encode(texts, convert_to_tensor=True, normalize_embeddings=True)
    query_emb = _embed_model.encode(prompt, convert_to_tensor=True, normalize_embeddings=True)

    # Step 2 — Find top-3 semantic matches
    cos_scores = util.cos_sim(query_emb, model_embs)[0]
    top_k = min(3, len(all_models))
    top_results = torch.topk(cos_scores, k=top_k)
    top_indices = top_results[1].cpu().tolist()  # ✅ convert to normal Python list

    candidate_models = [all_models[i] for i in top_indices]

    # Step 3 — Prepare compact summaries for LLM
    model_summaries = "\n".join(
        [f"- {m.name}: {m.description[:200]} (file: {m.model_file.url if m.model_file else 'N/A'})"
         for m in candidate_models]
    )

    llm_prompt = f"""
You are a chemistry assistant responsible for retrieving stored molecule models.

Here are some candidate models that may match the user's request:
{model_summaries}

The user asked:
"{prompt}"

Your task:
1. Decide if the user's request matches any of the models.
2. If yes, return a JSON object like:
{{
  "exists": true,
  "name": "Water Molecule",
  "model_file": "models/water.glb",
  "response": "Found this model in stored templates: Water Molecule."
}}
3. If no match, return:
{{
  "exists": false,
  "name": null,
  "model_file": null,
  "response": "No matching model found."
}}

Respond ONLY with valid JSON and nothing else.
"""

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
        else:
            return {"exists": False, "name": None, "model_file": None, "response": ""}
    except Exception as e:
        print("⚠️ check_existing_model_with_llm failed:", e)
        return {"exists": False, "name": None, "model_file": None, "response": ""}