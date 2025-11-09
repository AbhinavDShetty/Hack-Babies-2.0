import os
import re
import numpy as np
import trimesh
from rdkit import Chem
from rdkit.Chem import AllChem
from django.conf import settings
from .generator import parse_prompt_to_plan, generate_from_plan  # for regeneration
from .cache_index import get_cached_path, set_cached_path
from .agents import clean_glb_path


# ============================================================
# Helper 1: Extract Atoms and Bonds from a GLB file
# ============================================================

def extract_atoms_from_glb(glb_path):
    """
    Reads a .glb molecule model and returns a list of atoms (with positions and symbols).
    Automatically regenerates the GLB if missing or invalid.
    """
    # Normalize and clean path consistently
    clean_path = clean_glb_path(glb_path)

    # Compute absolute path under MEDIA_ROOT
    abs_path = os.path.join(settings.MEDIA_ROOT, clean_path.lstrip("/media/"))
    abs_path = os.path.normpath(abs_path)
    print(f"✅ [AutoFix] Rebuilt missing GLB: {abs_path}")
    print(f"✅ [AutoFix] Rebuilt missing GLB with clean_glb_path: {clean_glb_path(abs_path)}")

    # 🧩 If missing, try to regenerate GLB
    if not os.path.exists(abs_path):
        print(f"⚠️ [AutoFix] Missing GLB detected: {abs_path}")

        # Try to infer molecule name from filename
        molecule_name = os.path.splitext(os.path.basename(clean_path))[0]
        try:
            print(f"🧬 [AutoFix] Regenerating model for: {molecule_name}")
            plan = parse_prompt_to_plan(molecule_name)
            new_glb = generate_from_plan(plan)

            # Clean new path and relocate if necessary
            new_clean = clean_glb_path(new_glb)
            new_abs = os.path.join(settings.MEDIA_ROOT, new_clean.lstrip("/media/"))
            os.makedirs(os.path.dirname(new_abs), exist_ok=True)

            import shutil
            if os.path.exists(new_glb) and new_glb != new_abs:
                shutil.copy(new_glb, new_abs)

            print(f"✅ [AutoFix] Rebuilt missing GLB: {new_abs}")
            abs_path = new_abs
            print(f"✅ [AutoFix] Rebuilt missing GLB: {abs_path}")
            print(f"✅ [AutoFix] Rebuilt missing GLB with clean_glb_path: {clean_glb_path(abs_path)}")
        except Exception as regen_err:
            print(f"❌ [AutoFix] Failed to rebuild GLB for {molecule_name}: {regen_err}")
            raise FileNotFoundError(f"Could not regenerate missing GLB: {abs_path}")

    # 🧩 Try to load scene now
    try:
        scene = trimesh.load(abs_path)
    except Exception as e:
        print(f"⚠️ [AutoFix] Corrupted GLB: {abs_path} ({e})")
        molecule_name = os.path.splitext(os.path.basename(clean_path))[0]
        plan = parse_prompt_to_plan(molecule_name)
        new_glb = generate_from_plan(plan)
        abs_path = os.path.normpath(new_glb)
        print(f"✅ [AutoFix] Rebuilt missing GLB: {abs_path}")
        print(f"✅ [AutoFix] Rebuilt missing GLB with clean_glb_path: {clean_glb_path(abs_path)}")
        scene = trimesh.load(abs_path)

    atoms = []
    for name, geom in scene.geometry.items():
        if not geom.vertices.any():
            continue

        symbol = name.strip().split("_")[0][:2].title()
        position = np.mean(geom.vertices, axis=0).tolist()
        atoms.append({
            "name": name,
            "symbol": symbol,
            "position": position
        })

    return atoms


# ============================================================
# Helper 2: Map Reactant → Product Atoms
# ============================================================

def generate_atom_mapping(reactant_atoms, product_atoms):
    """
    Match atoms by element type and spatial proximity.
    """
    mapping = {}
    unmatched_products = list(range(len(product_atoms)))

    for i, r in enumerate(reactant_atoms):
        candidates = [j for j in unmatched_products if product_atoms[j]["symbol"] == r["symbol"]]
        if not candidates:
            continue
        rpos = np.array(r["position"])
        distances = [np.linalg.norm(rpos - np.array(product_atoms[j]["position"])) for j in candidates]
        best_j = candidates[int(np.argmin(distances))]
        mapping[i] = best_j
        unmatched_products.remove(best_j)

    return mapping


# ============================================================
# Helper 3: Interpolate Between Reactant & Product Atoms
# ============================================================

def interpolate_atom_positions(reactant_atoms, product_atoms, mapping, num_frames=60):
    """
    Generate smooth linear interpolation frames for atom morphing.
    """
    frames = []

    for t in np.linspace(0, 1, num_frames):
        frame = []
        for ri, pj in mapping.items():
            rpos = np.array(reactant_atoms[ri]["position"])
            ppos = np.array(product_atoms[pj]["position"])
            interp = (1 - t) * rpos + t * ppos
            frame.append({
                "symbol": reactant_atoms[ri]["symbol"],
                "position": interp.tolist()
            })
        frames.append(frame)

    return frames


# ============================================================
# Helper 4: Compute Bonds (simple proximity-based)
# ============================================================

def compute_bonds(atom_list, max_distance=1.8):
    """
    Generate approximate bonds based on interatomic distance.
    """
    bonds = []
    n = len(atom_list)
    positions = np.array([a["position"] for a in atom_list])

    for i in range(n):
        for j in range(i + 1, n):
            dist = np.linalg.norm(positions[i] - positions[j])
            if dist < max_distance:
                bonds.append((i, j))
    return bonds


# ============================================================
# MAIN: Build Reaction Animation
# ============================================================

def generate_reaction_animation(reactant_glbs, product_glbs):
    """
    Returns structured animation data:
    {
      'frames': [...],
      'atom_map': {...},
      'reactant_bonds': [...],
      'product_bonds': [...],
      'reactants': [...],
      'products': [...]
    }
    """

    reactant_atoms = []
    for r in reactant_glbs:
        reactant_atoms.extend(extract_atoms_from_glb(r))

    product_atoms = []
    for p in product_glbs:
        product_atoms.extend(extract_atoms_from_glb(p))

    # Build atom correspondence + frames
    atom_map = generate_atom_mapping(reactant_atoms, product_atoms)
    frames = interpolate_atom_positions(reactant_atoms, product_atoms, atom_map)

    # Approximate bonds for pre/post animation
    reactant_bonds = compute_bonds(reactant_atoms)
    product_bonds = compute_bonds(product_atoms)

    print(f"🧬 Generated {len(frames)} animation frames, {len(atom_map)} atom mappings.")
    print(f"🔗 Bonds: {len(reactant_bonds)} → {len(product_bonds)}")

    return {
        "frames": frames,
        "atom_map": atom_map,
        "reactant_bonds": reactant_bonds,
        "product_bonds": product_bonds,
        "reactants": [clean_glb_path(r) for r in reactant_glbs],
        "products": [clean_glb_path(p) for p in product_glbs],
    }


# ============================================================
# Optional: Ensure GLB Exists and Cached
# ============================================================

def ensure_glb(molecule_name: str):
    """
    Ensures a GLB model for the given molecule exists,
    using caching and clean path normalization.
    """
    key = re.sub(r"[^a-zA-Z0-9_.-]", "_", molecule_name)

    # 1) Check cache index
    cached = get_cached_path(key)
    if cached:
        cached_clean = clean_glb_path(cached)
        abs_path = os.path.join(settings.MEDIA_ROOT, cached_clean.lstrip("/media/"))
        print(f"✅ [AutoFix] Rebuilt missing GLB: {abs_path}")
        print(f"✅ [AutoFix] Rebuilt missing GLB with clean_glb_path: {clean_glb_path(abs_path)}")
        if os.path.exists(abs_path):
            print(f"✅ [ModelCache] Hit: {molecule_name} -> {cached_clean}")
            return cached_clean
        else:
            print(f"⚠️ [ModelCache] Stale entry, regenerating: {cached_clean}")

    # 2) Generate via RDKit pipeline
    plan = parse_prompt_to_plan(molecule_name)
    glb = generate_from_plan(plan)

    rel_clean = clean_glb_path(glb)
    abs_path = os.path.join(settings.MEDIA_ROOT, rel_clean.lstrip("/media/"))
    print(f"✅ [AutoFix] Rebuilt missing GLB: {abs_path}")
    print(f"✅ [AutoFix] Rebuilt missing GLB with clean_glb_path: {clean_glb_path(abs_path)}")
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)

    if os.path.exists(abs_path):
        set_cached_path(key, rel_clean)
        print(f"✅ [ModelCache] Cached: {molecule_name} -> {rel_clean}")
        return rel_clean

    # Fallback
    if os.path.exists(glb):
        rel_clean = clean_glb_path(glb)
        set_cached_path(key, rel_clean)
        return rel_clean

    print(f"❌ [ModelCache] Failed to generate GLB for {molecule_name}")
    return None
