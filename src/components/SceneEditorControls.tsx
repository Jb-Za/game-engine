import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { AssetScanner, GLTFAssetInfo } from '../sceneEditor/AssetScanner';
import { ThumbnailGenerator } from '../sceneEditor/ThumbnailGenerator';
import { Vec3 } from '../math/Vec3';

// Scene Editor Control Interfaces
export interface SceneObjectData {
  id: string;
  name: string;
  type: string;
  position: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  color: { r: number; g: number; b: number; a: number };
  rotation: { x: number; y: number; z: number };
  visible: boolean;
  properties: Record<string, any>;
}

export interface SceneEditorState {
  objects: SceneObjectData[];
  selectedObjectId: string | null;
  cameraPosition: { x: number; y: number; z: number };
  cameraTarget: { x: number; y: number; z: number };
  ambientLight: {
    color: { r: number; g: number; b: number; a: number };
    intensity: number;
  };
  directionalLight: {
    color: { r: number; g: number; b: number; a: number };
    intensity: number;
    direction: { x: number; y: number; z: number };
  };
}

export interface SceneEditorControlsProps {
  onSceneChange: (scene: SceneEditorState) => void;
  onAddObject: (type: 'cube' | 'sphere' | 'light' | 'camera' | 'gltf', data?: any) => void;
  onRemoveObject: (id: string) => void;
  onSelectObject: (id: string | null) => void;
  onSaveScene: () => void;
  onLoadScene: () => void;
  onGetScene?: () => any; // Function to get the current scene instance
}

export interface SceneEditorControlsRef {
  addNewObject: (objectData: SceneObjectData) => void;
  updateSceneState: (newState: SceneEditorState) => void;
  refreshFromScene: () => void; // Method to refresh data from the scene
}

export const SceneEditorControls = forwardRef<SceneEditorControlsRef, SceneEditorControlsProps>(({
  onSceneChange,
  onAddObject,
  onRemoveObject,
  onSelectObject,
  onSaveScene,
  onLoadScene,
  onGetScene
}, ref) => {  const [sceneState, setSceneState] = useState<SceneEditorState>({
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
      direction: { x: 0, y: -1, z: -1 }
    }
  });
  // GLTF asset management state
  const [activeTab, setActiveTab] = useState<'objects' | 'gltf'>('objects');
  const [gltfAssets, setGltfAssets] = useState<GLTFAssetInfo[]>([]);
  const [thumbnailCache, setThumbnailCache] = useState<Map<string, string>>(new Map());
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [generatingThumbnails, setGeneratingThumbnails] = useState<Set<string>>(new Set());
  // Flag to prevent circular updates when refreshing from scene
  const isRefreshingFromScene = useRef(false);
  // State to track if we're viewing scene settings
  const [isViewingSceneSettings, setIsViewingSceneSettings] = useState(false);

  // Numeric input that accepts both comma and dot as decimal separator and commits on blur/Enter
  const NumericInput: React.FC<{
    value: number;
    step?: string;
    placeholder?: string;
    style?: React.CSSProperties;
    onCommit: (v: number) => void;
  }> = ({ value, step, placeholder, style, onCommit }) => {
    const [local, setLocal] = useState<string>(() => String(value));
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
      // Keep local input in sync when external value changes, but don't clobber while user is editing (focused)
      if (document.activeElement !== inputRef.current) {
        setLocal(String(value));
      }
    }, [value]);

    const commit = () => {
      const normalized = local.replace(',', '.');
      const parsed = parseFloat(normalized);
      if (!isNaN(parsed)) {
        onCommit(parsed);
      } else {
        // Revert to the last known numeric value if parsing failed
        setLocal(String(value));
      }
    };

    return (
      <input
        ref={inputRef}
        style={style}
        type="text"
        inputMode="decimal"
        step={step}
        placeholder={placeholder}
        value={local}
        onChange={(e) => {
          const val = e.target.value;
          // Allow empty, '-', '.', '-.', or valid number
          if (/^-?\d*(\.|,)?\d*$/.test(val)) {
            setLocal(val);
          }
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit();
            (e.target as HTMLInputElement).blur();
          } else if (e.key === 'Escape') {
            setLocal(String(value));
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
    );
  };

  // Load GLTF assets on mount
  useEffect(() => {
    loadGLTFAssets();
  }, []);

  // Function to load GLTF assets and generate missing thumbnails
  const loadGLTFAssets = async () => {
    setIsLoadingAssets(true);
    try {
      console.log('Loading GLTF assets...');
      const assets = await AssetScanner.scanGLTFAssets();
      console.log('Found assets:', assets);
      setGltfAssets(assets);

      // Generate missing thumbnails
      for (const asset of assets) {
        if (!asset.thumbnailPath) {
          // Check if we have a cached thumbnail
          const cachedThumbnail = await ThumbnailGenerator.loadThumbnail(asset.name);
          if (cachedThumbnail) {
            setThumbnailCache(prev => new Map(prev.set(asset.name, cachedThumbnail)));
          } else {
            // Generate new thumbnail
            generateThumbnailForAsset(asset);
          }
        } else {
          // Load existing thumbnail
          try {
            const thumbnail = await ThumbnailGenerator.loadThumbnail(asset.name);
            if (thumbnail) {
              setThumbnailCache(prev => new Map(prev.set(asset.name, thumbnail)));
            }
          } catch (error) {
            console.warn(`Could not load thumbnail for ${asset.name}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load GLTF assets:', error);
    } finally {
      setIsLoadingAssets(false);
    }
  };

  // Function to generate thumbnail for a specific asset
  const generateThumbnailForAsset = async (asset: GLTFAssetInfo) => {
    if (generatingThumbnails.has(asset.name)) {
      return; // Already generating
    }

    setGeneratingThumbnails(prev => new Set(prev.add(asset.name)));
    
    try {
      console.log(`Generating thumbnail for: ${asset.name}`);
      const thumbnail = await ThumbnailGenerator.generateThumbnail(asset.path);
      setThumbnailCache(prev => new Map(prev.set(asset.name, thumbnail)));
      
      // Save the thumbnail
      await ThumbnailGenerator.saveThumbnail(thumbnail, asset.path);
      
    } catch (error) {
      console.error(`Failed to generate thumbnail for ${asset.name}:`, error);
    } finally {
      setGeneratingThumbnails(prev => {
        const newSet = new Set(prev);
        newSet.delete(asset.name);
        return newSet;
      });
    }
  };

  // Function to handle adding GLTF object to scene
  const handleAddGLTF = async (asset: GLTFAssetInfo) => {
    console.log('Adding GLTF object to scene:', asset);
    onAddObject('gltf', { filePath: asset.path, name: asset.name });
  };

  // Function to update the actual scene objects from the current UI state
  const updateSceneFromState = (state: SceneEditorState) => {
    if (!onGetScene) return;
    
    const scene = onGetScene();
    if (!scene) return;

    try {
      // Update camera
      const camera = scene.getCamera();
      camera.eye.x = state.cameraPosition.x;
      camera.eye.y = state.cameraPosition.y;
      camera.eye.z = state.cameraPosition.z;
      camera.target.x = state.cameraTarget.x;
      camera.target.y = state.cameraTarget.y;
      camera.target.z = state.cameraTarget.z;

      // Update ambient light
      const ambientLight = scene.getAmbientLight();
      ambientLight.color.r = state.ambientLight.color.r;
      ambientLight.color.g = state.ambientLight.color.g;
      ambientLight.color.b = state.ambientLight.color.b;
      ambientLight.color.a = state.ambientLight.color.a;
      ambientLight.intensity = state.ambientLight.intensity;

      // Update directional light
      const directionalLight = scene.getDirectionalLight();
      directionalLight.color.r = state.directionalLight.color.r;
      directionalLight.color.g = state.directionalLight.color.g;
      directionalLight.color.b = state.directionalLight.color.b;
      directionalLight.color.a = state.directionalLight.color.a;
      directionalLight.intensity = state.directionalLight.intensity;
      directionalLight.direction.x = state.directionalLight.direction.x;
      directionalLight.direction.y = state.directionalLight.direction.y;
      directionalLight.direction.z = state.directionalLight.direction.z;



      const shadowCamera = scene.getShadowCamera();
      const sunRadius = 10;
          const sceneCenter = new Vec3(0, 0, 0);
          // we use directional light to simulate sunlight
  
          const sunPosition = Vec3.add(
              sceneCenter,
              Vec3.scale(directionalLight.direction, -sunRadius)
          );
      shadowCamera.eye = sunPosition;
      shadowCamera.target = sceneCenter;
      shadowCamera.far = Vec3.distance(shadowCamera.eye, shadowCamera.target) * 3.0;

      // Update scene objects
      const sceneObjects = scene.getSceneObjects();
      state.objects.forEach(stateObj => {
        const sceneObj = sceneObjects.objects.get(stateObj.id);
        if (sceneObj) {
          // Update position
          sceneObj.position.x = stateObj.position.x;
          sceneObj.position.y = stateObj.position.y;
          sceneObj.position.z = stateObj.position.z;

          // Update scale
          sceneObj.scale.x = stateObj.scale.x;
          sceneObj.scale.y = stateObj.scale.y;
          sceneObj.scale.z = stateObj.scale.z;

          // Update color
          if (sceneObj.color) {
            sceneObj.color.r = stateObj.color.r;
            sceneObj.color.g = stateObj.color.g;
            sceneObj.color.b = stateObj.color.b;
            sceneObj.color.a = stateObj.color.a;
          }

          // Update rotation (assuming it's a Quaternion or has x,y,z properties)
          if (sceneObj.rotation) {
            sceneObj.rotation.x = stateObj.rotation.x;
            sceneObj.rotation.y = stateObj.rotation.y;
            sceneObj.rotation.z = stateObj.rotation.z;
          }

          // Update visibility
          sceneObj.visible = stateObj.visible;
        }
      });

      console.log('Scene updated from controls');
    } catch (error) {
      console.error('Error updating scene from state:', error);
    }
  };

  // Function to extract scene data from the current scene
  const extractSceneData = (scene: any): SceneEditorState => {
    // Extract camera data
    const camera = scene.getCamera();
    const cameraPosition = camera.eye;
    const cameraTarget = camera.target;

    // Extract lighting data
    const ambientLight = scene.getAmbientLight();
    const directionalLight = scene.getDirectionalLight();

    // Extract scene objects
    const sceneObjects = scene.getSceneObjects();
    const objects: SceneObjectData[] = [];

    // Convert scene objects to SceneObjectData format
    sceneObjects.objects.forEach((obj: any, id: string) => {
      const type = id.split('_')[0].toLowerCase();

      objects.push({
        id: id,
        name: id,
        type: type,
        position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
        scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z },
        color: { 
          r: obj.color?.r ?? 1, 
          g: obj.color?.g ?? 1, 
          b: obj.color?.b ?? 1, 
          a: obj.color?.a ?? 1 
        },
        rotation: { 
          x: obj.rotation?.x ?? 0, 
          y: obj.rotation?.y ?? 0, 
          z: obj.rotation?.z ?? 0 
        },
        visible: obj.visible !== false,
        properties: {}
      });
    });

    return {
      objects: objects,
      selectedObjectId: null,
      cameraPosition: { x: cameraPosition.x, y: cameraPosition.y, z: cameraPosition.z },
      cameraTarget: { x: cameraTarget.x, y: cameraTarget.y, z: cameraTarget.z },
      ambientLight: {
        color: { 
          r: ambientLight.color.r, 
          g: ambientLight.color.g, 
          b: ambientLight.color.b, 
          a: ambientLight.color.a || 1 
        },
        intensity: ambientLight.intensity
      },
      directionalLight: {
        color: { 
          r: directionalLight.color.r, 
          g: directionalLight.color.g, 
          b: directionalLight.color.b, 
          a: directionalLight.color.a || 1 
        },
        intensity: directionalLight.intensity,
        direction: { 
          x: directionalLight.direction.x, 
          y: directionalLight.direction.y, 
          z: directionalLight.direction.z 
        }
      }
    };
  };

  // Function to refresh scene data from the current scene
  const refreshFromScene = () => {
    console.log('refreshFromScene called');
    if (onGetScene) {
      const scene = onGetScene();
      console.log('Scene retrieved:', scene);
      if (scene) {
        isRefreshingFromScene.current = true;
        const newSceneState = extractSceneData(scene);
        console.log('New scene state extracted:', newSceneState);
        setSceneState(newSceneState);
        // Reset flag after state update
        setTimeout(() => {
          isRefreshingFromScene.current = false;
        }, 0);
      }
    }
  };

  // Update parent when scene state changes
  useEffect(() => {
    // Don't update scene objects if we're currently refreshing from scene (prevents circular updates)
    if (!isRefreshingFromScene.current) {
      updateSceneFromState(sceneState);
    }
    
    // Always notify parent component of state changes
    onSceneChange(sceneState);
  }, [sceneState, onSceneChange]);

  // Expose methods to parent component via ref
  useImperativeHandle(ref, () => ({
    addNewObject: (objectData: SceneObjectData) => {
      setSceneState(prev => ({
        ...prev,
        objects: [...prev.objects, objectData]
      }));
    },
    updateSceneState: (newState: SceneEditorState) => {
      setSceneState(newState);
    },
    refreshFromScene: refreshFromScene
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
    setIsViewingSceneSettings(false); // Close scene settings when selecting an object
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

  const handleViewSceneSettings = () => {
    setIsViewingSceneSettings(true);
    setSceneState(prev => ({ ...prev, selectedObjectId: null })); // Deselect any object
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
      <div style={hierarchyPanelStyle}>        {/* Header */}
        <div style={{ padding: '15px', borderBottom: '1px solid #444' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '14px' }}>Scene Hierarchy</h3>
          
          {/* File operations */}
          <div style={{ marginBottom: '15px' }}>
            <button style={buttonStyle} onClick={onSaveScene}>💾 Save</button>
            <button style={buttonStyle} onClick={onLoadScene}>📁 Load</button>
          </div>

          {/* Tab Navigation */}
          <div style={{ display: 'flex', marginBottom: '15px' }}>
            <button 
              style={{ 
                ...buttonStyle, 
                backgroundColor: activeTab === 'objects' ? '#4CAF50' : '#666' 
              }}
              onClick={() => setActiveTab('objects')}
            >
              Objects
            </button>
            <button 
              style={{ 
                ...buttonStyle, 
                backgroundColor: activeTab === 'gltf' ? '#4CAF50' : '#666' 
              }}
              onClick={() => setActiveTab('gltf')}
            >
              GLTF Models
            </button>
          </div>          {/* Objects Tab Content */}
          {activeTab === 'objects' && (
            <div>
              <h4 style={{ marginBottom: '10px', fontSize: '12px' }}>Add Objects</h4>
              <div style={{ marginBottom: '15px' }}>
                <button style={buttonStyle} onClick={() => onAddObject('cube')}>📦 Cube</button>
                <button style={buttonStyle} onClick={() => onAddObject('sphere')}>🔴 Sphere</button>
                <button style={buttonStyle} onClick={() => onAddObject('light')}>💡 Light</button>
                <button style={buttonStyle} onClick={() => onAddObject('camera')}>📷 Camera</button>
              </div>
              
              {/* Scene Settings Button */}
              <h4 style={{ marginBottom: '10px', fontSize: '12px' }}>Scene</h4>
              <div style={{ marginBottom: '15px' }}>
                <button 
                  style={{
                    ...buttonStyle,
                    backgroundColor: isViewingSceneSettings ? '#2196F3' : '#4CAF50',
                    width: '100%'
                  }} 
                  onClick={handleViewSceneSettings}
                >
                  ⚙️ Scene Settings
                </button>
              </div>
            </div>
          )}

          {/* GLTF Tab Content */}
          {activeTab === 'gltf' && (
            <div>
              <h4 style={{ marginBottom: '10px', fontSize: '12px' }}>
                GLTF Assets {isLoadingAssets ? '(Loading...)' : `(${gltfAssets.length})`}
              </h4>
              
              {isLoadingAssets ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
                  <div>🔄 Scanning assets...</div>
                </div>
              ) : (
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(2, 1fr)', 
                  gap: '8px',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {gltfAssets.map(asset => (
                    <div 
                      key={asset.path}
                      style={{
                        border: '1px solid #444',
                        borderRadius: '4px',
                        padding: '8px',
                        cursor: 'pointer',
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        transition: 'background-color 0.2s',
                        position: 'relative'
                      }}
                      onClick={() => handleAddGLTF(asset)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                      }}
                    >
                      {/* Thumbnail */}
                      <div style={{ 
                        width: '100%', 
                        height: '80px', 
                        borderRadius: '2px',
                        backgroundColor: '#333',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '4px',
                        overflow: 'hidden'
                      }}>
                        {generatingThumbnails.has(asset.name) ? (
                          <div style={{ color: '#888', fontSize: '10px', textAlign: 'center' }}>
                            🔄<br/>Generating...
                          </div>
                        ) : thumbnailCache.has(asset.name) ? (
                          <img 
                            src={thumbnailCache.get(asset.name)!}
                            style={{ 
                              width: '100%', 
                              height: '100%', 
                              objectFit: 'cover' 
                            }}
                            alt={asset.name}
                          />
                        ) : (
                          <div style={{ color: '#666', fontSize: '24px' }}>
                            📦
                          </div>
                        )}
                      </div>
                      
                      {/* Asset Info */}
                      <div style={{ fontSize: '10px', textAlign: 'center' }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
                          {asset.name}
                        </div>
                        <div style={{ color: '#888', fontSize: '9px' }}>
                          {asset.hasAnimation && '🎬 '}{(asset.size / 1024).toFixed(0)}KB
                        </div>
                      </div>

                      {/* Generate thumbnail button */}
                      {!thumbnailCache.has(asset.name) && !generatingThumbnails.has(asset.name) && (
                        <button
                          style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            width: '20px',
                            height: '20px',
                            border: 'none',
                            borderRadius: '2px',
                            backgroundColor: 'rgba(76, 175, 80, 0.8)',
                            color: 'white',
                            fontSize: '10px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            generateThumbnailForAsset(asset);
                          }}
                          title="Generate thumbnail"
                        >
                          📷
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {gltfAssets.length === 0 && !isLoadingAssets && (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '20px', 
                  color: '#888',
                  fontSize: '11px',
                  lineHeight: '1.4'
                }}>
                  No GLTF assets found.<br/>
                  Place .glb or .gltf files in:<br/>
                  <code style={{ color: '#aaa' }}>/assets/gltf</code>
                </div>
              )}
            </div>
          )}
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
              >                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px' }}>
                    {obj.type === 'cube' ? '📦' : obj.type === 'sphere' ? '🔴' : obj.type === 'light' ? '💡' : obj.type === 'camera' ? '📷' : obj.type === 'gltf' ? '🎯' : '📦'}
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
      <div style={propertiesPanelStyle}>        {/* Header */}
        <div style={{ padding: '15px', borderBottom: '1px solid #444' }}>
          <h3 style={{ margin: '0', fontSize: '14px' }}>
            {isViewingSceneSettings ? 'Scene Settings' : selectedObject ? `Properties - ${selectedObject.name}` : 'Properties'}
          </h3>
        </div>        {/* Content */}
        <div style={{ flex: 1, padding: '15px', overflowY: 'auto' }}>
          {isViewingSceneSettings ? (
            <div>
              {/* Scene Settings */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '10px', fontSize: '12px', color: '#ccc' }}>CAMERA</h4>
                
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
              </div>

              {/* Lighting Settings */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '10px', fontSize: '12px', color: '#ccc' }}>LIGHTING</h4>
                
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

                <label style={labelStyle}>Ambient Color</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
                  <input
                    type="color"
                    value={`#${Math.round(sceneState.ambientLight.color.r * 255).toString(16).padStart(2, '0')}${Math.round(sceneState.ambientLight.color.g * 255).toString(16).padStart(2, '0')}${Math.round(sceneState.ambientLight.color.b * 255).toString(16).padStart(2, '0')}`}
                    onChange={(e) => {
                      const hex = e.target.value;
                      const r = parseInt(hex.slice(1, 3), 16) / 255;
                      const g = parseInt(hex.slice(3, 5), 16) / 255;
                      const b = parseInt(hex.slice(5, 7), 16) / 255;
                      updateSceneState({
                        ambientLight: { 
                          ...sceneState.ambientLight, 
                          color: { ...sceneState.ambientLight.color, r, g, b }
                        }
                      });
                    }}
                    style={{
                      width: '60px',
                      height: '30px',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      backgroundColor: 'transparent'
                    }}
                  />
                </div>

                <label style={labelStyle}>Directional Color</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
                  <input
                    type="color"
                    value={`#${Math.round(sceneState.directionalLight.color.r * 255).toString(16).padStart(2, '0')}${Math.round(sceneState.directionalLight.color.g * 255).toString(16).padStart(2, '0')}${Math.round(sceneState.directionalLight.color.b * 255).toString(16).padStart(2, '0')}`}
                    onChange={(e) => {
                      const hex = e.target.value;
                      const r = parseInt(hex.slice(1, 3), 16) / 255;
                      const g = parseInt(hex.slice(3, 5), 16) / 255;
                      const b = parseInt(hex.slice(5, 7), 16) / 255;
                      updateSceneState({
                        directionalLight: { 
                          ...sceneState.directionalLight, 
                          color: { ...sceneState.directionalLight.color, r, g, b }
                        }
                      });
                    }}
                    style={{
                      width: '60px',
                      height: '30px',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      backgroundColor: 'transparent'
                    }}
                  />
                </div>

                <label style={labelStyle}>Directional Light Direction</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px', marginBottom: '8px' }}>
                  <input
                    style={inputStyle}
                    type="number"
                    step="0.1"
                    min={-1}
                    max={1}
                    placeholder="X"
                    value={sceneState.directionalLight.direction.x}
                    onChange={(e) => updateSceneState({
                      directionalLight: { 
                        ...sceneState.directionalLight, 
                        direction: { ...sceneState.directionalLight.direction, x: parseFloat(e.target.value) || 0 }
                      }
                    })}
                  />
                  <input
                    style={inputStyle}
                    type="number"
                    step="0.1"
                    min={-1}
                    max={1}
                    placeholder="Y"
                    value={sceneState.directionalLight.direction.y}
                    onChange={(e) => updateSceneState({
                      directionalLight: { 
                        ...sceneState.directionalLight, 
                        direction: { ...sceneState.directionalLight.direction, y: parseFloat(e.target.value) || 0 }
                      }
                    })}
                  />
                  <input
                    style={inputStyle}
                    type="number"
                    step="0.1"
                    min={-1}
                    max={1}
                    placeholder="Z"
                    value={sceneState.directionalLight.direction.z}
                    onChange={(e) => updateSceneState({
                      directionalLight: { 
                        ...sceneState.directionalLight, 
                        direction: { ...sceneState.directionalLight.direction, z: parseFloat(e.target.value) || 0 }
                      }
                    })}
                  />
                </div>
              </div>
            </div>
          ) : selectedObject ? (
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
                    step="0.01"
                    placeholder="X"
                    value={selectedObject.scale.x}
                    onChange={(e) => updateObject(selectedObject.id, { scale: { ...selectedObject.scale, x: parseFloat(e.target.value) || 0 } })}
                  />
                  <input
                    style={inputStyle}
                    type="number"
                    step="0.01"
                    placeholder="Y"
                    value={selectedObject.scale.y}
                    onChange={(e) => updateObject(selectedObject.id, { scale: { ...selectedObject.scale, y: parseFloat(e.target.value) || 0 } })}
                  />
                  <input
                    style={inputStyle}
                    type="number"                    
                    step="0.01"
                    placeholder="Z"
                    value={selectedObject.scale.z}
                    onChange={(e) => updateObject(selectedObject.id, { scale: { ...selectedObject.scale, z: parseFloat(e.target.value) || 0 } })}
                  />
                </div>

                <label style={labelStyle}>Rotation (degrees)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px', marginBottom: '8px' }}>
                  <input
                    style={inputStyle}
                    type="number"
                    step="1"
                    placeholder="X"
                    value={selectedObject.rotation.x * (180 / Math.PI)}
                    onChange={(e) => updateObject(selectedObject.id, { 
                      rotation: { ...selectedObject.rotation, x: parseFloat(e.target.value) * (Math.PI / 180) } 
                    })}
                  />
                  <input
                    style={inputStyle}
                    type="number"
                    step="1"
                    placeholder="Y"
                    value={selectedObject.rotation.y * (180 / Math.PI)}
                    onChange={(e) => updateObject(selectedObject.id, { 
                      rotation: { ...selectedObject.rotation, y: parseFloat(e.target.value) * (Math.PI / 180) } 
                    })}
                  />
                  <input
                    style={inputStyle}
                    type="number"
                    step="1"
                    placeholder="Z"
                    value={selectedObject.rotation.z * (180 / Math.PI)}
                    onChange={(e) => updateObject(selectedObject.id, { 
                      rotation: { ...selectedObject.rotation, z: parseFloat(e.target.value) * (Math.PI / 180) } 
                    })}
                  />
                </div>
              </div>{/* Appearance */}
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

                {selectedObject.type !== 'gltf' && (
                  <>
                    <label style={labelStyle}>Color</label>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
                      <input
                        type="color"
                        value={`#${Math.round(selectedObject.color.r * 255).toString(16).padStart(2, '0')}${Math.round(selectedObject.color.g * 255).toString(16).padStart(2, '0')}${Math.round(selectedObject.color.b * 255).toString(16).padStart(2, '0')}`}
                        onChange={(e) => {
                          const hex = e.target.value;
                          const r = parseInt(hex.slice(1, 3), 16) / 255;
                          const g = parseInt(hex.slice(3, 5), 16) / 255;
                          const b = parseInt(hex.slice(5, 7), 16) / 255;
                          updateObject(selectedObject.id, {
                            color: { ...selectedObject.color, r, g, b }
                          });
                        }}
                        style={{
                          width: '60px',
                          height: '30px',
                          border: '1px solid rgba(255, 255, 255, 0.3)',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          backgroundColor: 'transparent'
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <label style={{ ...labelStyle, fontSize: '9px', marginBottom: '4px' }}>
                          Opacity: {selectedObject.color.a.toFixed(2)}
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={selectedObject.color.a}
                          onChange={(e) => updateObject(selectedObject.id, {
                            color: { ...selectedObject.color, a: parseFloat(e.target.value) }
                          })}
                          style={{
                            width: '100%',
                            height: '20px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: '10px',
                            outline: 'none',
                            cursor: 'pointer'
                          }}
                        />
                      </div>
                    </div>
                  </>
                )}              </div>

              {/* GLTF Animation Controls */}
              {selectedObject.type === 'gltf' && (
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ marginBottom: '10px', fontSize: '12px', color: '#ccc' }}>ANIMATION</h4>
                  
                  <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                    <input
                      type="checkbox"
                      checked={selectedObject.properties?.animationEnabled !== false}
                      onChange={(e) => {
                        updateObject(selectedObject.id, { 
                          properties: { 
                            ...selectedObject.properties, 
                            animationEnabled: e.target.checked 
                          } 
                        });
                          // Update the actual GLTF object's animation player
                        if (onGetScene) {
                          const scene = onGetScene();
                          if (scene) {
                            const sceneObjects = scene.getSceneObjects();
                            const gltfObject = sceneObjects.objects.get(selectedObject.id);                            
                            if (gltfObject && gltfObject.animationPlayer) {
                              if (e.target.checked) {
                                // Resume animation by setting speed back to normal
                                gltfObject.setAnimationSpeed(selectedObject.properties?.animationSpeed || 0.5);
                                gltfObject.setSkinMode(0);
                              } else {
                                // Disable animation and reset to bind pose
                                gltfObject.setAnimationSpeed(0);
                                gltfObject.setSkinMode(1);
                              }
                            }
                          }
                        }
                      }}
                      style={{ marginRight: '8px' }}
                    />
                    Enable Animation
                  </label>

                  {/* Animation List */}
                  <label style={labelStyle}>Available Animations</label>
                  <div style={{ marginBottom: '12px' }}>
                    {(() => {
                      // Get the GLTF object and its animations
                      if (onGetScene) {
                        const scene = onGetScene();
                        if (scene) {
                          const sceneObjects = scene.getSceneObjects();
                          const gltfObject = sceneObjects.objects.get(selectedObject.id);
                          if (gltfObject && gltfObject.gltfScene && gltfObject.gltfScene.animations) {
                            const animations = gltfObject.gltfScene.animations.map((a: any, i: number) => a.name || `Animation ${i}`);
                            
                            if (animations.length > 0) {
                              return (
                                <select
                                  style={{
                                    ...inputStyle,
                                    cursor: 'pointer',
                                    backgroundColor: 'rgb(17, 17, 17)'
                                  }}
                                  value={selectedObject.properties?.selectedAnimation || animations[0]}
                                  onChange={(e) => {
                                    const animationName = e.target.value;
                                    updateObject(selectedObject.id, { 
                                      properties: { 
                                        ...selectedObject.properties, 
                                        selectedAnimation: animationName 
                                      } 
                                    });
                                    
                                    // Update the actual GLTF object's active animation
                                    if (gltfObject.setActiveAnimationByName) {
                                      gltfObject.setActiveAnimationByName(animationName);
                                    }
                                  }}
                                >
                                  {animations.map((animName: string) => (
                                    <option key={animName} value={animName}>{animName}</option>
                                  ))}
                                </select>
                              );
                            } else {
                              return (
                                <div style={{ 
                                  ...inputStyle, 
                                  backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                                  padding: '8px',
                                  textAlign: 'center',
                                  fontStyle: 'italic',
                                  color: '#888'
                                }}>
                                  No animations available
                                </div>
                              );
                            }
                          }
                        }
                      }
                      
                      return (
                        <div style={{ 
                          ...inputStyle, 
                          backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                          padding: '8px',
                          textAlign: 'center',
                          fontStyle: 'italic',
                          color: '#888'
                        }}>
                          Loading...
                        </div>
                      );
                    })()}
                  </div>

                  {/* Animation Speed */}
                  <label style={labelStyle}>
                    Animation Speed: {((selectedObject.properties?.animationSpeed || 0) * 100).toFixed(0)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={selectedObject.properties?.animationSpeed || 0}
                    onChange={(e) => {
                      const speed = parseFloat(e.target.value);
                      updateObject(selectedObject.id, { 
                        properties: { 
                          ...selectedObject.properties, 
                          animationSpeed: speed 
                        } 
                      });
                      
                      // Update the actual GLTF object's animation speed
                      if (onGetScene) {
                        const scene = onGetScene();
                        if (scene) {
                          const sceneObjects = scene.getSceneObjects();
                          const gltfObject = sceneObjects.objects.get(selectedObject.id);
                          if (gltfObject && gltfObject.setAnimationSpeed) {
                            // Only set speed if animation is enabled
                            const isEnabled = selectedObject.properties?.animationEnabled !== false;
                            gltfObject.setAnimationSpeed(isEnabled ? speed : 0);
                          }
                        }
                      }
                    }}
                    style={{
                      width: '100%',
                      height: '20px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '10px',
                      outline: 'none',
                      cursor: 'pointer',
                      marginBottom: '8px'                    }}
                  />
                </div>
              )}
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
