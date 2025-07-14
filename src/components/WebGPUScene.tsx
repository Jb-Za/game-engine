import React, { useEffect, useRef, useState } from "react";
import { SceneInfo } from "../scenes/sceneList";
import { checkWebGPUSupport } from "../utils/WebGPUCheck";
import "./WebGPUScene.css";
import GLTFControls from "./GLTFControls";

interface WebGPUSceneProps {
  scene: SceneInfo;
  onBack: () => void;
}

const WebGPUScene: React.FC<WebGPUSceneProps> = ({ scene, onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null!);
  const infoRef = useRef<HTMLPreElement>(null!);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [webgpuReady, setWebgpuReady] = useState(false);
  const deviceRef = useRef<GPUDevice | null>(null);
  const gpuContextRef = useRef<GPUCanvasContext | null>(null);
  const presentationFormatRef = useRef<GPUTextureFormat | null>(null);

  // Store GLTF options if needed
  const [gltfOptions, setGLTFOptions] = useState<any>(null);

  // Track the current scene module for disposal
  const sceneModuleRef = useRef<any>(null);
  // Preload all scene modules for dynamic imports
  const sceneModules = import.meta.glob<any>('../scenes/**/*.ts');

  useEffect(() => {
    let isActive = true;
    const loadInitialScene = async () => {
      if (canvasRef.current && infoRef.current) {
        try {
          setError(null);
          setIsLoading(true);
          await checkWebGPUSupport();
          const canvas = canvasRef.current;
          const gpuContext = canvas.getContext("webgpu") as GPUCanvasContext;
          const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
          if (!gpuContext) {
            throw new Error("WebGPU not supported");
          }
          const adapter = await navigator.gpu.requestAdapter();
          if (!adapter) {
            throw new Error("No appropriate GPUAdapter found");
          }
          const device = await adapter.requestDevice();
          gpuContext.configure({
            device: device,
            format: presentationFormat,
          });
          deviceRef.current = device;
          gpuContextRef.current = gpuContext;
          presentationFormatRef.current = presentationFormat;
          setWebgpuReady(true);
        } catch (error) {
          console.error('Failed to initialize scene:', error);
          if (isActive) {
            setError(error instanceof Error ? error.message : 'Failed to load scene');
          }
        } finally {
          if (isActive) {
            setIsLoading(false);
          }
        }
      }
    };
    loadInitialScene();
    return () => {
      isActive = false;
      setWebgpuReady(false);
    };
  }, [scene.name]);

  // Scene module init for all scenes
  useEffect(() => {
    if (!canvasRef.current || !infoRef.current) return;
    if (!webgpuReady) return;
    let disposed = false;
    async function loadScene() {
      setIsLoading(true);
      try {
        if (!deviceRef.current || !gpuContextRef.current || !presentationFormatRef.current) {
          return;
        }
        
        // Convert importPath to match the format used by import.meta.glob
        // Remove leading '../' to match the relative path from src directory
        const normalizedPath = scene.importPath.replace(/^\.\.\//, '');
        
        // Find the matching module in our preloaded scene modules
        const moduleKey = Object.keys(sceneModules).find(key => 
          key.endsWith(normalizedPath.replace('.js', '.ts'))
        );
        
        if (!moduleKey) {
          console.error(`Could not find module for path: ${scene.importPath}`);
          return;
        }
        
        // Load the module
        const SceneModule = await sceneModules[moduleKey]();
        sceneModuleRef.current = SceneModule;
        if (scene.components.includes('animationMenu') && gltfOptions) {
          await SceneModule.init(
            canvasRef.current,
            deviceRef.current,
            gpuContextRef.current,
            presentationFormatRef.current,
            infoRef.current,
            gltfOptions
          );
        } else {
          await SceneModule.init(
            canvasRef.current,
            deviceRef.current,
            gpuContextRef.current,
            presentationFormatRef.current,
            infoRef.current
          );
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('Failed to load scene module:', err);
        if (!disposed) setError(errorMessage);
      } finally {
        if (!disposed) setIsLoading(false);
      }
    }
    loadScene();
    return () => { disposed = true; };
  }, [scene, webgpuReady, gltfOptions]);

  // Helper to dispose WebGPU resources and scene
  const disposeWebGPU = () => {
    // Call scene dispose if available
    if (sceneModuleRef.current && typeof sceneModuleRef.current.dispose === 'function') {
      try { sceneModuleRef.current.dispose(); } catch {}
    }
    sceneModuleRef.current = null;
    // Unconfigure the context if possible (not standard, but some implementations support it)
    if (gpuContextRef.current && gpuContextRef.current.unconfigure) {
      try { gpuContextRef.current.unconfigure(); } catch {}
    }
    // Destroy device if possible (not standard, but for future-proofing)
    if (deviceRef.current && (deviceRef.current as any).destroy) {
      try { (deviceRef.current as any).destroy(); } catch {}
    }
    deviceRef.current = null;
    gpuContextRef.current = null;
    presentationFormatRef.current = null;
    setWebgpuReady(false);
  };

  // Dispose on back or scene change
  useEffect(() => {
    return () => {
      disposeWebGPU();
    };
  }, [scene.name]);

  // Back button handler
  const handleBack = () => {
    disposeWebGPU();
    onBack();
  };

  return (
    <div className="webgl-container">
      <button className="back-button" onClick={handleBack}>
        &larr; Back to Scenes
      </button>
      {scene.components.includes('animationMenu') && (
        <GLTFControls onGLTFOptionsChange={setGLTFOptions} />
      )}
      {isLoading && (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p>Loading {scene.name}...</p>
        </div>
      )}
      {error && (
        <div className="error-message">
          <h3>Error loading scene</h3>
          <p>{error}</p>
        </div>
      )}
      <canvas 
        ref={canvasRef} 
        id="canvas" 
        width={1280} 
        height={720} 
      />
      <pre ref={infoRef} id="info"></pre>
    </div>
  );
};

export default WebGPUScene;
