import React, { useEffect, useRef, useState } from "react";
import GLTFMenu from "./GLTFMenu";
import { gltfFiles } from "../gltf/gltfFileList";
import { getGLTFAnimationNames } from "../gltf/GLTFGameObject";

interface GLTFControlsProps {
  onGLTFOptionsChange: (opts: {
    gltfPath: string;
    skinMode: boolean;
    onGLTFGameObject: (gltfGameObject: any) => void;
  }) => void;
}

const GLTFControls: React.FC<GLTFControlsProps> = ({ onGLTFOptionsChange }) => {
  const [selectedGLTF, setSelectedGLTF] = useState(gltfFiles[0]);
  const [skinMode, setSkinMode] = useState(true);
  const [animations, setAnimations] = useState<string[]>([]);
  const [selectedAnimation, setSelectedAnimation] = useState("");
  const [animationSpeed, setAnimationSpeed] = useState(0.5);
  const gltfGameObjectRef = useRef<any>(null);

  // Handler for model selection
  const handleGLTFChange = (file: string) => {
    setSelectedGLTF(file);
    setSelectedAnimation("");
    setAnimations([]);
  };
  const handleAnimationChange = (animationName: string) => {
    setSelectedAnimation(animationName);
  };
  const handleSpeedChange = (speed: number) => {
    setAnimationSpeed(speed);
  };

  // Notify parent of GLTF options only when the GLTF file changes
  useEffect(() => {
    onGLTFOptionsChange({
      gltfPath: selectedGLTF,
      skinMode,
      onGLTFGameObject: (gltfGameObject: any) => {
        gltfGameObjectRef.current = gltfGameObject;
        const anims = getGLTFAnimationNames(gltfGameObject);
        setAnimations(anims);
        if (anims.length > 0) {
          setSelectedAnimation(anims[0]);
        }
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGLTF]);

  // Animation change
  useEffect(() => {
    if (!gltfGameObjectRef.current) return;
    if (selectedAnimation) {
      gltfGameObjectRef.current.setActiveAnimationByName(selectedAnimation);
    }
  }, [selectedAnimation]);

  // Skin mode change
  useEffect(() => {
    if (!gltfGameObjectRef.current) return;
    gltfGameObjectRef.current.skinMode = skinMode ? 1 : 0;
  }, [skinMode]);

  // Animation speed change
  useEffect(() => {
    if (!gltfGameObjectRef.current) return;
    gltfGameObjectRef.current.setAnimationSpeed(animationSpeed);
  }, [animationSpeed]);

  return (
    <>
      <GLTFMenu
        gltfFiles={gltfFiles}
        selectedFile={selectedGLTF}
        onFileChange={handleGLTFChange}
        skinMode={skinMode}
        onSkinModeChange={setSkinMode}
        animations={animations}
        selectedAnimation={selectedAnimation}
        onAnimationChange={handleAnimationChange}
        speed={animationSpeed}
        onSpeedChange={handleSpeedChange}
      />
      {!gltfGameObjectRef.current ? null : (
        <div className="model-status" style={{
          position: 'absolute',
          top: '80px',
          right: '20px',
          background: 'rgba(35, 35, 35, 0.8)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          zIndex: 100,
          backdropFilter: 'blur(2px)'
        }}>
          Model loaded: {selectedGLTF.split('/').pop()}
          {animations.length > 0 && (
            <span> | {animations.length} animation{animations.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      )}
    </>
  );
};

export default GLTFControls;
