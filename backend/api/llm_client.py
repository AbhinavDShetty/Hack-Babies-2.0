# backend/api/llm_client.py
import os
import time
import json
import requests

# Original generate endpoint
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")

# Derive chat URL safely, but allow override
OLLAMA_CHAT_URL = os.getenv(
    "OLLAMA_CHAT_URL",
    OLLAMA_URL.replace("/generate", "/chat") if "/generate" in OLLAMA_URL else "http://localhost:11434/api/chat"
)

MODEL_NAME = os.getenv("OLLAMA_MODEL", "gpt-oss:120b-cloud")


def _query_llm_generate_legacy(
    prompt: str,
    timeout=180,
    retries=2,
    backoff=2,
    model_name: str = MODEL_NAME,
):
    """
    Your original implementation using /api/generate.
    Kept as close to your code as possible.
    """
    payload = {
        "model": model_name,
        "prompt": prompt,
        "stream": False,   # your original flag
    }

    for attempt in range(retries + 1):
        try:
            resp = requests.post(OLLAMA_URL, json=payload, timeout=timeout)
            resp.raise_for_status()
            data = resp.json()

            print(f"LLM response data (model: {model_name}) : {data}")

            if isinstance(data, dict):
                # your original extraction logic
                return (
                    data.get("response")
                    or data.get("output")
                    or data.get("message")
                    or str(data)
                )
            return str(data)

        except requests.exceptions.RequestException as e:
            last_exc = e
            print(f"LLM query attempt {attempt+1} failed: {e}")
            if attempt < retries:
                time.sleep(backoff * (2 ** attempt))
            else:
                raise last_exc


def _query_llm_chat_with_thinking(
    prompt: str,
    timeout=180,
    retries=2,
    backoff=2,
    model_name: str = MODEL_NAME,
) -> dict:
    """
    New implementation using /api/chat with streaming.
    Streams thinking + answer and expects JSON answer.
    """
    payload = {
        "model": model_name,
        "messages": [
            {"role": "user", "content": prompt},
        ],
        "format": "json",   # ask Ollama/model to output valid JSON
        "stream": True,
    }

    for attempt in range(retries + 1):
        try:
            print(f"\n🟦 Querying LLM (chat mode, model={model_name})...\n")

            resp = requests.post(
                OLLAMA_CHAT_URL,
                json=payload,
                timeout=timeout,
                stream=True,
            )
            resp.raise_for_status()

            in_thinking = False
            thinking_acc = ""
            answer_acc = ""

            for line in resp.iter_lines():
                if not line:
                    continue

                try:
                    chunk = json.loads(line.decode())
                except json.JSONDecodeError:
                    print(f"[WARN] Bad JSON chunk: {line}")
                    continue

                msg = chunk.get("message", {})

                # Thinking stream
                if msg.get("thinking"):
                    if not in_thinking:
                        in_thinking = True
                        print("🤔 Thinking:\n", end="", flush=True)
                    print(msg["thinking"], end="", flush=True)
                    thinking_acc += msg["thinking"]

                # Content / final answer stream
                if msg.get("content"):
                    if in_thinking:
                        in_thinking = False
                        print("\n\n🟢 Answer:\n", end="", flush=True)
                    print(msg["content"], end="", flush=True)
                    answer_acc += msg["content"]

                if chunk.get("done"):
                    break

            print("\n\n🟩 Finished streaming.\n")

            # Expect the final answer to be JSON text
            try:
                return json.loads(answer_acc)
            except json.JSONDecodeError:
                raise Exception(
                    f"Model did not return valid JSON in chat mode.\nRaw answer:\n{answer_acc}"
                )

        except requests.exceptions.RequestException as e:
            print(f"❌ Chat attempt {attempt+1} failed: {e}")
            last_exc = e
            if attempt < retries:
                wait = backoff * (2 ** attempt)
                print(f"🔄 Retrying in {wait}s...\n")
                time.sleep(wait)
            else:
                raise last_exc


def query_llm(
    prompt: str,
    timeout=180,
    retries=2,
    backoff=2,
    model_name: str = MODEL_NAME,
):
    """
    Public entrypoint.

    - For llama3:8b (and its variants): use legacy /api/generate path
      (your original behavior).
    - For all other models: use /api/chat with thinking streaming and
      JSON response (if the model cooperates with format='json').
    """

    # Simple guard so any tag like "llama3:8b-instruct" also uses legacy behavior
    if model_name.startswith("llama3:8b"):
        return _query_llm_generate_legacy(
            prompt=prompt,
            timeout=timeout,
            retries=retries,
            backoff=backoff,
            model_name=model_name,
        )

    # Everything else → chat + thinking + JSON
    return _query_llm_chat_with_thinking(
        prompt=prompt,
        timeout=timeout,
        retries=retries,
        backoff=backoff,
        model_name=model_name,
    )
