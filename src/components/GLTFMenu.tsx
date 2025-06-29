import React from "react";

export interface GLTFMenuProps {
  gltfFiles: string[];
  selectedFile: string;
  onFileChange: (file: string) => void;
  skinMode: boolean;
  onSkinModeChange: (mode: boolean) => void;
  animations: string[];
  selectedAnimation: string;
  onAnimationChange: (anim: string) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
}

const GLTFMenu: React.FC<GLTFMenuProps> = ({
  gltfFiles,
  selectedFile,
  onFileChange,
  skinMode,
  onSkinModeChange,
  animations,
  selectedAnimation,
  onAnimationChange,
  speed,
  onSpeedChange,
}) => {
  return (
    <div className="gltf-menu" style={{ background: 'rgb(65, 65, 65)', padding: 12, borderRadius: 8, boxShadow: '0 2px 8px #0002', position: 'fixed', right: '10px', top: '20%' }}>
      <div style={{ marginBottom: 8 }}>
        <label>GLTF Model:&nbsp;</label>
        <select value={selectedFile} onChange={e => onFileChange(e.target.value)}>
          {gltfFiles.map(f => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>
      <div style={{ marginBottom: 8 }}>
        <label>
          <input type="checkbox" checked={skinMode} onChange={e => onSkinModeChange(e.target.checked)} />
          &nbsp;Skin Mode
        </label>
      </div>   
      <div style={{ marginBottom: 8 }}>
        <label>Animation:&nbsp;</label>
        <select 
          value={selectedAnimation} 
          onChange={e => onAnimationChange(e.target.value)}
          disabled={animations.length === 0}
        >
          {animations.length === 0 ? <option value="">(none)</option> : null}
          {animations.map(anim => (
            <option key={anim} value={anim}>{anim}</option>
          ))}
        </select>
        {animations.length === 0 && 
          <span style={{ marginLeft: 10, fontSize: '0.85em', color: '#777' }}>No animations available</span>
        }
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', opacity: animations.length === 0 ? 0.5 : 1 }}>
        <label>Speed: {speed.toFixed(1)}x</label>
        <input 
          type="range" 
          min="0" 
          max="1" 
          step="0.1" 
          value={speed} 
          onChange={e => onSpeedChange(parseFloat(e.target.value))} 
          style={{ flexGrow: 1 }} 
          disabled={animations.length === 0}
        />
      </div>
    </div>
  );
};

export default GLTFMenu;
