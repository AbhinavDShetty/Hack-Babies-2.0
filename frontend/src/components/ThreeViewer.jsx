import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export default function ThreeViewer({ modelPath, atomData = [] }) {
  const containerRef = useRef();
  const rendererRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !modelPath) return;

    let stopped = false;
    const container = containerRef.current;

    const initialize = () => {
      if (!container || container.clientWidth === 0) {
        requestAnimationFrame(initialize);
        return;
      }

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(window.devicePixelRatio);
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      const scene = new THREE.Scene();
      scene.background = null;

      const camera = new THREE.PerspectiveCamera(
        60,
        container.clientWidth / container.clientHeight,
        0.1,
        1000
      );
      camera.position.set(2, 1, 8);

      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(renderer)).texture;

      scene.add(new THREE.AmbientLight(0xffffff, 2.8));

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.enablePan = false;
      controls.minDistance = 3;
      controls.maxDistance = 15;
      controls.target.set(0, 1, 0);
      controls.update();

      const loader = new GLTFLoader();
      let model = null;

      loader.load(
        modelPath,
        (gltf) => {
          model = gltf.scene;
          model.traverse((c) => {
            if (c.isMesh) c.material.envMapIntensity = 1.4;
          });
          scene.add(model);
        },
        undefined,
        (e) => console.error("Model load error:", e)
      );

      const resizeObserver = new ResizeObserver(() => {
        if (!renderer || !camera) return;
        const { clientWidth, clientHeight } = container;
        camera.aspect = clientWidth / clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(clientWidth, clientHeight);
      });
      resizeObserver.observe(container);

      let userInteracting = false;
      let inactivityTimeout = null;

      const resetInactivity = () => {
        clearTimeout(inactivityTimeout);
        userInteracting = true;
        inactivityTimeout = setTimeout(() => {
          userInteracting = false;
        }, 2000);
      };

      // Add cursor feedback
      container.style.cursor = "grab";

      const handlePointerDown = () => {
        container.style.cursor = "grabbing";
        resetInactivity();
      };
      const handlePointerUp = () => {
        container.style.cursor = "grab";
        resetInactivity();
      };
      const handleWheel = () => resetInactivity();
      const handlePointerMove = () => {
        if (userInteracting) resetInactivity();
      };

      container.addEventListener("pointerdown", handlePointerDown);
      container.addEventListener("pointerup", handlePointerUp);
      container.addEventListener("pointermove", handlePointerMove);
      container.addEventListener("wheel", handleWheel);
      // === 🧭 Additions End Here ===

      const clock = new THREE.Clock();
      const animate = () => {
        if (stopped) return;
        requestAnimationFrame(animate);
        if (model && !userInteracting) {
          model.rotation.y += 0.0025;
          model.position.y = Math.sin(clock.getElapsedTime() * 0.5) * 0.03;
        }
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      return () => {
        stopped = true;
        resizeObserver.disconnect();
        renderer.dispose();
        if (container.contains(renderer.domElement))
          container.removeChild(renderer.domElement);

        // cleanup new event listeners
        container.removeEventListener("pointerdown", handlePointerDown);
        container.removeEventListener("pointerup", handlePointerUp);
        container.removeEventListener("pointermove", handlePointerMove);
        container.removeEventListener("wheel", handleWheel);
        clearTimeout(inactivityTimeout);
      };
    };

    initialize();

    return () => {
      stopped = true;
      const r = rendererRef.current;
      if (r) {
        r.dispose();
        if (container.contains(r.domElement))
          container.removeChild(r.domElement);
      }
    };
  }, [modelPath]);

  const uniqueElements = [
    ...new Map(atomData.map((a) => [a.symbol, a.color])).entries(),
  ];

  const getContrastColor = (rgb) => {
    const [r, g, b] = rgb.map((v) => v * 255);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 160 ? "#000" : "#fff";
  };

  return (
    <div
      ref={containerRef}
      className="bottom-20 w-full h-full rounded-l-2xl overflow-hidden border border-[rgba(255,255,255,0.12)]"
    >
      {uniqueElements.length > 0 && (
        <div className="absolute top-4 right-4 bg-[rgba(0,0,0,0.6)] text-white rounded-lg px-4 py-3 shadow-lg backdrop-blur-md z-20">
          <h3 className="text-sm font-semibold mb-2">Atoms</h3>
          <div className="flex flex-wrap gap-2">
            {uniqueElements.map(([symbol, colorArr]) => {
              const bg = `rgb(${colorArr.map((v) => Math.round(v * 255)).join(",")})`;
              const textColor = getContrastColor(colorArr);
              return (
                <div
                  key={symbol}
                  className="px-3 py-1 rounded-full text-xs font-semibold shadow-md border border-[rgba(255,255,255,0.2)]"
                  style={{ backgroundColor: bg, color: textColor }}
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
