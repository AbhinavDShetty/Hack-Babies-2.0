"""
Mock Retriever for RAG.
Replace with a real retriever (FAISS/Chroma/LangChain) later.
"""

class Retriever:
    def __init__(self):
        # In production, initialize vector DB client here
        pass

    def retrieve(self, query: str, k: int = 5):
        """
        Return a list of text passages relevant to the query.
        For demo we return static chemistry snippets.
        """
        # Simple heuristics: return different data if water related
        q = (query or "").lower()
        snippets = [
            "ChemBlender: helper functions to import molecules and generate ball-and-stick models.",
            "Bond length reference: typical H-H bond ~0.74 Å, O-H ~0.96 Å.",
            "Molecular geometry: H2O has approximately 104.5° bond angle.",
            "Use bpy.ops.export_scene.gltf(filepath=...) to export GLB from Blender.",
            "RDKit can be used to validate molecule valences programmatically."
        ]
        if "water" in q or "h2o" in q:
            snippets.insert(0, "H2O: 2 hydrogens, 1 oxygen; angle ~104.5 degrees; common representation: ball-and-stick.")
        return snippets[:k]
