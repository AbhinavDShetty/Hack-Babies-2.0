# backend/chemistry/reaction_animator.py

import os
import numpy as np
import json
import trimesh
from rdkit import Chem
from rdkit.Chem import AllChem
from django.conf import settings


# --------------------------------------------
# Helper 1: Load atom coordinates from a .glb
# --------------------------------------------

def extract_atoms_from_glb(glb_path):
    """
    Reads a .glb molecule model and returns a list of atoms (with positions and symbols).
    Assumes each atom mesh is named like 'C1', 'H2', etc.
    """
    path = os.path.join(settings.MEDIA_ROOT, glb_path.lstrip("/media/"))
    scene = trimesh.load(path)
    atoms = []

    for name, geom in scene.geometry.items():
        if not geom.vertices.any():
            continue

        # Try to infer element symbol (default 'X')
        symbol = name.strip().split("_")[0][:2].title()
        position = np.mean(geom.vertices, axis=0).tolist()

        atoms.append({
            "name": name,
            "symbol": symbol,
            "position": position
        })

    return atoms


# --------------------------------------------
# Helper 2: Create a simple atom mapping
# --------------------------------------------

def generate_atom_mapping(reactant_atoms, product_atoms):
    """
    Creates a minimal atom mapping between reactants and products by element symbol.
    Tries to pair atoms of same element in order of distance.
    """
    mapping = {}
    unmatched_products = list(range(len(product_atoms)))

    for i, ra in enumerate(reactant_atoms):
        same_elem_idx = [j for j in unmatched_products if product_atoms[j]["symbol"] == ra["symbol"]]
        if not same_elem_idx:
            continue

        # pick closest atom in space
        ra_pos = np.array(ra["position"])
        distances = [np.linalg.norm(ra_pos - np.array(product_atoms[j]["position"])) for j in same_elem_idx]
        j_best = same_elem_idx[np.argmin(distances)]
        mapping[f"{ra['symbol']}{i}"] = f"{product_atoms[j_best]['symbol']}{j_best}"
        unmatched_products.remove(j_best)

    return mapping


# --------------------------------------------
# Helper 3: Generate interpolation frames
# --------------------------------------------

def interpolate_frames(reactant_atoms, product_atoms, atom_map, num_frames=30):
    """
    Returns a list of animation frames interpolating atom positions.
    Each frame contains {atom_name: [x,y,z]}.
    """
    frames = []

    for t in np.linspace(0, 1, num_frames):
        frame = {}
        for r_name, p_name in atom_map.items():
            r_atom = next(a for a in reactant_atoms if f"{a['symbol']}" in r_name)
            p_atom = next(a for a in product_atoms if f"{a['symbol']}" in p_name)
            r_pos = np.array(r_atom["position"])
            p_pos = np.array(p_atom["position"])
            interp = (1 - t) * r_pos + t * p_pos
            frame[r_name] = interp.tolist()
        frames.append(frame)

    return frames


# --------------------------------------------
# Main function: create full reaction animation
# --------------------------------------------

def generate_reaction_animation(reactant_glbs, product_glbs):
    """
    Creates a dictionary with:
    {
      'atom_map': {...},
      'frames': [...],
      'reactants': [...],
      'products': [...]
    }
    """

    # Load all atoms from GLBs
    reactant_atoms = []
    for r in reactant_glbs:
        reactant_atoms += extract_atoms_from_glb(r)

    product_atoms = []
    for p in product_glbs:
        product_atoms += extract_atoms_from_glb(p)

    # Compute mapping & frames
    atom_map = generate_atom_mapping(reactant_atoms, product_atoms)
    frames = interpolate_frames(reactant_atoms, product_atoms, atom_map)

    # Package result
    animation = {
        "atom_map": atom_map,
        "frames": frames,
        "reactants": reactant_glbs,
        "products": product_glbs
    }

    return animation
