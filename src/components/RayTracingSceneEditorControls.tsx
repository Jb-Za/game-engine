import { useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import { RayTracingScene } from '../raytracingScene/RayTracingScene';
import { Vec3 } from '../math/Vec3';
import { Vec2 } from '../math/Vec2';

export interface RayTracingObjectData {
  id: string;
  name: string;
  type: 'sphere' | 'plane';
  position: { x: number; y: number; z: number };
  radius?: number; // For spheres
  normal?: { x: number; y: number; z: number }; // For planes
  size?: { x: number; y: number }; // For planes
  material: {
    color: { r: number; g: number; b: number };
    roughness: number;
    emissionStrength: number;
    emissionColor?: { r: number; g: number; b: number };
    reflectivity?: number;
    indexOfRefraction?: number;
  };
}

export interface RayTracingSceneEditorState {
  objects: RayTracingObjectData[];
  selectedObjectId: string | null;
  cameraPosition: { x: number; y: number; z: number };
  cameraTarget: { x: number; y: number; z: number };
}

export interface RayTracingSceneEditorControlsProps {
  onSceneChange: (scene: RayTracingSceneEditorState) => void;
  onAddObject: (type: 'sphere' | 'plane') => void;
  onRemoveObject: (id: string) => void;
  onGetScene?: () => RayTracingScene | null;
}

export interface RayTracingSceneEditorControlsRef {
  refreshFromScene: () => void;
}

export const RayTracingSceneEditorControls = forwardRef<RayTracingSceneEditorControlsRef, RayTracingSceneEditorControlsProps>(({
  onSceneChange,
  onAddObject,
  onRemoveObject,
  onGetScene
}, ref) => {
  const [sceneState, setSceneState] = useState<RayTracingSceneEditorState>({
    objects: [],
    selectedObjectId: null,
    cameraPosition: { x: -0.2, y: 1.36, z: 2.59 },
    cameraTarget: { x: -0.59, y: 1.0, z: 1.73 }
  });

  const [isRefreshingFromScene, setIsRefreshingFromScene] = useState(false);

  // Extract scene data from RayTracingScene
  const extractSceneData = (): RayTracingSceneEditorState | null => {
    if (!onGetScene) return null;
    
    const scene = onGetScene();
    if (!scene) return null;

    try {
      const camera = scene.getCamera();
      const spheres = scene.getSpheres();
      const planes = scene.getPlanes();

      const objects: RayTracingObjectData[] = [];

      // Convert spheres
      spheres.forEach(sphere => {
        objects.push({
          id: sphere.id,
          name: sphere.id || 'Sphere',
          type: 'sphere',
          position: { x: sphere.center.x, y: sphere.center.y, z: sphere.center.z },
          radius: sphere.radius,
          material: {
            color: { r: sphere.material.color.x, g: sphere.material.color.y, b: sphere.material.color.z },
            roughness: sphere.material.roughness ?? 0,
            emissionStrength: sphere.material.emissionStrength ?? 0,
            emissionColor: sphere.material.emissionColor ? {
              r: sphere.material.emissionColor.x,
              g: sphere.material.emissionColor.y,
              b: sphere.material.emissionColor.z
            } : undefined,
            reflectivity: sphere.material.reflectivity,
            indexOfRefraction: sphere.material.indexOfRefraction
          }
        });
      });

      // Convert planes
      planes.forEach(plane => {
        objects.push({
          id: plane.id,
          name: plane.id || 'Plane',
          type: 'plane',
          position: { x: plane.position.x, y: plane.position.y, z: plane.position.z },
          normal: { x: plane.normal.x, y: plane.normal.y, z: plane.normal.z },
          size: { x: plane.size.x, y: plane.size.y },
          material: {
            color: { r: plane.material.color.x, g: plane.material.color.y, b: plane.material.color.z },
            roughness: plane.material.roughness ?? 0,
            emissionStrength: plane.material.emissionStrength ?? 0
          }
        });
      });

      return {
        objects,
        selectedObjectId: null,
        cameraPosition: { x: camera.eye.x, y: camera.eye.y, z: camera.eye.z },
        cameraTarget: { x: camera.target.x, y: camera.target.y, z: camera.target.z }
      };
    } catch (error) {
      console.error('Error extracting raytracing scene data:', error);
      return null;
    }
  };

  const refreshFromScene = () => {
    console.log('Refreshing raytracing scene editor from scene');
    setIsRefreshingFromScene(true);
    const newSceneData = extractSceneData();
    if (newSceneData) {
      setSceneState(newSceneData);
    }
    setIsRefreshingFromScene(false);
  };

  // Update scene from state changes
  const updateSceneFromState = () => {
    if (!onGetScene || isRefreshingFromScene) return;
    
    const scene = onGetScene();
    if (!scene) return;

    // Update spheres and planes based on current state
    sceneState.objects.forEach(obj => {
      if (obj.type === 'sphere') {
        scene.updateSphere(obj.id, {
          id: obj.id,
          center: new Vec3(obj.position.x, obj.position.y, obj.position.z),
          radius: obj.radius || 0.5,
          material: {
            color: new Vec3(obj.material.color.r, obj.material.color.g, obj.material.color.b),
            roughness: obj.material.roughness,
            emissionStrength: obj.material.emissionStrength,
            emissionColor: obj.material.emissionColor ? 
              new Vec3(obj.material.emissionColor.r, obj.material.emissionColor.g, obj.material.emissionColor.b) : 
              undefined,
            reflectivity: obj.material.reflectivity,
            indexOfRefraction: obj.material.indexOfRefraction
          }
        });
      } else if (obj.type === 'plane') {
        scene.updatePlane(obj.id, {
          id: obj.id,
          position: new Vec3(obj.position.x, obj.position.y, obj.position.z),
          normal: obj.normal ? new Vec3(obj.normal.x, obj.normal.y, obj.normal.z) : new Vec3(0, 1, 0),
          size: obj.size ? new Vec2(obj.size.x, obj.size.y) : new Vec2(5, 5),
          material: {
            color: new Vec3(obj.material.color.r, obj.material.color.g, obj.material.color.b),
            roughness: obj.material.roughness,
            emissionStrength: obj.material.emissionStrength
          }
        });
      }
    });
  };

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    refreshFromScene
  }));

  // Update scene when state changes and notify parent
  useEffect(() => {
    if (!isRefreshingFromScene) {
      updateSceneFromState();
    }
    onSceneChange(sceneState);
  }, [sceneState]);

  const selectedObject = sceneState.objects.find(obj => obj.id === sceneState.selectedObjectId);

  // Helper functions for styling - matching SceneEditorControls
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
    overflow: 'hidden'
  };

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

  function updateObjectProperty(property: string, subProperty: string | null, value: any) {
    setSceneState(prev => ({
      ...prev,
      objects: prev.objects.map(obj => {
        if (obj.id !== selectedObject?.id) return obj;
        
        let updatedObj = {
          ...obj,
          [property]: subProperty 
            ? { ...(obj[property as keyof typeof obj] as any), [subProperty]: value }
            : value
        };

        // Apply material property constraints for spheres only
        if (obj.type === 'sphere' && property === 'material') {
          const material = updatedObj.material;
          
          // If setting reflectivity > 0, reset emission and refraction
          if (subProperty === 'reflectivity' && value > 0) {
            material.emissionStrength = 0;
            material.indexOfRefraction = 0;
          }
          
          // If setting reflectivity to 0, also reset roughness to 0
          if (subProperty === 'reflectivity' && value === 0) {
            material.roughness = 0;
          }
          
          // If setting refraction > 0, reset emission, reflection, and roughness
          if (subProperty === 'indexOfRefraction' && value > 0) {
            material.emissionStrength = 0;
            material.reflectivity = 0;
            material.roughness = 0;
          }
          
          // If setting emission > 0, reset reflection and refraction
          if (subProperty === 'emissionStrength' && value > 0) {
            material.reflectivity = 0;
            material.indexOfRefraction = 0;
          }
        }
        
        return updatedObj;
      })
    }));
  }

  function updateMaterialColor(hexColor: string) {
    const rgb = hexToRgb(hexColor);
    if (rgb && selectedObject) {
      setSceneState(prev => ({
        ...prev,
        objects: prev.objects.map(obj => 
          obj.id === selectedObject.id 
            ? {
                ...obj,
                material: {
                  ...obj.material,
                  color: { r: rgb.r, g: rgb.g, b: rgb.b }
                }
              }
            : obj
        )
      }));
    }
  }

  function updateMaterialEmissionColor(hexColor: string) {
    const rgb = hexToRgb(hexColor);
    if (rgb && selectedObject) {
      setSceneState(prev => ({
        ...prev,
        objects: prev.objects.map(obj => 
          obj.id === selectedObject.id 
            ? {
                ...obj,
                material: {
                  ...obj.material,
                  emissionColor: { r: rgb.r, g: rgb.g, b: rgb.b }
                }
              }
            : obj
        )
      }));
    }
  }

  function rgbToHex(rgb: { r: number; g: number; b: number }): string {
    return `#${Math.round(rgb.r * 255).toString(16).padStart(2, '0')}${Math.round(rgb.g * 255).toString(16).padStart(2, '0')}${Math.round(rgb.b * 255).toString(16).padStart(2, '0')}`;
  }

  function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255
    } : null;
  }

  return (
    <>
      {/* Hierarchy Panel - Left Side */}
      <div style={hierarchyPanelStyle}>
        {/* Header */}
        <div style={{ padding: '15px', borderBottom: '1px solid #444' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '14px' }}>Ray Tracing Scene</h3>
          
          {/* Add objects section */}
          <h4 style={{ marginBottom: '10px', fontSize: '12px' }}>Add Objects</h4>
          <div style={{ marginBottom: '15px' }}>
            <button style={buttonStyle} onClick={() => onAddObject('sphere')}>🔴 Sphere</button>
            {/*<button style={buttonStyle} onClick={() => onAddObject('plane')}>⬜ Plane</button>*/}
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
                onClick={() => setSceneState(prev => ({ ...prev, selectedObjectId: obj.id }))}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px' }}>
                    {obj.type === 'sphere' ? '🔴' : '⬜'}
                  </span>
                  <span>{obj.name}</span>
                  {obj.material.emissionStrength > 0 && <span style={{ color: '#FFD700', fontSize: '10px' }}>✨</span>}
                </div>
                <button
                  style={deleteButtonStyle}
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    onRemoveObject(obj.id); 
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
                  onChange={(e) => updateObjectProperty('name', null, e.target.value)}
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
                    onChange={(e) => updateObjectProperty('position', 'x', parseFloat(e.target.value))}
                  />
                  <input
                    style={inputStyle}
                    type="number"
                    step="0.1"
                    placeholder="Y"
                    value={selectedObject.position.y}
                    onChange={(e) => updateObjectProperty('position', 'y', parseFloat(e.target.value))}
                  />
                  <input
                    style={inputStyle}
                    type="number"
                    step="0.1"
                    placeholder="Z"
                    value={selectedObject.position.z}
                    onChange={(e) => updateObjectProperty('position', 'z', parseFloat(e.target.value))}
                  />
                </div>

                {/* Sphere-specific properties */}
                {selectedObject.type === 'sphere' && (
                  <div>
                    <label style={labelStyle}>Radius</label>
                    <input
                      style={inputStyle}
                      type="number"
                      step="0.1"
                      value={selectedObject.radius || 0.5}
                      onChange={(e) => updateObjectProperty('radius', null, parseFloat(e.target.value))}
                    />
                  </div>
                )}

                {/* Plane-specific properties */}
                {selectedObject.type === 'plane' && (
                  <>
                    <label style={labelStyle}>Normal</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px', marginBottom: '8px' }}>
                      <input
                        style={inputStyle}
                        type="number"
                        step="0.1"
                        placeholder="X"
                        value={selectedObject.normal?.x || 0}
                        onChange={(e) => updateObjectProperty('normal', 'x', parseFloat(e.target.value))}
                      />
                      <input
                        style={inputStyle}
                        type="number"
                        step="0.1"
                        placeholder="Y"
                        value={selectedObject.normal?.y || 1}
                        onChange={(e) => updateObjectProperty('normal', 'y', parseFloat(e.target.value))}
                      />
                      <input
                        style={inputStyle}
                        type="number"
                        step="0.1"
                        placeholder="Z"
                        value={selectedObject.normal?.z || 0}
                        onChange={(e) => updateObjectProperty('normal', 'z', parseFloat(e.target.value))}
                      />
                    </div>
                    
                    <label style={labelStyle}>Size</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginBottom: '8px' }}>
                      <input
                        style={inputStyle}
                        type="number"
                        step="0.1"
                        placeholder="Width"
                        value={selectedObject.size?.x || 5}
                        onChange={(e) => updateObjectProperty('size', 'x', parseFloat(e.target.value))}
                      />
                      <input
                        style={inputStyle}
                        type="number"
                        step="0.1"
                        placeholder="Height"
                        value={selectedObject.size?.y || 5}
                        onChange={(e) => updateObjectProperty('size', 'y', parseFloat(e.target.value))}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Material Properties */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '10px', fontSize: '12px', color: '#ccc' }}>MATERIAL</h4>
                
                <label style={labelStyle}>Color</label>
                <input
                  type="color"
                  value={rgbToHex(selectedObject.material.color)}
                  onChange={(e) => updateMaterialColor(e.target.value)}
                  style={{
                    width: '100%',
                    height: '30px',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    backgroundColor: 'transparent',
                    marginBottom: '12px'
                  }}
                />

                <label style={labelStyle}>Emission Strength: {selectedObject.material.emissionStrength.toFixed(1)}</label>
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="0.1"
                  value={selectedObject.material.emissionStrength}
                  onChange={(e) => updateObjectProperty('material', 'emissionStrength', parseFloat(e.target.value))}
                  disabled={selectedObject.type === 'sphere' && (selectedObject.material.reflectivity! > 0 || selectedObject.material.indexOfRefraction! > 0)}
                  style={{
                    width: '100%',
                    height: '20px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    outline: 'none',
                    cursor: (selectedObject.type === 'sphere' && (selectedObject.material.reflectivity! > 0 || selectedObject.material.indexOfRefraction! > 0)) ? 'not-allowed' : 'pointer',
                    marginBottom: '12px'
                  }}
                />

                {/* Emission Color - only show if emission strength > 0 */}
                {selectedObject.material.emissionStrength > 0 && (
                  <>
                    <label style={labelStyle}>Emission Color</label>
                    <input
                      type="color"
                      value={rgbToHex(selectedObject.material.emissionColor || selectedObject.material.color)}
                      onChange={(e) => updateMaterialEmissionColor(e.target.value)}
                      style={{
                        width: '100%',
                        height: '30px',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        backgroundColor: 'transparent',
                        marginBottom: '12px'
                      }}
                    />
                  </>
                )}

                {/* Advanced material properties for spheres */}
                {selectedObject.type === 'sphere' && (
                  <>
                    {selectedObject.material.reflectivity !== undefined && (
                      <div style={{ marginBottom: '12px' }}>
                        <label style={labelStyle}>Reflectivity: {selectedObject.material.reflectivity.toFixed(2)}</label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={selectedObject.material.reflectivity}
                          onChange={(e) => updateObjectProperty('material', 'reflectivity', parseFloat(e.target.value))}
                          disabled={selectedObject.material.emissionStrength > 0 || selectedObject.material.indexOfRefraction! > 0}
                          style={{
                            width: '100%',
                            height: '20px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: '10px',
                            outline: 'none',
                            cursor: (selectedObject.material.emissionStrength > 0 || selectedObject.material.indexOfRefraction! > 0) ? 'not-allowed' : 'pointer'
                          }}
                        />
                        <label style={labelStyle}>Roughness: {selectedObject.material.roughness.toFixed(2)}</label>
                        <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={selectedObject.material.roughness}
                        onChange={(e) => updateObjectProperty('material', 'roughness', parseFloat(e.target.value))}
                        disabled={selectedObject.material.reflectivity === 0 || selectedObject.material.emissionStrength > 0 || selectedObject.material.indexOfRefraction! > 0}
                        style={{
                            width: '100%',
                            height: '20px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: '10px',
                            outline: 'none',
                            cursor: (selectedObject.material.reflectivity === 0 || selectedObject.material.emissionStrength > 0 || selectedObject.material.indexOfRefraction! > 0) ? 'not-allowed' : 'pointer',
                            marginBottom: '12px'
                        }}
                        />
                      </div>
                    )}
                    
                    {selectedObject.material.indexOfRefraction !== undefined && (
                      <div style={{ marginBottom: '12px' }}>
                        <label style={labelStyle}>Index of Refraction: {selectedObject.material.indexOfRefraction.toFixed(1)}</label>
                        <input
                          type="range"
                          min="0"
                          max="3"
                          step="0.1"
                          value={selectedObject.material.indexOfRefraction}
                          onChange={(e) => updateObjectProperty('material', 'indexOfRefraction', parseFloat(e.target.value))}
                          disabled={selectedObject.material.emissionStrength > 0 || selectedObject.material.reflectivity! > 0}
                          style={{
                            width: '100%',
                            height: '20px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: '10px',
                            outline: 'none',
                            cursor: (selectedObject.material.emissionStrength > 0 || selectedObject.material.reflectivity! > 0) ? 'not-allowed' : 'pointer'
                          }}
                        />
                      </div>
                    )}
                  </>
                )}
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
        </div>
      </div>
    </>
  );
});

export default RayTracingSceneEditorControls;
