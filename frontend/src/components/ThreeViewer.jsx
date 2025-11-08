import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export default function ThreeViewer({ modelPath }) {
  const containerRef = useRef();

  useEffect(() => {
    if (!containerRef.current || !modelPath) return;

    let model = null;
    let autoRotate = true;
    let lastInteraction = Date.now();

    // --- Renderer ---
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setClearColor(0x0f172a);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = false;
    containerRef.current.appendChild(renderer.domElement);

    // --- Scene & Camera ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);

    const camera = new THREE.PerspectiveCamera(
      45,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 2, 6);

    // --- Ultra-balanced Environment Lighting (no dark spots) ---
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(renderer)).texture;
    scene.environment = envTexture;

    // Add a strong ambient light that fills all sides evenly
    const superAmbient = new THREE.AmbientLight(0xffffff, 2.5);
    scene.add(superAmbient);

    // Add several directional fill lights from all directions
    const directions = [
      [5, 5, 5],
      [-5, 5, 5],
      [5, 5, -5],
      [-5, 5, -5],
      [0, -5, 0], // from below to eliminate dark bottoms
    ];
    directions.forEach(([x, y, z]) => {
      const light = new THREE.DirectionalLight(0xffffff, 0.8);
      light.position.set(x, y, z);
      scene.add(light);
    });

    // --- Controls ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 3;
    controls.maxDistance = 15;
    controls.target.set(0, 1, 0);
    controls.update();

    // --- Cursor Interaction ---
    const canvas = renderer.domElement;
    canvas.style.cursor = "grab";
    controls.addEventListener("start", () => {
      canvas.style.cursor = "grabbing";
      autoRotate = false;
      lastInteraction = Date.now();
    });
    controls.addEventListener("end", () => {
      canvas.style.cursor = "grab";
      lastInteraction = Date.now();
    });

    // --- GLTF Loader ---
    const loader = new GLTFLoader();
    loader.load(
      modelPath,
      (gltf) => {
        model = gltf.scene;
        model.traverse((child) => {
          if (child.isMesh) {
            child.material.envMapIntensity = 1.3;
            child.material.needsUpdate = true;
          }
        });
        model.position.set(0, 0, 0);
        scene.add(model);
      },
      (xhr) => console.log(`Loading: ${(xhr.loaded / xhr.total) * 100}%`),
      (error) => console.error("Error loading model:", error)
    );

    // --- Resize Handling ---
    const handleResize = () => {
      const { clientWidth, clientHeight } = containerRef.current;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight);
    };
    window.addEventListener("resize", handleResize);

    // --- Animation Loop ---
    const clock = new THREE.Clock();
    const animate = () => {
      requestAnimationFrame(animate);

      const elapsed = clock.getElapsedTime();

      // resume rotation after 2s idle
      if (!autoRotate && Date.now() - lastInteraction > 2000) {
        autoRotate = true;
      }

      // Subtle rotation + floating if autoRotate is true
      if (model && autoRotate) {
        model.rotation.y += 0.0025;
        model.position.y = Math.sin(elapsed * 0.5) * 0.03;
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // --- Cleanup ---
    return () => {
      window.removeEventListener("resize", handleResize);
      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [modelPath]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-2xl overflow-hidden border border-[rgba(255,255,255,0.12)] 
                 bg-[rgba(255,255,255,0.05)] backdrop-blur-md 
                 shadow-[0_0_30px_rgba(99,102,241,0.2)]"
    />
  );
}
