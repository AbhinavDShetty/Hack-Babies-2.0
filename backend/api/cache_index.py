# backend/api/cache_index.py
import json
import os
import tempfile
from typing import Dict, Optional
from django.conf import settings

CACHE_DIR = os.path.join(settings.MEDIA_ROOT, "models")
CACHE_FILE = os.path.join(CACHE_DIR, "cache_index.json")

def _ensure_cache_dir():
    os.makedirs(CACHE_DIR, exist_ok=True)

def load_cache() -> Dict[str, str]:
    _ensure_cache_dir()
    if not os.path.exists(CACHE_FILE):
        return {}
    try:
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        # If corrupt, back it up and return empty
        try:
            os.rename(CACHE_FILE, CACHE_FILE + ".broken")
        except Exception:
            pass
        return {}

def save_cache(cache: Dict[str, str]) -> None:
    _ensure_cache_dir()
    # atomic write
    fd, tmp = tempfile.mkstemp(dir=CACHE_DIR, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(cache, f, indent=2, ensure_ascii=False)
        os.replace(tmp, CACHE_FILE)
    finally:
        if os.path.exists(tmp):
            try:
                os.remove(tmp)
            except Exception:
                pass

def get_cached_path(key: str) -> Optional[str]:
    cache = load_cache()
    return cache.get(key)

def set_cached_path(key: str, rel_path: str) -> None:
    cache = load_cache()
    cache[key] = rel_path
    save_cache(cache)
