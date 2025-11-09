import os
import tempfile
import traceback
import re, shutil
import numpy as np
import trimesh
from django.conf import settings
from .vector_search import retrieve_with_reasoning, fetch_molecule_from_pubchem
from .llm_client import query_llm
from .cache_index import set_cached_path 


# Try to import RDKit
try:
    from rdkit import Chem
    from rdkit.Chem import AllChem
    _RDKit_AVAILABLE = True
except Exception:
    _RDKit_AVAILABLE = False
    print("⚠️ RDKit not available; molecule generation limited.")


# ----------------------------- Utility -----------------------------

def extract_smiles_from_text(text: str) -> str:
    """Extracts a plausible SMILES string from text."""
    match = re.search(r"([A-Za-z0-9@+\-\[\]\(\)=#$]{2,})", text)
    return match.group(1) if match else ""


# ----------------------------- Step 1: Interpret Prompt -----------------------------

# in generator.py (imports)

def parse_prompt_to_plan(prompt: str):
    result = {}
    try:
        result = retrieve_with_reasoning(prompt) or {}
    except Exception as e:
        print("RAG failed:", e)

    smiles = result.get("smiles")
    reasoning = result.get("reasoning", "")

    if not smiles:
        # ask LLM
        try:
            llm_prompt = f"You are a chemistry assistant. Given: {prompt}\nReturn a single SMILES string only."
            resp = query_llm(llm_prompt, timeout=180, retries=1)
            smiles = extract_smiles_from_text(resp or "")
            reasoning += "\n(LLM inferred SMILES)"
        except Exception as e:
            print("LLM timeout/failure:", e)

    if not smiles:
        # PubChem fallback (works great for named compounds like sucrose)
        pub = fetch_molecule_from_pubchem(prompt)
        if pub and pub.get("smiles"):
            smiles = pub["smiles"]
            reasoning += "\n(Fetched SMILES from PubChem)"
            # optional: also set pub['sdf_path'] into plan so you can use SDF directly
            if pub.get("sdf_path"):
                return {"kind": "molecule", "params": {"smiles": smiles, "sdf_path": pub["sdf_path"]}, "reasoning": reasoning}

    if not smiles:
        raise ValueError("Could not find SMILES for prompt.")

    return {"kind":"molecule","params":{"smiles":smiles},"reasoning":reasoning}



# ----------------------------- Step 2: Generate Molecule + GLB -----------------------------

import os
import numpy as np
import trimesh
from rdkit import Chem
from rdkit.Chem import AllChem

def rdkit_to_glb(smiles, output_dir=None):
    if output_dir is None:
        output_dir = os.path.join(settings.MEDIA_ROOT, "models")
    
    mol = Chem.MolFromSmiles(smiles)
    mol = Chem.AddHs(mol)
    AllChem.EmbedMolecule(mol)
    AllChem.MMFFOptimizeMolecule(mol)

    conf = mol.GetConformer()
    atoms = [atom.GetSymbol() for atom in mol.GetAtoms()]
    positions = np.array([list(conf.GetAtomPosition(i)) for i in range(len(atoms))])

    atom_colors = {
        "H": [1.0, 1.0, 1.0],      # White
        "C": [0.2, 0.2, 0.2],      # Dark Gray
        "N": [0.0, 0.0, 1.0],      # Blue
        "O": [1.0, 0.0, 0.0],      # Red
        "F": [0.0, 1.0, 0.0],      # Green
        "Cl": [0.0, 1.0, 0.0],     # Green
        "Br": [0.6, 0.2, 0.2],     # Dark Red
        "I": [0.4, 0.0, 0.8],      # Purple
        "P": [1.0, 0.5, 0.0],      # Orange
        "S": [1.0, 1.0, 0.2],      # Yellow
        "B": [1.0, 0.7, 0.7],      # Light Pink
        "Si": [0.5, 0.5, 0.5],     # Gray
        "Fe": [1.0, 0.6, 0.2],     # Brownish
    }

    atom_meshes = []
    bond_meshes = []
    bond_radius = 0.04
    bond_offset = 0.09

    # ---- ATOMS ----
    for atom, pos in zip(atoms, positions):
        color = atom_colors.get(atom, [0.5, 0.5, 0.5])
        radius = 0.25 if atom != "H" else 0.15
        sphere = trimesh.creation.icosphere(subdivisions=3, radius=radius)
        sphere.apply_translation(pos)
        sphere.visual.vertex_colors = np.tile(np.array(color) * 255, (len(sphere.vertices), 1))
        atom_meshes.append(sphere)

    # ---- BONDS ----
    for bond in mol.GetBonds():
        i = bond.GetBeginAtomIdx()
        j = bond.GetEndAtomIdx()
        start = positions[i]
        end = positions[j]

        vec = end - start
        length = np.linalg.norm(vec)
        if length < 1e-6:
            continue

        direction = vec / length
        z_axis = np.array([0, 0, 1])

        # Compute rotation matrix from z-axis → bond vector
        axis = np.cross(z_axis, direction)
        if np.linalg.norm(axis) < 1e-6:
            rotation = np.eye(4)
        else:
            axis /= np.linalg.norm(axis)
            angle = np.arccos(np.dot(z_axis, direction))
            rotation = trimesh.transformations.rotation_matrix(angle, axis)

        # Determine number of cylinders per bond
        bond_order = bond.GetBondTypeAsDouble()
        if bond_order == 1:
            offsets = [0.0]
        elif bond_order == 2:
            offsets = [-bond_offset / 2, bond_offset / 2]
        elif bond_order == 3:
            offsets = [-bond_offset, 0.0, bond_offset]
        else:
            offsets = [0.0]

        # Pick an arbitrary perpendicular direction to offset
        perp_dir = np.cross(direction, [1, 0, 0])
        if np.linalg.norm(perp_dir) < 1e-3:
            perp_dir = np.cross(direction, [0, 1, 0])
        perp_dir /= np.linalg.norm(perp_dir)

        for offset in offsets:
            # Create cylinder along +Z (centered)
            cyl = trimesh.creation.cylinder(radius=bond_radius, height=length, sections=16)
            cyl.apply_translation([0, 0, length / 2])

            # Rotate to match bond direction
            cyl.apply_transform(rotation)

            # Offset for multiple bonds
            if offset != 0:
                cyl.apply_translation(perp_dir * offset)

            # Move to bond start
            cyl.apply_translation(start)

            # Set color (gray bonds)
            cyl.visual.vertex_colors = np.tile([180, 180, 180], (len(cyl.vertices), 1))
            bond_meshes.append(cyl)
    # for bond in mol.GetBonds():
    #     i = bond.GetBeginAtomIdx()
    #     j = bond.GetEndAtomIdx()
    #     start = positions[i]
    #     end = positions[j]

    #     # midpoint & vector
    #     mid = (start + end) / 2
    #     vec = end - start
    #     length = np.linalg.norm(vec)

    #     if length < 1e-6:
    #         continue  # skip invalid bond

    #     # Normalize bond direction
    #     direction = vec / length
    #     z_axis = np.array([0, 0, 1])

    #     # Create cylinder aligned along +Z but starting at origin
    #     cyl = trimesh.creation.cylinder(radius=0.04, height=length, sections=16)
    #     cyl.apply_translation([0, 0, length / 2])  # move base to start at (0,0,0)

    #     # Compute rotation from z-axis → bond vector
    #     axis = np.cross(z_axis, direction)
    #     if np.linalg.norm(axis) < 1e-6:
    #         rotation = np.eye(4)
    #     else:
    #         axis /= np.linalg.norm(axis)
    #         angle = np.arccos(np.dot(z_axis, direction))
    #         rotation = trimesh.transformations.rotation_matrix(angle, axis)

    #     # Rotate then translate to the start atom position
    #     cyl.apply_transform(rotation)
    #     cyl.apply_translation(start)

    #     cyl.visual.vertex_colors = np.tile([200, 200, 200], (len(cyl.vertices), 1))
    #     bond_meshes.append(cyl)

    # Combine all meshes
    combined = trimesh.util.concatenate(atom_meshes + bond_meshes)

    os.makedirs(output_dir, exist_ok=True)
    # Original filename, possibly containing illegal URL characters
    filename = f"{smiles}.glb"

    # Sanitize filename using regex: replace anything that's not alphanumeric, dot, or underscore
    safe_filename = re.sub(r"[^a-zA-Z0-9_.-]", "_", filename)

    output_path = os.path.join(output_dir, safe_filename)

    combined.export(output_path)
    print("Saving GLB at:", output_path)
    
    safe_key = re.sub(r"[^a-zA-Z0-9_.-]", "_", smiles)
    rel_path = output_path.replace(str(settings.MEDIA_ROOT), "").replace("\\", "/")
    set_cached_path(safe_key, f"/media{rel_path}")
    
    return output_path


# ----------------------------- Step 3: Dispatcher -----------------------------

def generate_from_plan(plan: dict) -> str:
    """
    Executes the molecule generation plan and ensures a valid .glb is produced.
    If the file already exists, reuse it. Otherwise, generate a new one safely.
    """
    kind = plan.get("kind", "general")
    params = plan.get("params", {})

    if kind == "molecule":
        if not _RDKit_AVAILABLE:
            raise RuntimeError("⚠️ RDKit is not installed in this environment.")

        smiles = params.get("smiles")
        if not smiles:
            raise ValueError("❌ No SMILES provided for molecule generation.")

        # Sanitize and name the GLB file
        safe_name = re.sub(r"[^a-zA-Z0-9_.-]", "_", smiles)
        models_dir = os.path.join(settings.MEDIA_ROOT, "models")
        os.makedirs(models_dir, exist_ok=True)
        glb_path = os.path.join(models_dir, f"{safe_name}.glb")

        # ✅ Reuse cached GLB if it already exists
        if os.path.exists(glb_path):
            print(f"✅ [ModelGenerator] Using cached model: {os.path.basename(glb_path)}")
            return glb_path

        # 🧬 Otherwise, generate new GLB
        try:
            print(f"🧪 [ModelGenerator] Generating 3D model for: {smiles}")
            return rdkit_to_glb(smiles, output_dir=models_dir)

        except Exception as e:
            print(f"❌ [ModelGenerator] Failed to generate {smiles}: {e}")
            raise

    elif kind in ("general", "procedural"):
        static_path = os.path.join(settings.STATIC_ROOT, "example.glb")
        if os.path.exists(static_path):
            return static_path
        return os.path.join(settings.BASE_DIR, "static", "example.glb")

    else:
        raise ValueError(f"Unknown plan kind: {kind}")


def clean_glb_path(path: str) -> str:
    """Normalize and fix GLB paths to avoid \\ or missing /models/ issues."""
    clean = path.replace("\\", "/").replace("//", "/")
    if not clean.startswith("/media/models/"):
        clean = "/media/models/" + os.path.basename(clean)
    return clean

# import tempfile
# import os
# import re
# import numpy as np
# import trimesh
# from rdkit import Chem
# from rdkit.Chem import AllChem
# from .vector_search import retrieve_with_reasoning
# from .llm_client import query_llm
# import shutil

# # ---------------------------- Helper: SMILES Extraction ----------------------------
# def extract_smiles_from_text(text: str) -> str:
#     match = re.search(r"([A-Za-z0-9@+\-\[\]\(\)=#$]{3,})", text)
#     return match.group(1) if match else ""


# # ---------------------------- Step 1: Parse Prompt ----------------------------
# def parse_prompt_to_plan(prompt: str):
#     """
#     Converts a user text prompt into a structured plan for molecule generation.
#     1️⃣ Uses RAG to retrieve reasoning + SMILES.
#     2️⃣ Falls back to LLM inference (Ollama) if RAG fails.
#     """
#     try:
#         result = retrieve_with_reasoning(prompt)
#     except Exception as e:
#         print(f"⚠️ RAG retrieval failed: {e}")
#         result = {}

#     print("\n==============================")
#     print("🧠 LLM Reasoning Output")
#     print("==============================")
#     print(result.get("reasoning", "⚠️ No reasoning available"))
#     print("==============================\n")

#     print("🧪 Extracted SMILES:", result.get("smiles", "❌ None found"))
#     smiles = result.get("smiles")

#     # 🧠 Fallback — Ask Ollama if RAG couldn't find molecule
#     if not smiles:
#         reasoning_prompt = (
#             f"You are a chemistry expert. Given the prompt '{prompt}', "
#             f"return the most likely SMILES string of the described molecule. "
#             f"Only output the SMILES, nothing else."
#         )
#         try:
#             llm_response = query_llm(reasoning_prompt)
#             smiles = extract_smiles_from_text(llm_response)
#             result["reasoning"] = result.get("reasoning", "") + "\n(Ollama inferred SMILES)"
#         except Exception as e:
#             print("❌ LLM fallback failed:", e)

#     if not smiles:
#         raise ValueError("❌ Could not interpret prompt as valid molecule or SMILES.")

#     return {
#         "kind": "molecule",
#         "params": {"smiles": smiles},
#         "reasoning": result.get("reasoning", "Inferred using RAG + LLM fallback")
#     }


# # ---------------------------- Step 2: RDKit → Trimesh Conversion ----------------------------
# def rdkit_to_glb(smiles: str):
#     """
#     Generate a 3D molecule model as GLB using RDKit (for structure) + Trimesh (for mesh).
#     """
#     print("\n==============================")
#     print("🧬 Generating Molecule 3D Model")
#     print("==============================")
#     print(f"SMILES: {smiles}")

#     mol = Chem.MolFromSmiles(smiles)
#     if mol is None:
#         raise ValueError("❌ RDKit failed to parse SMILES.")

#     mol = Chem.AddHs(mol)
#     AllChem.EmbedMolecule(mol, randomSeed=42)
#     conf = mol.GetConformer()

#     atoms = mol.GetAtoms()
#     atom_symbols = [a.GetSymbol() for a in atoms]
#     positions = np.array([list(conf.GetAtomPosition(a.GetIdx())) for a in atoms])

#     print("✅ RDKit parsed molecule successfully.")
#     print("🧪 Atoms detected:", atom_symbols)
#     print("\n📍 Atom 3D Coordinates:")
#     for i, (sym, pos) in enumerate(zip(atom_symbols, positions)):
#         print(f"  {sym} ({i}): x={pos[0]:.3f}, y={pos[1]:.3f}, z={pos[2]:.3f}")

#     # Represent each atom as a small sphere
#     spheres = []
#     for pos in positions:
#         sphere = trimesh.creation.icosphere(subdivisions=2, radius=0.3)
#         sphere.apply_translation(pos)
#         spheres.append(sphere)

#     # Merge all spheres into a single mesh scene
#     scene = trimesh.util.concatenate(spheres)

#     glb_path = tempfile.mktemp(suffix=".glb")
#     scene.export(glb_path)

#     # ✅ Move GLB to static folder for frontend access
#     static_dir = os.path.join("backend", "static", "generated_models")
#     os.makedirs(static_dir, exist_ok=True)
#     public_path = os.path.join(static_dir, os.path.basename(glb_path))
#     shutil.copy(glb_path, public_path)

#     print(f"\n✅ Exported molecule as GLB point cloud: {public_path}")
#     print("==============================\n")

#     # Return public-facing path (served by Django)
#     return f"/static/generated_models/{os.path.basename(public_path)}"
#     return glb_path


# # ---------------------------- Step 3: Generate from Plan ----------------------------
# def generate_from_plan(plan: dict) -> str:
#     kind = plan.get("kind", "general")
#     params = plan.get("params", {})

#     if kind == "molecule":
#         smiles = params.get("smiles")
#         if not smiles:
#             raise ValueError("❌ No SMILES provided.")
#         return rdkit_to_glb(smiles)

#     elif kind in ("general", "procedural"):
#         static = os.path.join("static", "example.glb")
#         return static if os.path.exists(static) else "/static/example.glb"

#     else:
#         raise ValueError("❌ Unknown generation plan kind.")




















# import tempfile
# import os
# import traceback
# import re
# from .vector_search import retrieve_with_reasoning
# from .llm_client import query_llm  # uses Ollama under the hood


# def extract_smiles_from_text(text: str) -> str:
#     """Extract a plausible SMILES string from free-form text."""
#     match = re.search(r"([A-Za-z0-9@+\-\[\]\(\)=#$]{3,})", text)
#     return match.group(1) if match else ""


# def parse_prompt_to_plan(prompt: str):
#     """
#     Converts a user text prompt into a structured plan for generation.
#     Uses RAG first, then falls back to Ollama to infer SMILES.
#     """
#     try:
#         result = retrieve_with_reasoning(prompt)
#     except Exception as e:
#         print(f"RAG retrieval failed: {e}")
#         result = {}

#     print("🧠 LLM reasoning:", result.get("reasoning", "no reasoning"))
#     print("🧪 Extracted SMILES:", result.get("smiles", "none"))

    
#     smiles = result.get("smiles")

#     # 🧠 Fallback — ask Ollama if RAG couldn't find molecule
#     if not smiles:
#         reasoning_prompt = (
#             f"You are a chemistry expert. Given the prompt '{prompt}', "
#             f"return the most likely SMILES string of the described molecule. "
#             f"Only output the SMILES, nothing else."
#         )
#         try:
#             llm_response = query_llm(reasoning_prompt)
#             smiles = extract_smiles_from_text(llm_response)
#             result["reasoning"] = result.get("reasoning", "") + "\n(Ollama inferred SMILES)"
#         except Exception as e:
#             print("LLM fallback failed:", e)

#     if not smiles:
#         raise ValueError("❌ Could not interpret prompt as valid molecule or SMILES.")

#     return {
#         "kind": "molecule",
#         "params": {"smiles": smiles},
#         "reasoning": result.get("reasoning", "Inferred using RAG + LLM fallback")
#     }


# # ---------------------------- RDKit Generation ----------------------------

# try:
#     from rdkit import Chem
#     from rdkit.Chem import AllChem
#     _RDKit_AVAILABLE = True
# except Exception:
#     _RDKit_AVAILABLE = False
#     print("RDKit not available; molecule generation will be limited.")


# # ---------------------------- 3D Conversion ----------------------------

# try:
#     import trimesh
#     import pymeshlab
# except Exception as e:
#     print("3D conversion libs missing:", e)


# def convert_pdb_to_glb(pdb_path: str) -> str:
#     """Convert a .pdb file into .glb using PyMeshLab + Trimesh, with detailed logging."""
#     try:
#         print(f"\n🧱 [convert_pdb_to_glb] Loading PDB: {pdb_path}")
#         ms = pymeshlab.MeshSet()
#         ms.load_new_mesh(pdb_path)
#         mesh = ms.current_mesh()

#         # Log mesh statistics
#         vertex_count = mesh.vertex_number()
#         face_count = mesh.face_number()
#         print(f"📊 PyMeshLab Mesh stats -> Vertices: {vertex_count}, Faces: {face_count}")

#         # File paths
#         obj_path = tempfile.mktemp(suffix=".obj")
#         glb_path = tempfile.mktemp(suffix=".glb")

#         # Validate mesh
#         if vertex_count == 0:
#             print("⚠️ No vertices found — molecule likely invalid or too simple for mesh conversion.")
#             print("Returning PDB path instead of crashing.")
#             return pdb_path  # gracefully skip instead of error

#         # Save .obj
#         ms.save_current_mesh(obj_path)
#         print(f"💾 Saved intermediate OBJ: {obj_path}")

#         # Load .obj and inspect
#         mesh_tri = trimesh.load(obj_path)
#         print("📦 Trimesh loaded mesh summary:")
#         print(mesh_tri)
#         print("Bounding box:", mesh_tri.bounds)

#         # Export .glb
#         mesh_tri.export(glb_path)
#         print(f"✅ Successfully exported GLB: {glb_path}")

#         return glb_path

#     except Exception as e:
#         print("❌ Error converting pdb to glb:", e)
#         traceback.print_exc()
#         return pdb_path  # fallback safely



# def generate_from_plan(plan: dict) -> str:
#     kind = plan.get("kind", "general")
#     params = plan.get("params", {})

#     if kind == "molecule" and _RDKit_AVAILABLE:
#         smiles = params.get("smiles") or params.get("name")
#         if not smiles:
#             raise ValueError("No SMILES or name provided for molecule.")

#         mol = Chem.MolFromSmiles(smiles)
#         if mol is None:
#             raise ValueError("RDKit failed to parse SMILES.")
#         print(f"✅ RDKit parsed molecule: {smiles}")
#         print("Atoms:", [atom.GetSymbol() for atom in mol.GetAtoms()])
#         mol = Chem.AddHs(mol)
#         AllChem.EmbedMolecule(mol, randomSeed=42)
#         print("🧩 3D coordinates embedded successfully.")
#         conf = mol.GetConformer()
#         print("\n🧩 3D Coordinates for:", smiles)
#         for atom in mol.GetAtoms():
#             pos = conf.GetAtomPosition(atom.GetIdx())
#             print(f"Atom {atom.GetSymbol()} ({atom.GetIdx()}): x={pos.x:.3f}, y={pos.y:.3f}, z={pos.z:.3f}")
#         pdb_path = tempfile.mktemp(suffix=".pdb")
#         Chem.MolToPDBFile(mol, pdb_path)
#         print(f"💾 Saved PDB to {pdb_path}")

#         glb_path = convert_pdb_to_glb(pdb_path)
#         return glb_path

#     elif kind in ("general", "procedural"):
#         static = os.path.join("static", "example.glb")
#         if os.path.exists(static):
#             return static
#         return "/static/example.glb"

#     else:
#         raise ValueError("Unknown plan kind.")
