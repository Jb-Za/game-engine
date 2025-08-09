// Scene Object Management Functions
import { Vec3 } from "../math/Vec3";
import { Color } from "../math/Color";
import type { SceneObjectData, SceneRenderContext } from "./Interfaces";
import { getSceneObjects } from "./sceneState";

export function addObject(type: 'cube' | 'sphere' | 'light' | 'camera'): SceneObjectData | null {
  const sceneObjects = getSceneObjects();
  if (!sceneObjects) return null;

  const id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  let gameObject: any = null;

  const objectData: SceneObjectData = {
    id,
    name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${sceneObjects.objectDataMap.size + 1}`,
    type,
    position: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    color: { r: 0.8, g: 0.8, b: 0.8, a: 1 },
    visible: true,
    properties: {}
  };

  const renderContext: SceneRenderContext = {
    device: sceneObjects.device,
    camera: sceneObjects.camera,
    shadowCamera: sceneObjects.shadowCamera,
    ambientLight: sceneObjects.ambientLight,
    directionalLight: sceneObjects.directionalLight,
    pointLights: sceneObjects.pointLights
  };

  try {
    switch (type) {
      case 'cube':
        gameObject = sceneObjects.objectMap.createCube(renderContext, sceneObjects.shadowTexture, false);
        break;
      case 'sphere':
        gameObject = sceneObjects.objectMap.createSphere(renderContext, sceneObjects.shadowTexture, false);
        break;
      case 'light':
        // For now, we'll just create a small sphere to represent the light
        gameObject = sceneObjects.objectMap.createSphere(renderContext, sceneObjects.shadowTexture, false);
        gameObject.scale = new Vec3(0.2, 0.2, 0.2);
        gameObject.color = new Color(1, 1, 0, 1); // Yellow for light
        objectData.color = { r: 1, g: 1, b: 0, a: 1 };
        objectData.scale = { x: 0.2, y: 0.2, z: 0.2 };
        break;
      case 'camera':
        // For now, we'll just create a small cube to represent the camera
        gameObject = sceneObjects.objectMap.createCube(renderContext, sceneObjects.shadowTexture, false);
        gameObject.scale = new Vec3(0.3, 0.2, 0.4);
        gameObject.color = new Color(0, 0, 1, 1); // Blue for camera
        objectData.color = { r: 0, g: 0, b: 1, a: 1 };
        objectData.scale = { x: 0.3, y: 0.2, z: 0.4 };
        break;
    }

    if (gameObject) {
      // Set initial properties
      gameObject.position = new Vec3(objectData.position.x, objectData.position.y, objectData.position.z);
      gameObject.scale = new Vec3(objectData.scale.x, objectData.scale.y, objectData.scale.z);
      gameObject.color = new Color(objectData.color.r, objectData.color.g, objectData.color.b, objectData.color.a);

      // Add to collections
      sceneObjects.gameObjects.push(gameObject);
      sceneObjects.objectDataMap.set(id, gameObject);

      return objectData;
    }
  } catch (error) {
    console.error('Failed to create object:', error);
  }

  return null;
}

export function removeObject(id: string) {
  const sceneObjects = getSceneObjects();
  if (!sceneObjects) return;

  const gameObject = sceneObjects.objectDataMap.get(id);
  if (gameObject) {
    // Remove from game objects array
    const index = sceneObjects.gameObjects.indexOf(gameObject);
    if (index > -1) {
      sceneObjects.gameObjects.splice(index, 1);
    }

    // Remove from object map
    sceneObjects.objectDataMap.delete(id);

    // Clear selection if this object was selected
    if (sceneObjects.selectedObjectId === id) {
      sceneObjects.selectedObjectId = null;
    }
  }
}
