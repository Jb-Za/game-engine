import React, { useEffect, useRef, useState } from 'react';
import { SceneInfo } from '../scenes/sceneList';
import { checkWebGPUSupport } from '../utils/WebGPUCheck';
import './WebGPUScene.css';

interface WebGPUSceneProps {
  scene: SceneInfo;
  onBack: () => void;
}

const WebGPUScene: React.FC<WebGPUSceneProps> = ({ scene, onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const infoRef = useRef<HTMLPreElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  useEffect(() => {
    let isActive = true; // Flag to track if component is still mounted
    
    const loadScene = async () => {
      if (canvasRef.current && infoRef.current) {
        try {
          // Clear any previous errors
          setError(null);
          setIsLoading(true);
          
          // First check if WebGPU is supported
          await checkWebGPUSupport();
          
          // Dynamic import for the selected scene module
          const SceneModule = await import(/* @vite-ignore */ scene.importPath);
          
          if (isActive) {
            await SceneModule.init(canvasRef.current, infoRef.current);
            console.log(`Scene '${scene.name}' initialized successfully`);
          }
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
    
    loadScene();
    
    // Cleanup function
    return () => {
      isActive = false;
      // Any additional cleanup (stopping animations, etc.) can go here
    };
  }, [scene]);  return (
    <div className="webgl-container">
      <button className="back-button" onClick={onBack}>
        &larr; Back to Scenes
      </button>
      
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