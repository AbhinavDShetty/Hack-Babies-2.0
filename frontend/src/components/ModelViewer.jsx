import React from "react";
import "@google/model-viewer/dist/model-viewer.min.js";

export default function ModelViewer({ src }) {
    return (
        <div className="w-full h-full rounded-2xl overflow-hidden border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] backdrop-blur-md shadow-[0_0_30px_rgba(99,102,241,0.2)]">
            <model-viewer
                src={src}
                alt="3D Molecule"
                auto-rotate
                camera-controls
                shadow-intensity="1"
                className="w-full h-full rounded-2xl"
            />
        </div>
    );
}
