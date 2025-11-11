# backend/api/llm_client.py
import os
import time
import requests

OLLAMA_URL = "http://localhost:11434/api/generate"

# preferred model; set via env if you want to change without code
MODEL_NAME = "gpt-oss:20b"


def query_llm(prompt: str, timeout=180, retries=2, backoff=2, model_name: str = MODEL_NAME) -> str:
    """
    Query local Ollama with retries and backoff. Returns text or raises.
    """
    payload = {
        "model": model_name,
        "prompt": prompt,
        "stream": False
    }

    for attempt in range(retries + 1):
        try:
            resp = requests.post(OLLAMA_URL, json=payload, timeout=timeout)
            resp.raise_for_status()
            data = resp.json()
            # adjust based on the shape of Ollama response in your setup:
            # many Ollama setups return {"id":..., "response": "..."} or similar
            # adapt the key below if necessary
            print(f"LLM response data (model: {model_name}) : {data}")
            if isinstance(data, dict):
                # try common fields
                return data.get("response") or data.get("output") or data.get("message") or str(data)
            return str(data)
        except requests.exceptions.RequestException as e:
            last_exc = e
            print(f"LLM query attempt {attempt+1} failed: {e}")
            if attempt < retries:
                time.sleep(backoff * (2 ** attempt))
            else:
                raise last_exc