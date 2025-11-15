// src/theme.js
const theme = {
  // Hero background gradient (top -> bottom)
  heroBgTop: "#111111ff",
  heroBgBottom: "#1a1a1aff",

  // Text
  textMain: "#FFFFFF",
  textSub: "#A9ABB8",

  // Brand / button gradient
  brandFrom: "#6b63ff",
  brandTo: "#9b7bff",

  // 3D / DNA settings (tweak these until the model looks perfect)
  dna: {
    // start smaller; you can tweak to fit your FBX
    scale: 0.10,
    // x, y, z — moves model right, up/down, forward/back
    offset: [3.4, -0.35, -1.6],
    // small tilt so helix faces viewer nicely
    rotation: [0.08, Math.PI / 1.85, 0],
    // camera position for the Canvas (optional reference)
    camera: { position: [0, 2.4, 8.5], fov: 40 }
  },

  // visual helpers
  vignette: "linear-gradient(to left, rgba(77, 77, 77, 0.36), transparent)"
};

export default theme;
