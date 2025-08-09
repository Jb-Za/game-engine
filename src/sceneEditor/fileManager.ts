// Scene File I/O Functions
import { getSceneObjects } from "./sceneState";

export function saveScene(): string {
  const sceneObjects = getSceneObjects();
  if (!sceneObjects) return '{}';

  const sceneData = {
    objects: Array.from(sceneObjects.objectDataMap.entries()).map(([id, gameObject]) => ({
      id,
      name: `Object ${id}`, // You might want to store names separately
      type: 'cube', // You'd need to determine this from the game object
      position: gameObject.position,
      scale: gameObject.scale,
      color: gameObject.color,
      visible: gameObject.visible || true,
      properties: {}
    })),
    camera: {
      position: sceneObjects.camera.eye,
      target: sceneObjects.camera.target
    },
    ambientLight: {
      color: sceneObjects.ambientLight.color,
      intensity: sceneObjects.ambientLight.intensity
    },
    directionalLight: {
      color: sceneObjects.directionalLight.color,
      intensity: sceneObjects.directionalLight.intensity,
      direction: sceneObjects.directionalLight.direction
    }
  };

  const jsonString = JSON.stringify(sceneData, null, 2);
  
  // Save to file
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'scene.json';
  a.click();
  URL.revokeObjectURL(url);

  return jsonString;
}

export function loadScene() {
  // Create file input
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.style.display = 'none';
  
  input.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const sceneData = JSON.parse(e.target?.result as string);
          // TODO: Implement scene loading logic
          console.log('Scene data loaded:', sceneData);
        } catch (error) {
          console.error('Failed to load scene:', error);
        }
      };
      reader.readAsText(file);
    }
  });
  
  document.body.appendChild(input);
  input.click();
  document.body.removeChild(input);
}
