import React, { useState } from 'react';

export interface TerrainParams {
  seed: number;
  offset: { x: number; y: number };
  octaves: number;
  heightMultiplier: number;
  persistence: number;
  lacunarity: number;
  scale: number;
}

export interface WaterParams {
  waveSpeed: number;
  waveHeight: number;
  waveFrequency: number;
  transparency: number;
  reflectivity: number;
  waterLevel: number;
  color: { r: number; g: number; b: number; a: number };
  scale: { x: number; y: number; z: number };
}

interface TerrainWaterControlsProps {
  onTerrainChange: (params: TerrainParams) => void;
  onWaterChange: (params: WaterParams) => void;
}

const TerrainWaterControls: React.FC<TerrainWaterControlsProps> = ({
  onTerrainChange,
  onWaterChange
}) => {
  // Terrain state
  const [terrainParams, setTerrainParams] = useState<TerrainParams>({
    seed: 1928371289,
    offset: { x: 0, y: 0 },
    octaves: 16,
    heightMultiplier: 32.0,
    persistence: 0.5,
    lacunarity: 1.6,
    scale: 90.0,
  });

  // Water state
  const [waterParams, setWaterParams] = useState<WaterParams>({
    waveSpeed: 0.5,
    waveHeight: 0.2,
    waveFrequency: 2.0,
    transparency: 0.7,
    reflectivity: 0.6,
    waterLevel: 8.0,
    color: { r: 0.2, g: 0.5, b: 0.8, a: 0.8 },
    scale: { x: 1.5, y: 1, z: 1.5 },
  });

  const [activeTab, setActiveTab] = useState<'terrain' | 'water'>('terrain');

  // Update terrain parameters
  const updateTerrainParam = (key: keyof TerrainParams, value: any) => {
    const newParams = { ...terrainParams, [key]: value };
    setTerrainParams(newParams);
    onTerrainChange(newParams);
  };

  // Update water parameters
  const updateWaterParam = (key: keyof WaterParams, value: any) => {
    const newParams = { ...waterParams, [key]: value };
    setWaterParams(newParams);
    onWaterChange(newParams);
  };

  // Generate random seed
  const generateRandomSeed = () => {
    const randomSeed = Math.floor(Math.random() * 2147483647);
    updateTerrainParam('seed', randomSeed);
  };

  const controlPanelStyle: React.CSSProperties = {
    position: 'absolute',
    top: '10px',
    right: '100px',
    width: '300px',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    color: 'white',
    padding: '15px',
    borderRadius: '8px',
    fontFamily: 'Arial, sans-serif',
    fontSize: '12px',
    maxHeight: '80vh',
    overflowY: 'auto',
    zIndex: 1000,
  };

  const tabStyle: React.CSSProperties = {
    padding: '8px 16px',
    marginRight: '5px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    border: 'none',
    color: 'white',
    cursor: 'pointer',
    borderRadius: '4px',
  };

  const activeTabStyle: React.CSSProperties = {
    ...tabStyle,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '4px',
    marginBottom: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    color: 'white',
    borderRadius: '3px',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '4px',
    fontSize: '11px',
    color: '#ccc',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '6px 12px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '11px',
    marginTop: '5px',
  };

  return (
    <div style={controlPanelStyle}>
      <h3 style={{ margin: '0 0 15px 0', fontSize: '14px' }}>Scene Controls</h3>
      
      {/* Tab Navigation */}
      <div style={{ marginBottom: '15px' }}>
        <button
          style={activeTab === 'terrain' ? activeTabStyle : tabStyle}
          onClick={() => setActiveTab('terrain')}
        >
          Terrain
        </button>
        <button
          style={activeTab === 'water' ? activeTabStyle : tabStyle}
          onClick={() => setActiveTab('water')}
        >
          Water
        </button>
      </div>

      {/* Terrain Controls */}
      {activeTab === 'terrain' && (
        <div>
          <h4 style={{ marginBottom: '10px', fontSize: '12px' }}>Terrain Parameters</h4>
          
          <label style={labelStyle}>Seed</label>
          <div style={{ display: 'flex', gap: '5px', marginBottom: '8px' }}>
            <input
              style={{ ...inputStyle, width: '70%' }}
              type="number"
              value={terrainParams.seed}
              onChange={(e) => updateTerrainParam('seed', parseInt(e.target.value))}
            />
            <button style={{ ...buttonStyle, width: '25%' }} onClick={generateRandomSeed}>
              Random
            </button>
          </div>

          <label style={labelStyle}>Height Multiplier: {terrainParams.heightMultiplier}</label>
          <input
            style={inputStyle}
            type="range"
            min="1"
            max="100"
            step="1"
            value={terrainParams.heightMultiplier}
            onChange={(e) => updateTerrainParam('heightMultiplier', parseFloat(e.target.value))}
          />

          <label style={labelStyle}>Octaves: {terrainParams.octaves}</label>
          <input
            style={inputStyle}
            type="range"
            min="1"
            max="20"
            step="1"
            value={terrainParams.octaves}
            onChange={(e) => updateTerrainParam('octaves', parseInt(e.target.value))}
          />

          <label style={labelStyle}>Persistence: {terrainParams.persistence.toFixed(2)}</label>
          <input
            style={inputStyle}
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={terrainParams.persistence}
            onChange={(e) => updateTerrainParam('persistence', parseFloat(e.target.value))}
          />

          <label style={labelStyle}>Lacunarity: {terrainParams.lacunarity.toFixed(2)}</label>
          <input
            style={inputStyle}
            type="range"
            min="1.0"
            max="3.0"
            step="0.1"
            value={terrainParams.lacunarity}
            onChange={(e) => updateTerrainParam('lacunarity', parseFloat(e.target.value))}
          />

          <label style={labelStyle}>Scale: {terrainParams.scale.toFixed(1)}</label>
          <input
            style={inputStyle}
            type="range"
            min="10"
            max="200"
            step="5"
            value={terrainParams.scale}
            onChange={(e) => updateTerrainParam('scale', parseFloat(e.target.value))}
          />

          <label style={labelStyle}>Offset X: {terrainParams.offset.x}</label>
          <input
            style={inputStyle}
            type="range"
            min="-100"
            max="100"
            step="1"
            value={terrainParams.offset.x}
            onChange={(e) => updateTerrainParam('offset', { ...terrainParams.offset, x: parseInt(e.target.value) })}
          />

          <label style={labelStyle}>Offset Y: {terrainParams.offset.y}</label>
          <input
            style={inputStyle}
            type="range"
            min="-100"
            max="100"
            step="1"
            value={terrainParams.offset.y}
            onChange={(e) => updateTerrainParam('offset', { ...terrainParams.offset, y: parseInt(e.target.value) })}
          />
        </div>
      )}

      {/* Water Controls */}
      {activeTab === 'water' && (
        <div>
          <h4 style={{ marginBottom: '10px', fontSize: '12px' }}>Water Parameters</h4>
          
          <label style={labelStyle}>Wave Speed: {waterParams.waveSpeed.toFixed(2)}</label>
          <input
            style={inputStyle}
            type="range"
            min="0.1"
            max="2.0"
            step="0.1"
            value={waterParams.waveSpeed}
            onChange={(e) => updateWaterParam('waveSpeed', parseFloat(e.target.value))}
          />

          <label style={labelStyle}>Wave Height: {waterParams.waveHeight.toFixed(2)}</label>
          <input
            style={inputStyle}
            type="range"
            min="0.0"
            max="1.0"
            step="0.05"
            value={waterParams.waveHeight}
            onChange={(e) => updateWaterParam('waveHeight', parseFloat(e.target.value))}
          />

          <label style={labelStyle}>Wave Frequency: {waterParams.waveFrequency.toFixed(1)}</label>
          <input
            style={inputStyle}
            type="range"
            min="0.5"
            max="10.0"
            step="0.5"
            value={waterParams.waveFrequency}
            onChange={(e) => updateWaterParam('waveFrequency', parseFloat(e.target.value))}
          />

          <label style={labelStyle}>Water Level: {waterParams.waterLevel.toFixed(1)}</label>
          <input
            style={inputStyle}
            type="range"
            min="-10"
            max="20"
            step="0.5"
            value={waterParams.waterLevel}
            onChange={(e) => updateWaterParam('waterLevel', parseFloat(e.target.value))}
          />

          <label style={labelStyle}>Transparency: {waterParams.transparency.toFixed(2)}</label>
          <input
            style={inputStyle}
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={waterParams.transparency}
            onChange={(e) => updateWaterParam('transparency', parseFloat(e.target.value))}
          />

          <label style={labelStyle}>Reflectivity: {waterParams.reflectivity.toFixed(2)}</label>
          <input
            style={inputStyle}
            type="range"
            min="0.0"
            max="1.0"
            step="0.05"
            value={waterParams.reflectivity}
            onChange={(e) => updateWaterParam('reflectivity', parseFloat(e.target.value))}
          />

          <h4 style={{ marginBottom: '10px', fontSize: '12px', marginTop: '15px' }}>Water Color</h4>
          
          <label style={labelStyle}>Red: {waterParams.color.r.toFixed(2)}</label>
          <input
            style={inputStyle}
            type="range"
            min="0.0"
            max="1.0"
            step="0.05"
            value={waterParams.color.r}
            onChange={(e) => updateWaterParam('color', { ...waterParams.color, r: parseFloat(e.target.value) })}
          />

          <label style={labelStyle}>Green: {waterParams.color.g.toFixed(2)}</label>
          <input
            style={inputStyle}
            type="range"
            min="0.0"
            max="1.0"
            step="0.05"
            value={waterParams.color.g}
            onChange={(e) => updateWaterParam('color', { ...waterParams.color, g: parseFloat(e.target.value) })}
          />

          <label style={labelStyle}>Blue: {waterParams.color.b.toFixed(2)}</label>
          <input
            style={inputStyle}
            type="range"
            min="0.0"
            max="1.0"
            step="0.05"
            value={waterParams.color.b}
            onChange={(e) => updateWaterParam('color', { ...waterParams.color, b: parseFloat(e.target.value) })}
          />

          <label style={labelStyle}>Alpha: {waterParams.color.a.toFixed(2)}</label>
          <input
            style={inputStyle}
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={waterParams.color.a}
            onChange={(e) => updateWaterParam('color', { ...waterParams.color, a: parseFloat(e.target.value) })}
          />

          <h4 style={{ marginBottom: '10px', fontSize: '12px', marginTop: '15px' }}>Water Scale</h4>
          
          <label style={labelStyle}>Scale X: {waterParams.scale.x.toFixed(1)}</label>
          <input
            style={inputStyle}
            type="range"
            min="0.5"
            max="5.0"
            step="0.1"
            value={waterParams.scale.x}
            onChange={(e) => updateWaterParam('scale', { ...waterParams.scale, x: parseFloat(e.target.value) })}
          />

          <label style={labelStyle}>Scale Z: {waterParams.scale.z.toFixed(1)}</label>
          <input
            style={inputStyle}
            type="range"
            min="0.5"
            max="5.0"
            step="0.1"
            value={waterParams.scale.z}
            onChange={(e) => updateWaterParam('scale', { ...waterParams.scale, z: parseFloat(e.target.value) })}
          />
        </div>
      )}

      <div style={{ marginTop: '15px', fontSize: '10px', color: '#888' }}>
        Use mouse to look around<br/>
        P - Toggle terrain wireframe<br/>
        O - Toggle water wireframe
      </div>
    </div>
  );
};

export default TerrainWaterControls;
