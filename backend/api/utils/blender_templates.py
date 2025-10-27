BLENDER_HEADER = '''
import bpy
import sys
# optional: import ChemBlender helpers
# from chemblender import BlenderUtilities

def create_molecule_scene():
    # Example: you will replace this block with LLM generated content
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    # Create example sphere
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.2, location=(0,0,0))
    # ... more generated geometry ...
'''

BLENDER_FOOTER = '''
def main(output_path):
    create_molecule_scene()
    bpy.ops.export_scene.gltf(filepath=output_path)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    main(args.output)
'''
