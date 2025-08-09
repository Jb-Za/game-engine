import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { SceneObjectData, SceneEditorControlsRef, SceneEditorControlsProps, SceneEditorState } from '../components/SceneEditorControls'


const SceneEditorControls = forwardRef<SceneEditorControlsRef, SceneEditorControlsProps>(({
  onSceneChange,
  onAddObject,
  onRemoveObject,
  onSelectObject,
  onSaveScene,
  onLoadScene
}, ref) => {
  const [sceneState, setSceneState] = useState<SceneEditorState>({
    objects: [],
    selectedObjectId: null,
    cameraPosition: { x: 0, y: 5, z: 10 },
    cameraTarget: { x: 0, y: 0, z: 0 },
    ambientLight: {
      color: { r: 1, g: 1, b: 1, a: 1 },
      intensity: 0.3
    },
    directionalLight: {
      color: { r: 1, g: 1, b: 1, a: 1 },
      intensity: 0.7,
      direction: { x: -1, y: -1, z: -1 }
    }
  });  // Update parent when scene state changes
  useEffect(() => {
    onSceneChange(sceneState);
  }, [sceneState, onSceneChange]);

  // Expose methods to parent component via ref
  useImperativeHandle(ref, () => ({
    addNewObject: (objectData: SceneObjectData) => {
      setSceneState(prev => ({
        ...prev,
        objects: [...prev.objects, objectData]
      }));
    }
  }));

  // Get selected object
  const selectedObject = sceneState.objects.find(obj => obj.id === sceneState.selectedObjectId);

  // Helper functions
  const updateSceneState = (updates: Partial<SceneEditorState>) => {
    setSceneState(prev => ({ ...prev, ...updates }));
  };

  const updateObject = (id: string, updates: Partial<SceneObjectData>) => {
    setSceneState(prev => ({
      ...prev,
      objects: prev.objects.map(obj => 
        obj.id === id ? { ...obj, ...updates } : obj
      )
    }));
  };

  const handleSelectObject = (id: string | null) => {
    setSceneState(prev => ({ ...prev, selectedObjectId: id }));
    onSelectObject(id);
  };

  const handleRemoveObject = (id: string) => {
    setSceneState(prev => ({
      ...prev,
      objects: prev.objects.filter(obj => obj.id !== id),
      selectedObjectId: prev.selectedObjectId === id ? null : prev.selectedObjectId
    }));
    onRemoveObject(id);
  };
  // Helper functions
  const hierarchyPanelStyle: React.CSSProperties = {
    position: 'absolute',
    top: '10px',
    left: '10px',
    width: '280px',
    height: 'calc(100vh - 120px)',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    color: 'white',
    borderRadius: '8px',
    fontFamily: 'Arial, sans-serif',
    fontSize: '12px',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  };

  const propertiesPanelStyle: React.CSSProperties = {
    position: 'absolute',
    top: '10px',
    right: '10px',
    width: '320px',
    height: 'calc(100vh - 120px)',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    color: 'white',
    borderRadius: '8px',
    fontFamily: 'Arial, sans-serif',
    fontSize: '12px',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '4px',
    marginBottom: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    color: 'white',
    borderRadius: '3px',
    fontSize: '11px'
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '4px',
    fontSize: '11px',
    color: '#ccc'
  };

  const buttonStyle: React.CSSProperties = {
    padding: '6px 12px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '11px',
    marginRight: '5px',
    marginBottom: '5px'
  };

  const deleteButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: '#f44336'
  };
  return (
    <>
      {/* Hierarchy Panel - Left Side */}
      <div style={hierarchyPanelStyle}>
        {/* Header */}
        <div style={{ padding: '15px', borderBottom: '1px solid #444' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '14px' }}>Scene Hierarchy</h3>
          
          {/* File operations */}
          <div style={{ marginBottom: '15px' }}>
            <button style={buttonStyle} onClick={onSaveScene}>💾 Save</button>
            <button style={buttonStyle} onClick={onLoadScene}>📁 Load</button>
          </div>

          {/* Add objects section */}
          <h4 style={{ marginBottom: '10px', fontSize: '12px' }}>Add Objects</h4>
          <div style={{ marginBottom: '15px' }}>
            <button style={buttonStyle} onClick={() => onAddObject('cube')}>📦 Cube</button>
            <button style={buttonStyle} onClick={() => onAddObject('sphere')}>🔴 Sphere</button>
            <button style={buttonStyle} onClick={() => onAddObject('light')}>💡 Light</button>
            <button style={buttonStyle} onClick={() => onAddObject('camera')}>📷 Camera</button>
          </div>
        </div>

        {/* Scene Objects List */}
        <div style={{ flex: 1, padding: '15px', overflowY: 'auto' }}>
          <h4 style={{ marginBottom: '10px', fontSize: '12px' }}>Scene Objects ({sceneState.objects.length})</h4>
          <div>
            {sceneState.objects.map(obj => (
              <div 
                key={obj.id}
                style={{
                  padding: '8px',
                  marginBottom: '4px',
                  backgroundColor: obj.id === sceneState.selectedObjectId ? 'rgba(100, 149, 237, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: obj.id === sceneState.selectedObjectId ? '1px solid #6495ED' : '1px solid transparent'
                }}
                onClick={() => handleSelectObject(obj.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px' }}>
                    {obj.type === 'cube' ? '📦' : obj.type === 'sphere' ? '🔴' : obj.type === 'light' ? '💡' : '📷'}
                  </span>
                  <span>{obj.name}</span>
                  {!obj.visible && <span style={{ color: '#888', fontSize: '10px' }}>(hidden)</span>}
                </div>
                <button
                  style={deleteButtonStyle}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveObject(obj.id);
                  }}
                  title="Delete object"
                >
                  🗑️
                </button>
              </div>
            ))}
            {sceneState.objects.length === 0 && (
              <p style={{ color: '#888', textAlign: 'center', fontStyle: 'italic' }}>
                No objects in scene.<br/>
                Click the buttons above to add objects.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '10px', borderTop: '1px solid #444', fontSize: '10px', color: '#888' }}>
          Use mouse to look around<br/>
          WASD - Move camera<br/>
          R - Reset camera
        </div>
      </div>

      {/* Properties Panel - Right Side */}
      <div style={propertiesPanelStyle}>
        {/* Header */}
        <div style={{ padding: '15px', borderBottom: '1px solid #444' }}>
          <h3 style={{ margin: '0', fontSize: '14px' }}>
            {selectedObject ? `Properties - ${selectedObject.name}` : 'Properties'}
          </h3>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: '15px', overflowY: 'auto' }}>
          {selectedObject ? (
            <div>
              {/* Object Info */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '10px', fontSize: '12px', color: '#ccc' }}>OBJECT INFO</h4>
                
                <label style={labelStyle}>Name</label>
                <input
                  style={inputStyle}
                  type="text"
                  value={selectedObject.name}
                  onChange={(e) => updateObject(selectedObject.id, { name: e.target.value })}
                />

                <label style={labelStyle}>Type</label>
                <input
                  style={{ ...inputStyle, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                  type="text"
                  value={selectedObject.type}
                  readOnly
                />

                <label style={labelStyle}>ID</label>
                <input
                  style={{ ...inputStyle, backgroundColor: 'rgba(255, 255, 255, 0.05)', fontSize: '10px' }}
                  type="text"
                  value={selectedObject.id}
                  readOnly
                />
              </div>

              {/* Transform */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '10px', fontSize: '12px', color: '#ccc' }}>TRANSFORM</h4>
                
                <label style={labelStyle}>Position</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px', marginBottom: '8px' }}>
                  <input
                    style={inputStyle}
                    type="number"
                    step="0.1"
                    placeholder="X"
                    value={selectedObject.position.x}
                    onChange={(e) => updateObject(selectedObject.id, {
                      position: { ...selectedObject.position, x: parseFloat(e.target.value) || 0 }
                    })}
                  />
                  <input
                    style={inputStyle}
                    type="number"
                    step="0.1"
                    placeholder="Y"
                    value={selectedObject.position.y}
                    onChange={(e) => updateObject(selectedObject.id, {
                      position: { ...selectedObject.position, y: parseFloat(e.target.value) || 0 }
                    })}
                  />
                  <input
                    style={inputStyle}
                    type="number"
                    step="0.1"
                    placeholder="Z"
                    value={selectedObject.position.z}
                    onChange={(e) => updateObject(selectedObject.id, {
                      position: { ...selectedObject.position, z: parseFloat(e.target.value) || 0 }
                    })}
                  />
                </div>

                <label style={labelStyle}>Scale</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px', marginBottom: '8px' }}>
                  <input
                    style={inputStyle}
                    type="number"
                    step="0.1"
                    placeholder="X"
                    value={selectedObject.scale.x}
                    onChange={(e) => updateObject(selectedObject.id, {
                      scale: { ...selectedObject.scale, x: parseFloat(e.target.value) || 1 }
                    })}
                  />
                  <input
                    style={inputStyle}
                    type="number"
                    step="0.1"
                    placeholder="Y"
                    value={selectedObject.scale.y}
                    onChange={(e) => updateObject(selectedObject.id, {
                      scale: { ...selectedObject.scale, y: parseFloat(e.target.value) || 1 }
                    })}
                  />
                  <input
                    style={inputStyle}
                    type="number"
                    step="0.1"
                    placeholder="Z"
                    value={selectedObject.scale.z}
                    onChange={(e) => updateObject(selectedObject.id, {
                      scale: { ...selectedObject.scale, z: parseFloat(e.target.value) || 1 }
                    })}
                  />
                </div>
              </div>

              {/* Appearance */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '10px', fontSize: '12px', color: '#ccc' }}>APPEARANCE</h4>
                
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                  <input
                    type="checkbox"
                    checked={selectedObject.visible}
                    onChange={(e) => updateObject(selectedObject.id, { visible: e.target.checked })}
                    style={{ marginRight: '8px' }}
                  />
                  Visible
                </label>

                <label style={labelStyle}>Color (RGBA)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '5px', marginBottom: '8px' }}>
                  <div>
                    <label style={{ ...labelStyle, fontSize: '9px', marginBottom: '2px' }}>R</label>
                    <input
                      style={inputStyle}
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={selectedObject.color.r.toFixed(2)}
                      onChange={(e) => updateObject(selectedObject.id, {
                        color: { ...selectedObject.color, r: parseFloat(e.target.value) || 0 }
                      })}
                    />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: '9px', marginBottom: '2px' }}>G</label>
                    <input
                      style={inputStyle}
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={selectedObject.color.g.toFixed(2)}
                      onChange={(e) => updateObject(selectedObject.id, {
                        color: { ...selectedObject.color, g: parseFloat(e.target.value) || 0 }
                      })}
                    />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: '9px', marginBottom: '2px' }}>B</label>
                    <input
                      style={inputStyle}
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={selectedObject.color.b.toFixed(2)}
                      onChange={(e) => updateObject(selectedObject.id, {
                        color: { ...selectedObject.color, b: parseFloat(e.target.value) || 0 }
                      })}
                    />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: '9px', marginBottom: '2px' }}>A</label>
                    <input
                      style={inputStyle}
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={selectedObject.color.a.toFixed(2)}
                      onChange={(e) => updateObject(selectedObject.id, {
                        color: { ...selectedObject.color, a: parseFloat(e.target.value) || 1 }
                      })}
                    />
                  </div>
                </div>
              </div>

              {/* Scene Settings */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '10px', fontSize: '12px', color: '#ccc' }}>SCENE SETTINGS</h4>
                
                <h5 style={{ marginTop: '15px', marginBottom: '10px', fontSize: '11px', color: '#aaa' }}>Camera</h5>
                <label style={labelStyle}>Position</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px', marginBottom: '8px' }}>
                  <input
                    style={inputStyle}
                    type="number"
                    step="0.1"
                    placeholder="X"
                    value={sceneState.cameraPosition.x}
                    onChange={(e) => updateSceneState({
                      cameraPosition: { ...sceneState.cameraPosition, x: parseFloat(e.target.value) || 0 }
                    })}
                  />
                  <input
                    style={inputStyle}
                    type="number"
                    step="0.1"
                    placeholder="Y"
                    value={sceneState.cameraPosition.y}
                    onChange={(e) => updateSceneState({
                      cameraPosition: { ...sceneState.cameraPosition, y: parseFloat(e.target.value) || 0 }
                    })}
                  />
                  <input
                    style={inputStyle}
                    type="number"
                    step="0.1"
                    placeholder="Z"
                    value={sceneState.cameraPosition.z}
                    onChange={(e) => updateSceneState({
                      cameraPosition: { ...sceneState.cameraPosition, z: parseFloat(e.target.value) || 0 }
                    })}
                  />
                </div>

                <label style={labelStyle}>Target</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px', marginBottom: '8px' }}>
                  <input
                    style={inputStyle}
                    type="number"
                    step="0.1"
                    placeholder="X"
                    value={sceneState.cameraTarget.x}
                    onChange={(e) => updateSceneState({
                      cameraTarget: { ...sceneState.cameraTarget, x: parseFloat(e.target.value) || 0 }
                    })}
                  />
                  <input
                    style={inputStyle}
                    type="number"
                    step="0.1"
                    placeholder="Y"
                    value={sceneState.cameraTarget.y}
                    onChange={(e) => updateSceneState({
                      cameraTarget: { ...sceneState.cameraTarget, y: parseFloat(e.target.value) || 0 }
                    })}
                  />
                  <input
                    style={inputStyle}
                    type="number"
                    step="0.1"
                    placeholder="Z"
                    value={sceneState.cameraTarget.z}
                    onChange={(e) => updateSceneState({
                      cameraTarget: { ...sceneState.cameraTarget, z: parseFloat(e.target.value) || 0 }
                    })}
                  />
                </div>

                <h5 style={{ marginTop: '15px', marginBottom: '10px', fontSize: '11px', color: '#aaa' }}>Lighting</h5>
                <label style={labelStyle}>Ambient Intensity: {sceneState.ambientLight.intensity.toFixed(2)}</label>
                <input
                  style={inputStyle}
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={sceneState.ambientLight.intensity}
                  onChange={(e) => updateSceneState({
                    ambientLight: { ...sceneState.ambientLight, intensity: parseFloat(e.target.value) }
                  })}
                />

                <label style={labelStyle}>Directional Intensity: {sceneState.directionalLight.intensity.toFixed(2)}</label>
                <input
                  style={inputStyle}
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={sceneState.directionalLight.intensity}
                  onChange={(e) => updateSceneState({
                    directionalLight: { ...sceneState.directionalLight, intensity: parseFloat(e.target.value) }
                  })}
                />
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', marginTop: '50px', color: '#888' }}>
              <p style={{ fontSize: '14px', marginBottom: '10px' }}>No object selected</p>
              <p style={{ fontSize: '11px', lineHeight: '1.4' }}>
                Select an object from the hierarchy<br/>
                to edit its properties
              </p>
            </div>
          )}
        </div>      </div>
    </>
  );
});

SceneEditorControls.displayName = 'SceneEditorControls';

export default SceneEditorControls;
