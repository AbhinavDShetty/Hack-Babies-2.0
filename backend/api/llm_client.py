"""
Mock LlamaClient for code generation.

Replace this with a real client that talks to:
- an inference API (Ollama, OpenAI-compatible, etc.)
- or a local LLaMA/CodeLlama server (via llama.cpp/transformers serving).
"""

class LlamaClient:
    def __init__(self):
        # configure endpoint, API keys, or local server if you add a real client
        pass

    def generate_code(self, prompt: str, max_tokens: int = 1500) -> str:
        """
        Return a Blender Python script (string).
        This is a safe mock that creates a small sphere-and-stick-like placeholder using bpy.
        The real LLM should produce code that imports ChemBlender and uses its APIs.
        """
        # A short, valid Blender script that defines generate_scene(output_path)
        script = f"""
import bpy
import math

def generate_scene(output_path):
    # clear scene
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()

    # create a simple 'molecule-like' arrangement of spheres (placeholder)
    def add_sphere(name, location, radius=0.2):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=location)
        obj = bpy.context.active_object
        obj.name = name

    # central atom (oxygen-like)
    add_sphere("O_atom", (0,0,0), radius=0.35)
    # two hydrogens placed at approx 104.5 degrees
    angle = math.radians(52.25)
    x = 0.95 * math.cos(angle)
    y = 0.95 * math.sin(angle)
    add_sphere("H_atom_1", (x, y, 0), radius=0.2)
    add_sphere("H_atom_2", (x, -y, 0), radius=0.2)

    # simple material
    for obj in bpy.data.objects:
        if obj.type == 'MESH':
            mat = bpy.data.materials.new(name="Mat_"+obj.name)
            mat.diffuse_color = (0.6, 0.6, 0.8, 1)
            if obj.data.materials:
                obj.data.materials[0] = mat
            else:
                obj.data.materials.append(mat)

    # export as glb
    bpy.ops.export_scene.gltf(filepath=output_path, export_format='GLB')

if __name__ == "__main__":
    import sys
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=False)
    args, unknown = parser.parse_known_args()
    out = args.output if args.output else "/tmp/output_demo.glb"
    generate_scene(out)
"""
        return script
