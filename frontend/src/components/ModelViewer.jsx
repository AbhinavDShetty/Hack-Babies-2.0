import "@google/model-viewer";

export default function ModelViewer({ modelUrl }) {
  if (!modelUrl) return <p>No model generated yet.</p>;

  return (
    <div className="viewer-container">
      <model-viewer
        src={modelUrl}
        alt="Generated Molecule 3D Model"
        auto-rotate
        camera-controls
        ar
        style={{ width: "100%", height: "500px" }}
      />
    </div>
  );
}
