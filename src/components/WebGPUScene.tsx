import React, { useEffect, useRef, useState } from "react";
import { SceneInfo } from "../scenes/sceneList";
import { checkWebGPUSupport } from "../utils/WebGPUCheck";
import "./WebGPUScene.css";
import GLTFControls from "./GLTFControls";
import TerrainWaterControls from "./TerrainWaterControls";
import { SceneEditorControls, SceneEditorControlsRef, SceneEditorState } from "./SceneEditorControls";
import { RayTracingSceneEditorControls, RayTracingSceneEditorControlsRef, RayTracingSceneEditorState } from "./RayTracingSceneEditorControls";
import { updateTerrainParams, updateWaterParams } from "../scenes/TerrainGeneratorScene/TerrainGeneratorScene";

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
  const [gltfOptions, setGLTFOptions] = useState<any>(null);  // Track the current scene module for disposal
  const sceneModuleRef = useRef<any>(null);
  const sceneEditorControlsRef = useRef<SceneEditorControlsRef>(null);
  const rayTracingSceneEditorControlsRef = useRef<RayTracingSceneEditorControlsRef>(null);

  // Scene editor handlers
  const handleSceneEditorChange = async (state: SceneEditorState) => {
    if (sceneModuleRef.current && typeof sceneModuleRef.current.updateSceneState === 'function') {
      sceneModuleRef.current.updateSceneState(state);
    }
  };

  // Ray tracing scene editor handlers
  const handleRayTracingSceneEditorChange = async (state: RayTracingSceneEditorState) => {
    // The raytracing scene updates happen automatically through the updateSceneFromState in the controls
    console.log('Ray tracing scene state changed:', state);
  };

  const handleAddObject = async (type: 'cube' | 'sphere' | 'light' | 'camera') => {
    if (sceneModuleRef.current && typeof sceneModuleRef.current.addObject === 'function') {
      const updatedScene = sceneModuleRef.current.addObject(type);
      if (updatedScene && sceneEditorControlsRef.current) {
        console.log('Object added, refreshing scene');
        // Refresh the scene editor to show the new object
        sceneEditorControlsRef.current.refreshFromScene();
      }
    }
  };

  const handleAddRayTracingObject = async (type: 'sphere' | 'plane' | 'light') => {
    if (sceneModuleRef.current && typeof sceneModuleRef.current.addObject === 'function') {
      const updatedScene = sceneModuleRef.current.addObject(type);
      if (updatedScene && rayTracingSceneEditorControlsRef.current) {
        console.log('Ray tracing object added, refreshing scene');
        // Refresh the scene editor to show the new object
        rayTracingSceneEditorControlsRef.current.refreshFromScene();
      }
    }
  };

  // Function to get the current scene instance for SceneEditorControls
  const getCurrentScene = () => {
    if (sceneModuleRef.current && typeof sceneModuleRef.current.getScene === 'function') {
      return sceneModuleRef.current.getScene();
    }
    return null;
  };

  const handleRemoveObject = async (id: string) => {
    if (sceneModuleRef.current && typeof sceneModuleRef.current.removeObject === 'function') {
      sceneModuleRef.current.removeObject(id);
      // Refresh the scene editor to reflect the removal
      if (sceneEditorControlsRef.current) {
        sceneEditorControlsRef.current.refreshFromScene();
      }
    }
  };

  const handleRemoveRayTracingObject = async (id: string) => {
    if (sceneModuleRef.current && typeof sceneModuleRef.current.removeObject === 'function') {
      sceneModuleRef.current.removeObject(id);
      // Refresh the scene editor to reflect the removal
      if (rayTracingSceneEditorControlsRef.current) {
        rayTracingSceneEditorControlsRef.current.refreshFromScene();
      }
    }
  };

  const handleSelectObject = async (id: string | null) => {
    if (sceneModuleRef.current && typeof sceneModuleRef.current.selectObject === 'function') {
      sceneModuleRef.current.selectObject(id);
    }
  };

  const handleSaveScene = async () => {
    if (sceneModuleRef.current && typeof sceneModuleRef.current.saveScene === 'function') {
      sceneModuleRef.current.saveScene();
    }
  };

  const handleLoadScene = async () => {
    if (sceneModuleRef.current && typeof sceneModuleRef.current.loadScene === 'function') {
      sceneModuleRef.current.loadScene();
    }
  };
  // Preload all scene modules for dynamic imports
  const sceneModules = {
    ...import.meta.glob<any>('../scenes/**/*.ts'),
    ...import.meta.glob<any>('../sceneEditor/**/*.ts'),
  };

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
        }        const normalizedPath = scene.importPath.replace(/^\.\.\//, '');
        
        // Find the matching module in our preloaded scene modules
        const moduleKey = Object.keys(sceneModules).find(key => 
          key.endsWith(normalizedPath.replace('.js', '.ts'))
        );
        
        if (!moduleKey) {
          console.error(`Could not find module for path: ${scene.importPath}`);
          return;
        }
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
        }
        else if(scene.components.includes('sceneEditorControls'))
        {
          await SceneModule.init(
            canvasRef.current,
            deviceRef.current,
            gpuContextRef.current,
            presentationFormatRef.current,
            infoRef.current
          );
          
          // After initialization, refresh the scene editor with current scene data
          if (sceneEditorControlsRef.current) {
            sceneEditorControlsRef.current.refreshFromScene();
          }
        }
        else if(scene.components.includes('rayTracingSceneEditorControls'))
        {
          await SceneModule.init(
            canvasRef.current,
            deviceRef.current,
            gpuContextRef.current,
            presentationFormatRef.current,
            infoRef.current
          );
          
          // After initialization, refresh the raytracing scene editor with current scene data
          if (rayTracingSceneEditorControlsRef.current) {
            rayTracingSceneEditorControlsRef.current.refreshFromScene();
          }
        }
        else
        {
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
    <div className="webgpu-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', height: '50px' }}>
        <button className="back-button" onClick={(e) => {
        console.log('Back button clicked');
        e.stopPropagation();
        handleBack();
    }}>
          &larr; Back to Scenes
        </button>
      </div>      {scene.components.includes('animationMenu') && (
        <GLTFControls onGLTFOptionsChange={setGLTFOptions} />
      )}
      {scene.components.includes('terrainControls') && (
        <TerrainWaterControls 
          onTerrainChange={updateTerrainParams}
          onWaterChange={updateWaterParams}
        />
      )}      {scene.components.includes('sceneEditorControls') && (
        <SceneEditorControls
          ref={sceneEditorControlsRef}
          onSceneChange={handleSceneEditorChange}
          onAddObject={handleAddObject}
          onRemoveObject={handleRemoveObject}
          onSelectObject={handleSelectObject}
          onSaveScene={handleSaveScene}
          onLoadScene={handleLoadScene}
          onGetScene={getCurrentScene}
        />
      )}
      {scene.components.includes('rayTracingSceneEditorControls') && (
        <RayTracingSceneEditorControls
          ref={rayTracingSceneEditorControlsRef}
          onSceneChange={handleRayTracingSceneEditorChange}
          onAddObject={handleAddRayTracingObject}
          onRemoveObject={handleRemoveRayTracingObject}
          onGetScene={getCurrentScene}
        />
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
        onContextMenu={(e) => e.preventDefault()}
        width={1280} 
        height={720} 
      />
      <pre ref={infoRef} id="info"></pre>
    </div>
  );
};

export default WebGPUScene;
