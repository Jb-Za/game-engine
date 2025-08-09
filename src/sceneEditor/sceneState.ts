// Scene State Management Functions
import { Vec3 } from "../math/Vec3";
import { Color } from "../math/Color";
import type { SceneEditorState,  } from '../components/SceneEditorControls';
import type { SceneObjects } from "./Interfaces";
// Global reference to scene objects
let sceneObjects: SceneObjects | null = null;

export function setSceneObjects(objects: SceneObjects) {
  sceneObjects = objects;
}

export function getSceneObjects(): SceneObjects | null {
  return sceneObjects;
}

export function updateSceneState(state: SceneEditorState) {
  if (!sceneObjects) return;

  // Update camera
  sceneObjects.camera.eye = new Vec3(state.cameraPosition.x, state.cameraPosition.y, state.cameraPosition.z);
  sceneObjects.camera.target = new Vec3(state.cameraTarget.x, state.cameraTarget.y, state.cameraTarget.z);

  // Update lights
  sceneObjects.ambientLight.color = new Color(
    state.ambientLight.color.r,
    state.ambientLight.color.g,
    state.ambientLight.color.b,
    state.ambientLight.color.a
  );
  sceneObjects.ambientLight.intensity = state.ambientLight.intensity;

  sceneObjects.directionalLight.color = new Color(
    state.directionalLight.color.r,
    state.directionalLight.color.g,
    state.directionalLight.color.b,
    state.directionalLight.color.a
  );
  sceneObjects.directionalLight.intensity = state.directionalLight.intensity;
  sceneObjects.directionalLight.direction = new Vec3(
    state.directionalLight.direction.x,
    state.directionalLight.direction.y,
    state.directionalLight.direction.z
  );

  // Update objects
  state.objects.forEach(objData => {
    const gameObject = sceneObjects!.objectDataMap.get(objData.id);
    if (gameObject) {
      // Update transform
      gameObject.position = new Vec3(objData.position.x, objData.position.y, objData.position.z);
      gameObject.scale = new Vec3(objData.scale.x, objData.scale.y, objData.scale.z);
      gameObject.color = new Color(objData.color.r, objData.color.g, objData.color.b, objData.color.a);
      
      // Update visibility (you might need to implement this in your game objects)
      if ('visible' in gameObject) {
        gameObject.visible = objData.visible;
      }
    }
  });

  // Update selection
  sceneObjects.selectedObjectId = state.selectedObjectId;
}

export function selectObject(id: string | null) {
  if (!sceneObjects) return;
  sceneObjects.selectedObjectId = id;
}
