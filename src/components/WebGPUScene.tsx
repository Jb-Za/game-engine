import React, { useEffect, useRef } from 'react';
import './WebGPUScene.css';

const WebGPUScene: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const infoRef = useRef<HTMLPreElement>(null);
  
  useEffect(() => {
    const loadScene = async () => {
      if (canvasRef.current && infoRef.current) {
        try {
          // Using dynamic import for the module
          const GLTFModule = await import('../scenes/GLTFImportScene');
          await GLTFModule.init(canvasRef.current, infoRef.current);
          console.log('Scene initialized successfully');
        } catch (error) {
          console.error('Failed to initialize scene:', error);
        }
      }
    };
    
    loadScene();
  }, []);

  return (
    <div className="webgl-container">
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