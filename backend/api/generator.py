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

def extract_smiles_from_text(text: str) -> str:
    """Extracts a plausible SMILES string from text."""
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
            llm_prompt = f"You are a chemistry assistant. Given: {prompt}\nReturn a single SMILES string only."
            resp = query_llm(llm_prompt, timeout=180, retries=1)
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
    print(smiles)
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
        "H": [1.0, 1.0, 1.0],
        "C": [0.4, 0.4, 0.4],
        "N": [0.0, 0.0, 1.0],
        "O": [1.0, 0.0, 0.0],
        "F": [0.0, 1.0, 0.0],
        "Cl": [0.0, 1.0, 0.0],
        "Br": [0.6, 0.2, 0.2],
        "I": [0.4, 0.0, 0.8],
        "P": [1.0, 0.5, 0.0],
        "S": [1.0, 1.0, 0.2],
        "B": [1.0, 0.7, 0.7],
        "Si": [0.5, 0.5, 0.5],
        "Fe": [1.0, 0.6, 0.2],
    }

    atom_meshes = []
    bond_meshes = []
    atom_data = []   # 🧬 Store atom info
    bond_data = []   # 🔗 Store bond info
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

        # 🧾 Save metadata
        atom_data.append({
            "symbol": atom,
            "position": [float(p) for p in pos],
            "radius": float(radius),
            "color": [float(c) for c in color]
        })

    # ---- BONDS ----
    for bond in mol.GetBonds():
        i = bond.GetBeginAtomIdx()
        j = bond.GetEndAtomIdx()
        start = positions[i]
        end = positions[j]
        bond_order = bond.GetBondTypeAsDouble()

        vec = end - start
        length = np.linalg.norm(vec)
        if length < 1e-6:
            continue

        direction = vec / length
        z_axis = np.array([0, 0, 1])
        axis = np.cross(z_axis, direction)
        if np.linalg.norm(axis) < 1e-6:
            rotation = np.eye(4)
        else:
            axis /= np.linalg.norm(axis)
            angle = np.arccos(np.dot(z_axis, direction))
            rotation = trimesh.transformations.rotation_matrix(angle, axis)

        # multiple bonds
        if bond_order == 1:
            offsets = [0.0]
        elif bond_order == 2:
            offsets = [-bond_offset / 2, bond_offset / 2]
        elif bond_order == 3:
            offsets = [-bond_offset, 0.0, bond_offset]
        else:
            offsets = [0.0]

        perp_dir = np.cross(direction, [1, 0, 0])
        if np.linalg.norm(perp_dir) < 1e-3:
            perp_dir = np.cross(direction, [0, 1, 0])
        perp_dir /= np.linalg.norm(perp_dir)

        for offset in offsets:
            cyl = trimesh.creation.cylinder(radius=bond_radius, height=length, sections=16)
            cyl.apply_translation([0, 0, length / 2])
            cyl.apply_transform(rotation)
            if offset != 0:
                cyl.apply_translation(perp_dir * offset)
            cyl.apply_translation(start)
            cyl.visual.vertex_colors = np.tile([180, 180, 180], (len(cyl.vertices), 1))
            bond_meshes.append(cyl)

        # 🔗 Save bond metadata
        bond_data.append({
            "start": [float(v) for v in start],
            "end": [float(v) for v in end],
            "order": int(bond_order),
            "length": float(length)
        })

    # ---- Combine and Export ----
    combined = trimesh.util.concatenate(atom_meshes + bond_meshes)

    os.makedirs(output_dir, exist_ok=True)
    filename = f"{smiles}.glb"
    safe_filename = re.sub(r"[^a-zA-Z0-9_.-]", "_", filename)
    output_path = os.path.join(output_dir, safe_filename)

    combined.export(output_path)
    print("Saving GLB at:", output_path)

    # 🧾 Return both GLB path and JSON data
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

