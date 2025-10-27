"""
LlmAgent: orchestrates RAG retrieval, LLM code generation, validation, and Blender execution.

This implementation:
- uses the mock Retriever and LlamaClient from this app
- writes the generated script to a temp folder and calls Blender via subprocess
- if Blender binary is not present, it simulates output by writing a tiny placeholder .glb file
"""

from pathlib import Path
import tempfile
import subprocess
import os
import sys
import shutil

from .vector_search import Retriever
from .llm_client import LlamaClient

class LlmAgent:
    def __init__(self):
        self.retriever = Retriever()
        self.llm = LlamaClient()

    def build_prompt(self, user_prompt: str, retrieved_docs: list):
        system = (
            "You are an assistant that outputs a Blender Python script. The script must:\n"
            "- import bpy\n"
            "- define def generate_scene(output_path)\n"
            "- create geometry and export to GLB using bpy.ops.export_scene.gltf(filepath=output_path)\n"
            "Return only valid Python code.\n"
        )
        context = "\n".join(retrieved_docs or [])
        return f"{system}\n\nContext:\n{context}\n\nUser:\n{user_prompt}\n\nOutput only code."

    def run_prompt_and_generate(self, user_prompt: str, job_id: str):
        # 1. RAG retrieval
        docs = self.retriever.retrieve(user_prompt, k=5)

        # 2. Build prompt
        prompt = self.build_prompt(user_prompt, docs)

        # 3. Ask LLM for code
        script_text = self.llm.generate_code(prompt, max_tokens=1500)

        # Basic validation
        if "def generate_scene" not in script_text or "bpy" not in script_text:
            raise ValueError("LLM output missing required structure (bpy or generate_scene).")

        # Save script file
        tmpdir = Path(tempfile.gettempdir()) / f"chem3d_job_{job_id}"
        tmpdir.mkdir(parents=True, exist_ok=True)
        script_file = tmpdir / "generated_blender_script.py"
        script_file.write_text(script_text)

        # Prepare output glb path
        output_glb = tmpdir / "output.glb"

        # Try to run Blender if available; otherwise write a small placeholder GLB
        blender_exec = shutil.which("blender")  # will be None if blender not in PATH
        if blender_exec:
            cmd = [
                blender_exec,
                "--background",
                "--python", str(script_file),
                "--",
                "--output", str(output_glb)
            ]
            try:
                subprocess.run(cmd, check=True, timeout=180)
            except subprocess.CalledProcessError as e:
                # capture error
                raise RuntimeError(f"Blender run failed: {e}")
        else:
            # No Blender available locally — create a tiny placeholder GLB file so frontend can still test.
            placeholder = b"GLB_PLACEHOLDER_BINARY_CONTENT"
            output_glb.write_bytes(placeholder)

        if not output_glb.exists():
            raise FileNotFoundError("Expected output GLB not found after Blender run.")

        # Optionally: move to Django MEDIA_ROOT if set (so Django can serve it via MEDIA_URL)
        media_path = None
        try:
            from django.conf import settings
            media_root = getattr(settings, "MEDIA_ROOT", None)
            if media_root:
                media_dir = Path(media_root)
                media_dir.mkdir(parents=True, exist_ok=True)
                final_path = media_dir / f"job_{job_id}_model.glb"
                shutil.copy2(output_glb, final_path)
                media_path = str(final_path)
        except Exception:
            media_path = None

        return (media_path if media_path else str(output_glb)), "Model generation finished."
