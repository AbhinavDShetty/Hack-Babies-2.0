import os
import re
import numpy as np
import trimesh
from django.conf import settings
from .vector_search import retrieve_with_reasoning, fetch_molecule_from_pubchem
from .llm_client import query_llm
import os
import numpy as np
import trimesh

# Try to import RDKit
try:
    from rdkit import Chem
    from rdkit.Chem import AllChem
    _RDKit_AVAILABLE = True
except Exception:
    _RDKit_AVAILABLE = False
    print("⚠️ RDKit not available; molecule generation limited.")


# ----------------------------- Utility -----------------------------

import re
import json

def extract_smiles_from_text(text: str) -> str:
    """
    Extracts a SMILES string from an LLM JSON response like:
    { "smiles": "Cc1ccccc1" }
    Falls back to regex extraction if the JSON is malformed.
    """

    # Try parsing JSON response
    try:
        smiles = text.get("smiles", "").strip()

        # Validate SMILES using your original pattern
        if re.fullmatch(r"[A-Za-z0-9@+\-\[\]\(\)=#$]{2,}", smiles):
            return smiles
    except Exception:
        pass  # Fall back to regex if JSON parsing fails

    # Fallback: extract any valid SMILES-like substring from raw text
    match = re.search(r"([A-Za-z0-9@+\-\[\]\(\)=#$]{2,})", text)
    return match.group(1) if match else ""



# ----------------------------- Step 1: Interpret Prompt -----------------------------

# in generator.py (imports)

def parse_prompt_to_plan(prompt: str, chat_history: str = "") -> dict:
    result = {}
    try:
        result = retrieve_with_reasoning(prompt, chat_history) or {}
    except Exception as e:
        print("RAG failed:", e)

    smiles = result.get("smiles")
    reasoning = result.get("reasoning", "")
    response = result.get("response", "")
    title = result.get("title", "")

    if not smiles:
        # ask LLM
        try:
            llm_prompt = """You are a chemistry assistant. Given: {prompt}\nReturn a single SMILES in json as {{"smiles": "Cc1ccccc1"}} only."""
            resp = query_llm(llm_prompt, timeout=180, retries=1, model_name="gpt-oss:120b-cloud")
            smiles = extract_smiles_from_text(resp or "")
            reasoning += "\n(LLM inferred SMILES)"
            title += resp.title or ""
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

    return {"kind":"molecule","params":{"smiles":smiles},"reasoning":reasoning, "response": response, "title": title}



# ----------------------------- Step 2: Generate Molecule + GLB -----------------------------


def rdkit_to_glb(smiles, output_dir=None):
    print("SMILES:", smiles)

    # ------------------------------------------
    # 1. Output directory setup
    # ------------------------------------------
    if output_dir is None:
        output_dir = os.path.join(settings.MEDIA_ROOT, "models")
    os.makedirs(output_dir, exist_ok=True)

    # ------------------------------------------
    # 2. RDKit: Load + sanitize molecule
    # ------------------------------------------
    try:
        mol = Chem.MolFromSmiles(smiles, sanitize=True)
        Chem.SanitizeMol(mol, Chem.SanitizeFlags.SANITIZE_ALL ^ Chem.SanitizeFlags.SANITIZE_KEKULIZE)
        if mol is None:
            raise ValueError("Invalid SMILES")
    except Exception:
        # attempt fix
        mol = Chem.MolFromSmiles(smiles, sanitize=False)
        Chem.SanitizeMol(mol)

    # add hydrogens (important for proper 3D geometry)
    mol = Chem.AddHs(mol)

    # ------------------------------------------
    # 3. 3D embedding with ETKDGv3 + optimization
    # ------------------------------------------
    params = AllChem.ETKDGv3()
    params.randomSeed = 42
    params.useSmallRingTorsions = True
    params.useRandomCoords = True

    AllChem.EmbedMolecule(mol, params)

    # optimize geometry (MMFF → fallback UFF)
    try:
        AllChem.MMFFOptimizeMolecule(mol)
    except:
        AllChem.UFFOptimizeMolecule(mol)

    conf = mol.GetConformer()

    # ------------------------------------------
    # 4. Extract atoms + coordinates
    # ------------------------------------------
    atom_symbols = [atom.GetSymbol() for atom in mol.GetAtoms()]
    positions = np.array([
        list(conf.GetAtomPosition(i))
        for i in range(len(atom_symbols))
    ])

    # ------------------------------------------
    # 5. Correct CPK/Jmol atom colors (visual standard)
    # ------------------------------------------
    cpk_colors = {
        "H":  [1.00, 1.00, 1.00],   # white
        "C":  [0.20, 0.20, 0.20],   # dark gray
        "N":  [0.10, 0.10, 1.00],   # blue
        "O":  [1.00, 0.05, 0.00],   # red
        "F":  [0.00, 0.90, 0.00],   # bright green
        "Cl": [0.00, 0.80, 0.00],
        "Br": [0.65, 0.16, 0.16],   # dark red
        "I":  [0.45, 0.00, 0.75],   # deep violet
        "P":  [1.00, 0.50, 0.00],   # orange
        "S":  [1.00, 0.90, 0.00],   # yellow
        "Si": [0.40, 0.40, 0.40],
        "B":  [1.00, 0.70, 0.70],
        "Fe": [0.90, 0.50, 0.20],
    }

    # ------------------------------------------
    # 6. Visual radii: good for 3D rendering
    # ------------------------------------------
    visual_radii = {
        "H": 0.25,
        "C": 0.40,
        "N": 0.38,
        "O": 0.36,
        "F": 0.35,
        "Cl": 0.45,
        "Br": 0.50,
        "I": 0.55,
        "P": 0.50,
        "S": 0.48,
    }

    atom_meshes = []
    atom_data = []

    # ------------------------------------------
    # 7. Build 3D atom spheres
    # ------------------------------------------
    for symbol, pos in zip(atom_symbols, positions):
        color = cpk_colors.get(symbol, [0.6, 0.6, 0.6])
        radius = visual_radii.get(symbol, 0.40)

        sphere = trimesh.creation.icosphere(subdivisions=4, radius=radius)
        sphere.apply_translation(pos)

        # GLTF standard requires RGBA float colors (0–1)
        rgba = np.array([*color, 1.0])
        sphere.visual.vertex_colors = np.tile(rgba, (len(sphere.vertices), 1))

        atom_meshes.append(sphere)

        atom_data.append({
            "symbol": symbol,
            "position": [float(x) for x in pos],
            "radius": radius,
            "color": color
        })

    # ------------------------------------------
    # 8. Build bond cylinders
    # ------------------------------------------
    bond_meshes = []
    bond_data = []

    base_bond_radius = 0.10
    bond_offset = 0.12

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

        # orientation rotation
        z_axis = np.array([0, 0, 1])
        axis = np.cross(z_axis, direction)

        if np.linalg.norm(axis) < 1e-6:
            rotation = np.eye(4)
        else:
            axis /= np.linalg.norm(axis)
            angle = np.arccos(np.dot(z_axis, direction))
            rotation = trimesh.transformations.rotation_matrix(angle, axis)

        # detect order
        order = bond.GetBondTypeAsDouble()
        if bond.GetIsAromatic():
            order = 1.5

        # determine offsets for double/triple bonds
        if order == 1:
            offsets = [0.0]
        elif order == 2:
            offsets = [-bond_offset / 2, bond_offset / 2]
        elif order == 3:
            offsets = [-bond_offset, 0.0, bond_offset]
        elif order == 1.5:
            offsets = [0.0]
        else:
            offsets = [0.0]

        perp = np.cross(direction, [1, 0, 0])
        if np.linalg.norm(perp) < 1e-3:
            perp = np.cross(direction, [0, 1, 0])
        perp /= np.linalg.norm(perp)

        for offset in offsets:
            cyl = trimesh.creation.cylinder(radius=base_bond_radius, height=length)
            cyl.apply_translation([0, 0, length / 2])
            cyl.apply_transform(rotation)

            if offset != 0:
                cyl.apply_translation(perp * offset)

            cyl.apply_translation(start)

            # GLTF compatible RGBA (gray)
            rgba = np.array([0.7, 0.7, 0.7, 1.0])
            cyl.visual.vertex_colors = np.tile(rgba, (len(cyl.vertices), 1))

            bond_meshes.append(cyl)

        bond_data.append({
            "start": start.tolist(),
            "end": end.tolist(),
            "order": order,
            "length": float(length),
            "aromatic": bond.GetIsAromatic()
        })

    # ------------------------------------------
    # 9. Combine and export GLB
    # ------------------------------------------
    combined = trimesh.util.concatenate(atom_meshes + bond_meshes)

    safe_filename = re.sub(r"[^a-zA-Z0-9_.-]", "_", f"{smiles}.glb")
    output_path = os.path.join(output_dir, safe_filename)

    combined.export(output_path)
    print("Saved GLB at:", output_path)

    # ------------------------------------------
    # 10. Return metadata
    # ------------------------------------------
    return {
        "glb_path": output_path,
        "atoms": atom_data,
        "bonds": bond_data
    }


# ----------------------------- Step 3: Dispatcher -----------------------------

def generate_from_plan(plan: dict) -> str:
    """Executes the generation plan and returns GLB file path."""
    kind = plan.get("kind", "general")
    params = plan.get("params", {})

    if kind == "molecule":
        if not _RDKit_AVAILABLE:
            raise RuntimeError("RDKit is not installed in this environment.")
        
        smiles = params.get("smiles")
        if not smiles:
            raise ValueError("No SMILES provided for molecule generation.")
        
        return rdkit_to_glb(smiles)

    elif kind in ("general", "procedural"):
        static_path = os.path.join(settings.STATIC_ROOT, "example.glb")
        return {
            "glb_path": static_path if os.path.exists(static_path)
                        else os.path.join(settings.BASE_DIR, "static", "example.glb"),
            "atoms": [],
            "bonds": []
        }

    else:
        raise ValueError(f"Unknown plan kind: {kind}")

