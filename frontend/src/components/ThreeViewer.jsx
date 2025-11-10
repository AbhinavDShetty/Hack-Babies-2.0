import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export default function ThreeViewer({ modelPath, atomData = [] }) {
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

    // --- Environment Lighting ---
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(renderer)).texture;
    scene.environment = envTexture;

    // --- Lights ---
    const superAmbient = new THREE.AmbientLight(0xffffff, 2.8);
    scene.add(superAmbient);

    const baseDirections = [
      [5, 5, 5],
      [-5, 5, 5],
      [5, 5, -5],
      [-5, 5, -5],
      [0, -5, 0],
    ];
    baseDirections.forEach(([x, y, z]) => {
      const light = new THREE.DirectionalLight(0xffffff, 1.0);
      light.position.set(x, y, z);
      scene.add(light);
    });

    const topLight = new THREE.DirectionalLight(0xffffff, 1.3);
    topLight.position.set(0, 8, 0);
    scene.add(topLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 1.0);
    backLight.position.set(0, 3, -6);
    scene.add(backLight);

    const rimLightLeft = new THREE.DirectionalLight(0xffffff, 0.7);
    rimLightLeft.position.set(-6, 2, 2);
    scene.add(rimLightLeft);

    const rimLightRight = new THREE.DirectionalLight(0xffffff, 0.7);
    rimLightRight.position.set(6, 2, 2);
    scene.add(rimLightRight);

    // --- Controls ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 3;
    controls.maxDistance = 15;
    controls.target.set(0, 1, 0);
    controls.update();

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
            child.material.envMapIntensity = 1.4;
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

      if (!autoRotate && Date.now() - lastInteraction > 2000) {
        autoRotate = true;
      }

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

  // --- Legend Generation ---
  const uniqueElements = [
    ...new Map(atomData.map((a) => [a.symbol, a.color])).entries(),
  ];

  const getContrastColor = (rgbArray) => {
    const [r, g, b] = rgbArray.map((v) => v * 255);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 160 ? "#000" : "#fff";
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full rounded-2xl overflow-hidden border border-[rgba(255,255,255,0.12)] bg-transparent"
    >
      {/* 🧪 Atom Legend */}
      {uniqueElements.length > 0 && (
        <div className="absolute top-4 right-4 bg-[rgba(0,0,0,0.6)] text-white rounded-lg px-4 py-3 shadow-lg backdrop-blur-md z-20">
          <h3 className="text-sm font-semibold mb-2">Atoms</h3>
          <div className="flex flex-wrap gap-2">
            {uniqueElements.map(([symbol, colorArr]) => {
              const bgColor = `rgb(${colorArr
                .map((v) => Math.round(v * 255))
                .join(",")})`;
              const textColor = getContrastColor(colorArr);
              return (
                <div
                  key={symbol}
                  className="px-3 py-1 rounded-full text-xs font-semibold shadow-md border border-[rgba(255,255,255,0.2)]"
                  style={{
                    backgroundColor: bgColor,
                    color: textColor,
                    minWidth: "40px",
                    textAlign: "center",
                  }}
                >
                  {symbol}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
