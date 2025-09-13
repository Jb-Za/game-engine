import { GeometryBuffersCollection } from "../../attribute_buffers/GeometryBuffersCollection";
import { Texture2D } from "../../texture/Texture2D";
import { InputManager } from "../../input/InputManager";
import { Scene } from "../../sceneEditor/Scene";
//import sceneDataJson from "./scene.json";
import sceneDataJson from './testscene.json';
import { Camera } from "../../camera/Camera";
import { AmbientLight } from "../../lights/AmbientLight";
import { DirectionalLight } from "../../lights/DirectionalLight";
import { PointLightsCollection } from "../../lights/PointLight";
import { ShadowCamera } from "../../camera/ShadowCamera";
import { Mat4x4 } from "../../math/Mat4x4";
import { Vec4 } from "../../math/Vec4";
import { Vec3 } from "../../math/Vec3";
import { GizmoArrow } from "../../game_objects/GizmoArrow";
import { Color } from "../../math/Color";

function intersectRayBox(rayOrigin: Vec3, rayDirection: Vec3, boxScale: Vec3): { distance: number; point: Vec3 } | null {
  // Normalize ray direction so distance is in world units
  const len = Math.hypot(rayDirection.x, rayDirection.y, rayDirection.z);
  if (len < 1e-8) return null; // invalid ray
  const d = new Vec3(rayDirection.x / len, rayDirection.y / len, rayDirection.z / len);

  // Box extends from -scale to +scale
  const boxMin = new Vec3(-boxScale.x, -boxScale.y, -boxScale.z);
  const boxMax = new Vec3(boxScale.x, boxScale.y, boxScale.z);

  const invDir = new Vec3(d.x === 0 ? Infinity : 1 / d.x, d.y === 0 ? Infinity : 1 / d.y, d.z === 0 ? Infinity : 1 / d.z);

  const t1 = (boxMin.x - rayOrigin.x) * invDir.x;
  const t2 = (boxMax.x - rayOrigin.x) * invDir.x;
  const t3 = (boxMin.y - rayOrigin.y) * invDir.y;
  const t4 = (boxMax.y - rayOrigin.y) * invDir.y;
  const t5 = (boxMin.z - rayOrigin.z) * invDir.z;
  const t6 = (boxMax.z - rayOrigin.z) * invDir.z;

  const tmin = Math.max(Math.max(Math.min(t1, t2), Math.min(t3, t4)), Math.min(t5, t6));
  const tmax = Math.min(Math.min(Math.max(t1, t2), Math.max(t3, t4)), Math.max(t5, t6));

  // Require a minimum distance to avoid selecting objects behind the camera
  if (tmax < 0.01 || tmin > tmax) {
    return null;
  }

  const distance = tmin > 0.01 ? tmin : tmax;
  if (distance < 0.01) {
    return null;
  }

  const point = Vec3.add(rayOrigin, Vec3.scale(d, distance));
  return { distance, point };
}

let scene: Scene | null = null;
let animationFrameId: number | null = null;

// Module-level resources so loadScene can be called at any time
let _device: GPUDevice | null = null;
// let _gpuContext: GPUCanvasContext | null = null;
let _presentationFormat: GPUTextureFormat | null = null;
let _canvas: HTMLCanvasElement | null = null;
let _infoElem: HTMLPreElement | null = null;
let _inputManager: InputManager | null = null;
let _depthTexture: Texture2D | null = null;
let _shadowTexture: Texture2D | null = null;

let camera: Camera | null = null;
let ambientLight: AmbientLight | null = null;
let directionalLight: DirectionalLight | null = null;
let pointLights: PointLightsCollection | null = null;
let shadowCamera: ShadowCamera | null = null;

let isObjectPickingEnabled = true;
let onObjectSelected: ((objectId: string | null) => void) | null = null;
let onObjectPositionChanged: ((objectId: string, position: { x: number, y: number, z: number }) => void) | null = null;

// Add gizmo variables
let selectedObjectId: string | null = null;
let selectedObject: any = null;
let xAxisArrow: GizmoArrow | null = null;
let yAxisArrow: GizmoArrow | null = null;
let zAxisArrow: GizmoArrow | null = null;
let isDragging = false;
let activeArrow: 'x' | 'y' | 'z' | null = null;
let dragStartMousePos: { x: number, y: number } | null = null;
let dragStartObjectPos: Vec3 | null = null;

// Add this interface for ray-object intersection
interface RayIntersection {
  objectId: string;
  distance: number;
  point: Vec3;
}

async function init(canvas: HTMLCanvasElement, device: GPUDevice, gpuContext: GPUCanvasContext, presentationFormat: GPUTextureFormat, infoElem: HTMLPreElement) {
  //let isMiddlePanning = false;
  //let lastPanPos: { x: number; y: number } | null = null;
  
  canvas?.addEventListener("mousedown", async (event: MouseEvent) => {
    if (isObjectPickingEnabled && !document.pointerLockElement) {
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;


      if(event.button === 0){
        // First check if we're clicking on a gizmo arrow
        const clickedArrow = checkArrowSelection(mouseX, mouseY);
        if (clickedArrow && selectedObject) {
          startDragging(clickedArrow, mouseX, mouseY);
          return;
        }
        
        // Otherwise, perform regular object selection
        const selectedObjectIdResult = performRayPicking(mouseX, mouseY);
        selectObject(selectedObjectIdResult);
      }

      if (event.button === 1) {
        // Try to request pointer lock for rotation
        if (canvas.requestPointerLock) {
          canvas.requestPointerLock();
        }
        // start fallback pan (if pointer lock isn't available)
        //isMiddlePanning = true;
        //lastPanPos = { x: event.clientX, y: event.clientY };
        // prevent default to avoid scrolling / autoselect
        event.preventDefault();
      }
    }
  });

    window.addEventListener("mouseup", (event: MouseEvent) => {
    if (event.button === 1) {
      //isMiddlePanning = false;
      //lastPanPos = null;
      if (document.exitPointerLock) {
        // only exit if pointer is locked to our canvas
        if (document.pointerLockElement === canvas) {
          document.exitPointerLock();
        }
      }
    }
  });

  canvas?.addEventListener("mousemove", (event: MouseEvent) => {
    if (isDragging && activeArrow && selectedObject) {
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      updateDragging(mouseX, mouseY);
    }
  });

  canvas?.addEventListener("mouseup", () => {
    if (isDragging) {
      stopDragging();
    }
  });

  if (presentationFormat) {
  } // lazy linting

  const sceneData = sceneDataJson as any;

  // Store module-level references for later use
  _canvas = canvas;
  _device = device;
  // _gpuContext = gpuContext;
  _presentationFormat = presentationFormat;
  _infoElem = infoElem;

  // Input Manager
  _inputManager = new InputManager(canvas);
  GeometryBuffersCollection.initialize(device);

  // Create shared depth and shadow textures once
  _depthTexture = Texture2D.createDepthTexture(device, canvas.width, canvas.height);
  _shadowTexture = Texture2D.createShadowTexture(device, 4096, 4096);

  // Create the initial scene (uses the module-level resources)
  loadScene(sceneData);

  // === GAME FUNCTIONS ===
  function handleInput(): void {
    // Add some basic input handling
    if (_inputManager && (_inputManager.isKeyDown("r") || _inputManager.isKeyDown("R"))) {
      // placeholder for future
    }
  }

  // === RENDER LOOP ===
  let lastTime = performance.now();
  function renderLoop(currentTime: number) {
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    if (_infoElem != null) {
      _infoElem.textContent = `fps: ${(1 / deltaTime).toFixed(1)}\n`;
    }

    handleInput();

    if (!scene) {
      // No scene to update/render yet
      animationFrameId = requestAnimationFrame(renderLoop);
      return;
    }

    // Query scene-local components each frame so loadScene can swap them at runtime
    const sceneObjects = scene.getSceneObjects();

    camera = scene.getCamera();
    camera.controlScheme = "sceneEditor";
    ambientLight = scene.getAmbientLight();
    directionalLight = scene.getDirectionalLight();
    pointLights = scene.getPointLights();
    shadowCamera = scene.getShadowCamera();

    camera.update();
    ambientLight.update();
    directionalLight.update();
    pointLights.update();
    shadowCamera.update();

    // Update game objects
    sceneObjects.objects.forEach((obj) => {
      if (obj && typeof obj.update === "function") {
        obj.update(deltaTime);
      }
    });

    // === SHADOW PASS ===
    const shadowCommandEncoder = device.createCommandEncoder();
    const shadowRenderPass = shadowCommandEncoder.beginRenderPass({
      colorAttachments: [],
      depthStencilAttachment: {
        view: _shadowTexture!.texture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });

    sceneObjects.objects.forEach((obj) => {
      if (obj && typeof obj.drawShadows === "function") {
        obj.drawShadows(shadowRenderPass);
      }
    });
    shadowRenderPass.end();
    device.queue.submit([shadowCommandEncoder.finish()]);

    // === MAIN RENDER PASS ===
    const commandEncoder = device.createCommandEncoder();
    const textureView = gpuContext.getCurrentTexture().createView();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0.2, g: 0.2, b: 0.25, a: 1.0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: _depthTexture!.texture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });    // Render game objects
    sceneObjects.objects.forEach((obj) => {
      if (obj && typeof obj.draw === "function" && obj.visible !== false) {
        obj.draw(renderPass);
      }
    });

    // Render gizmo arrows on top
    if (xAxisArrow && xAxisArrow.visible) {
      xAxisArrow.update();
      xAxisArrow.draw(renderPass);
    }
    if (yAxisArrow && yAxisArrow.visible) {
      yAxisArrow.update();
      yAxisArrow.draw(renderPass);
    }
    if (zAxisArrow && zAxisArrow.visible) {
      zAxisArrow.update();
      zAxisArrow.draw(renderPass);
    }

    renderPass.end();
    device.queue.submit([commandEncoder.finish()]);
    animationFrameId = requestAnimationFrame(renderLoop);
  }

  renderLoop(performance.now());
}

export function dispose() {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

// Export the main init function and related scene functions
export { init, getScene, addObject, removeObject, saveScene, loadScene, selectObject };

// Function to get the current scene instance
function getScene(): Scene | null {
  return scene;
}

// Function to add a new object to the scene
async function addObject(type: "cube" | "sphere" | "light" | "camera" | "gltf", data?: any): Promise<Scene | null> {
  if (!scene) {
    console.error("Scene not initialized");
    return null;
  }
  return await scene.addNewObject(type, data);
}

// Function to remove an object from the scene
function removeObject(id: string): void {
  if (!scene) {
    console.error("Scene not initialized");
    return;
  }
  scene.deleteSceneObject(id);
}

function disposeScene(): void {
  camera = null;
  ambientLight = null;
  directionalLight = null;
  pointLights = null;
  shadowCamera = null;
  
  // Reset gizmo arrows to ensure they use the new scene's device
  hideGizmoArrows();
  xAxisArrow = null;
  yAxisArrow = null;
  zAxisArrow = null;
}

function loadScene(sceneJson: any): void {
  disposeScene();

  // Create/replace the scene instance
  try {
    scene = new Scene(sceneJson, _device!, _canvas!.width / _canvas!.height, _inputManager!, _shadowTexture!, _presentationFormat!, _depthTexture!.texture);
    console.log("Scene loaded");
  } catch (e) {
    console.error("Failed to load scene:", e);
  }
}

function saveScene(): void {
  if (!scene) {
    console.error("Scene not initialized");
    return;
  }
  scene.saveScene();
}

function selectObject(objectId: string | null): void {
  selectedObjectId = objectId;
  selectedObject = objectId ? scene?.getSceneObjects().objects.get(objectId) : null;
  
  // Update gizmo visibility and position
  updateGizmoArrows();
  
  if (onObjectSelected) {
    onObjectSelected(objectId);
  }
}

function performRayPicking(mouseX: number, mouseY: number): string | null {
  if (!scene || !camera || !_canvas) return null;

  // Convert screen coordinates to normalized device coordinates (-1 to 1)
  const ndcX = (mouseX / _canvas.width) * 2 - 1;
  const ndcY = -((mouseY / _canvas.height) * 2 - 1); // Flip Y axis

  // Create ray in world space
  const ray = createRayFromCamera(ndcX, ndcY);

  // Test intersection with all scene objects
  const intersections: RayIntersection[] = [];
  const sceneObjects = scene.getSceneObjects();

  sceneObjects.objects.forEach((obj, objId) => {
    if (obj && obj.visible !== false) {
      const intersection = testRayObjectIntersection(ray, obj, objId);
      if (intersection) {
        intersections.push(intersection);
      }
    }
  }); 
  
  if (intersections.length > 0) {
    // Sort by distance first
    intersections.sort((a, b) => a.distance - b.distance);
    
    const closest = intersections[0];

    // console.log(`Selected object: ${closest.objectId}`);
    return closest.objectId;
  }

  return null;
}

function createRayFromCamera(ndcX: number, ndcY: number): { origin: Vec3; direction: Vec3 } {
  if (!camera) throw new Error("Camera not available");

  // Get camera matrices
  const viewMatrix = camera.view;
  const projMatrix = camera.projection;

  // Calculate inverse matrices
  const invProjMatrix = Mat4x4.inverse(projMatrix);
  const invViewMatrix = Mat4x4.inverse(viewMatrix);

  // Create near and far points in clip space
  const nearPoint = new Vec4(ndcX, ndcY, -1, 1); // Near plane
  const farPoint = new Vec4(ndcX, ndcY, 1, 1); // Far plane

  // Unproject to world space
  let nearWorldPoint = Mat4x4.multiplyVec4(invProjMatrix, nearPoint);
  nearWorldPoint = Vec4.scale(nearWorldPoint, 1 / nearWorldPoint.w); // Perspective divide
  nearWorldPoint = Mat4x4.multiplyVec4(invViewMatrix, nearWorldPoint);

  let farWorldPoint = Mat4x4.multiplyVec4(invProjMatrix, farPoint);
  farWorldPoint = Vec4.scale(farWorldPoint, 1 / farWorldPoint.w); // Perspective divide
  farWorldPoint = Mat4x4.multiplyVec4(invViewMatrix, farWorldPoint);

  // Calculate ray direction from near to far
  const rayDirection = Vec3.normalize(new Vec3(farWorldPoint.x - nearWorldPoint.x, farWorldPoint.y - nearWorldPoint.y, farWorldPoint.z - nearWorldPoint.z));

  return {
    origin: camera.eye,
    direction: rayDirection,
  };
}

function testRayObjectIntersection(ray: { origin: Vec3; direction: Vec3 }, obj: any, objId: string): RayIntersection | null {
  // Transform ray to object space
  const objMatrix = getObjectTransformMatrix(obj);
  const invObjMatrix = Mat4x4.inverse(objMatrix);
  const localRayOrigin = Vec3.transformPoint(invObjMatrix, ray.origin);
  const localRayDirection = Vec3.transformVector(invObjMatrix, ray.direction);

  let intersection: { distance: number; point: Vec3 } | null = null;

  // Check object type and perform appropriate intersection test
  const objectType = objId.split("_")[0].toLowerCase();
  switch (objectType) {
    case "cube":
      // In object space, cube geometry is defined from -0.5 to +0.5
      intersection = intersectRayBox(localRayOrigin, localRayDirection, new Vec3(0.5, 0.5, 0.5));
      break;
    case "sphere":
      // In object space, sphere radius should be 1.0 (geometry is defined with radius 1)
      intersection = intersectRaySphere(localRayOrigin, localRayDirection, 1.0);
      break;    case "gltf":
      // In object space, use the actual bounding box without additional scaling
      if (obj.gltfScene && obj.gltfScene.boundingBox && obj.gltfScene.boundingBox.min && obj.gltfScene.boundingBox.max) {
        // Use the original GLTF bounding box directly (transformation is already handled by object space conversion)
        const gltfBounds = obj.gltfScene.boundingBox;
        intersection = intersectRayGltf(localRayOrigin, localRayDirection, gltfBounds);
      } else {
        // Fall back to a reasonable default size in object space
        const defaultBounds = new Vec3(1.0, 1.0, 1.0);
        intersection = intersectRayBox(localRayOrigin, localRayDirection, defaultBounds);
      }
      break;
    default:
      return null;
  }

  if (intersection) {
    const worldPoint = Vec3.transformPoint(objMatrix, intersection.point);
    const worldDistance = Vec3.distance(ray.origin, worldPoint);

    return {
      objectId: objId,
      distance: worldDistance,
      point: worldPoint,
    };
  }

  return null;
}

function getObjectTransformMatrix(obj: any): Mat4x4 {
 // Create transformation matrix from object's position, rotation, and scale
  const translation = Mat4x4.translation(obj.position.x, obj.position.y, obj.position.z);
  const rotation = Mat4x4.fromQuaternion(obj.rotation);
  const scale = Mat4x4.scale(obj.scale.x, obj.scale.y, obj.scale.z);

  // Correct order: Scale → Rotation → Translation (multiply right to left)
  return Mat4x4.multiply(translation, Mat4x4.multiply(rotation, scale));
}

function intersectRayGltf(rayOrigin: Vec3, rayDirection: Vec3, boxMinMax: { min: Vec3; max: Vec3 }): { distance: number; point: Vec3 } | null {
  // Normalize ray direction so distance is in world units
  const len = Math.hypot(rayDirection.x, rayDirection.y, rayDirection.z);
  if (len < 1e-8) return null; // invalid ray
  const d = new Vec3(rayDirection.x / len, rayDirection.y / len, rayDirection.z / len);

  // Box extends from -scale to +scale
  const boxMin = boxMinMax.min;
  const boxMax = boxMinMax.max;

  const invDir = new Vec3(d.x === 0 ? Infinity : 1 / d.x, d.y === 0 ? Infinity : 1 / d.y, d.z === 0 ? Infinity : 1 / d.z);

  const t1 = (boxMin.x - rayOrigin.x) * invDir.x;
  const t2 = (boxMax.x - rayOrigin.x) * invDir.x;
  const t3 = (boxMin.y - rayOrigin.y) * invDir.y;
  const t4 = (boxMax.y - rayOrigin.y) * invDir.y;
  const t5 = (boxMin.z - rayOrigin.z) * invDir.z;
  const t6 = (boxMax.z - rayOrigin.z) * invDir.z;

  const tmin = Math.max(Math.max(Math.min(t1, t2), Math.min(t3, t4)), Math.min(t5, t6));
  const tmax = Math.min(Math.min(Math.max(t1, t2), Math.max(t3, t4)), Math.max(t5, t6));

  // Require a minimum distance to avoid selecting objects behind the camera
  if (tmax < 0.01 || tmin > tmax) {
    return null;
  }

  const distance = tmin > 0.01 ? tmin : tmax;
  if (distance < 0.01) {
    return null;
  }

  const point = Vec3.add(rayOrigin, Vec3.scale(d, distance));

  return { distance, point };
}

function intersectRaySphere(rayOrigin: Vec3, rayDirection: Vec3, radius: number): { distance: number; point: Vec3 } | null {
  const oc = Vec3.subtract(rayOrigin, new Vec3(0, 0, 0)); // Sphere centered at origin
  const a = Vec3.dot(rayDirection, rayDirection);
  const b = 2.0 * Vec3.dot(oc, rayDirection);
  const c = Vec3.dot(oc, oc) - radius * radius;

  const discriminant = b * b - 4 * a * c;

  if (discriminant < 0) {
    return null; // No intersection
  }

  const sqrt_discriminant = Math.sqrt(discriminant);
  const t1 = (-b - sqrt_discriminant) / (2 * a);
  const t2 = (-b + sqrt_discriminant) / (2 * a);

  const distance = t1 > 0 ? t1 : t2 > 0 ? t2 : -1;

  if (distance < 0) {
    return null;
  }
  const point = Vec3.add(rayOrigin, Vec3.scale(rayDirection, distance));
  return { distance, point };
}

function updateGizmoArrows(): void {
  if (!selectedObject || !camera || !ambientLight || !directionalLight || !pointLights || !shadowCamera || !scene) {
    hideGizmoArrows();
    return;
  }

  // Get the device from the scene's object parameters to ensure consistency
  const sceneDevice = (scene as any)._objectParameters?.device || _device;
  if (!sceneDevice) {
    hideGizmoArrows();
    return;
  }

  // Create arrows if they don't exist
  const xScale =  0.4;
  const yScale =  0.5;

  if (!xAxisArrow) {
    xAxisArrow = new GizmoArrow(sceneDevice, camera, shadowCamera);
    xAxisArrow.color = new Color(1, 0, 0, 1); // Red for X axis
    xAxisArrow.scale = new Vec3(xScale, yScale, xScale); // Thin arrow
    xAxisArrow.setDirection(new Vec3(-1, 0, 0)); // Point along X axis
  }
  
  if (!yAxisArrow) {
    yAxisArrow = new GizmoArrow(sceneDevice, camera, shadowCamera);
    yAxisArrow.color = new Color(0, 1, 0, 1); // Green for Y axis
    yAxisArrow.scale = new Vec3(xScale, yScale, xScale);
    yAxisArrow.setDirection(new Vec3(0, 1, 0)); // Point along Y axis
  }
  
  if (!zAxisArrow) {
    zAxisArrow = new GizmoArrow(sceneDevice, camera, shadowCamera);
    zAxisArrow.color = new Color(0, 0, 1, 1); // Blue for Z axis
    zAxisArrow.scale = new Vec3(xScale, yScale, xScale);
    zAxisArrow.setDirection(new Vec3(0, 0, -1)); // Point along Z axis
  }

  // Position arrows at the selected object's position with slight offset
  const objPos = selectedObject.position;
  const offset = 1.0; // Distance from object center
  
  xAxisArrow.position = new Vec3(objPos.x + offset, objPos.y, objPos.z);
  yAxisArrow.position = new Vec3(objPos.x, objPos.y + offset, objPos.z);
  zAxisArrow.position = new Vec3(objPos.x, objPos.y, objPos.z + offset);
  
  // Make arrows visible
  xAxisArrow.visible = true;
  yAxisArrow.visible = true;
  zAxisArrow.visible = true;
}

function hideGizmoArrows(): void {
  if (xAxisArrow) xAxisArrow.visible = false;
  if (yAxisArrow) yAxisArrow.visible = false;
  if (zAxisArrow) zAxisArrow.visible = false;
}

function checkArrowSelection(mouseX: number, mouseY: number): 'x' | 'y' | 'z' | null {
  if (!camera || !_canvas) return null;

  const ray = createRayFromCamera(
    (mouseX / _canvas.width) * 2 - 1,
    -((mouseY / _canvas.height) * 2 - 1)
  );

  const intersections: { arrow: 'x' | 'y' | 'z', distance: number }[] = [];

  // Test each arrow
  if (xAxisArrow && xAxisArrow.visible) {
    const intersection = testArrowIntersection(ray, xAxisArrow);
    if (intersection) {
      intersections.push({ arrow: 'x', distance: intersection.distance });
    }
  }
  
  if (yAxisArrow && yAxisArrow.visible) {
    const intersection = testArrowIntersection(ray, yAxisArrow);
    if (intersection) {
      intersections.push({ arrow: 'y', distance: intersection.distance });
    }
  }
  
  if (zAxisArrow && zAxisArrow.visible) {
    const intersection = testArrowIntersection(ray, zAxisArrow);
    if (intersection) {
      intersections.push({ arrow: 'z', distance: intersection.distance });
    }
  }

  if (intersections.length > 0) {
    intersections.sort((a, b) => a.distance - b.distance);
    return intersections[0].arrow;
  }

  return null;
}

function testArrowIntersection(ray: { origin: Vec3; direction: Vec3 }, arrow: GizmoArrow): { distance: number; point: Vec3 } | null {
  // Transform ray to arrow's object space
  const objMatrix = getArrowTransformMatrix(arrow);
  const invObjMatrix = Mat4x4.inverse(objMatrix);
  const localRayOrigin = Vec3.transformPoint(invObjMatrix, ray.origin);
  const localRayDirection = Vec3.transformVector(invObjMatrix, ray.direction);

  // Use a cylindrical bounding box for the arrow
  return intersectRayBox(localRayOrigin, localRayDirection, new Vec3(0.1, 0.5, 0.1));
}

function getArrowTransformMatrix(arrow: GizmoArrow): Mat4x4 {
  const translation = Mat4x4.translation(arrow.position.x, arrow.position.y, arrow.position.z);
  const rotation = Mat4x4.fromQuaternion(arrow.rotation);
  const scale = Mat4x4.scale(arrow.scale.x, arrow.scale.y, arrow.scale.z);
  return Mat4x4.multiply(Mat4x4.multiply(translation, rotation), scale);
}

function startDragging(arrowType: 'x' | 'y' | 'z', mouseX: number, mouseY: number): void {
  if (!selectedObject) return;
  
  isDragging = true;
  activeArrow = arrowType;
  dragStartMousePos = { x: mouseX, y: mouseY };
  dragStartObjectPos = new Vec3(selectedObject.position.x, selectedObject.position.y, selectedObject.position.z);
}

function updateDragging(mouseX: number, mouseY: number): void {
  if (!isDragging || !activeArrow || !selectedObject || !dragStartMousePos || !dragStartObjectPos || !camera || !_canvas) {
    return;
  }

  // Calculate mouse movement
  const deltaX = mouseX - dragStartMousePos.x;
  const deltaY = mouseY - dragStartMousePos.y;
  
  const camToObj = Vec3.subtract(selectedObject.position, camera.eye);
  const distance = Vec3.length(camToObj);
  const sensitivity = 0.001 * distance; // scale with distance
  
  let worldDelta = new Vec3(0, 0, 0);
  
  switch (activeArrow) {
    case 'x': {
      // Project world X axis to screen space
      const worldAxis = new Vec3(1, 0, 0);
      const screenAxis = projectAxisToScreen(worldAxis, camera);
      
      // Calculate movement along the projected axis
      const mouseDelta = new Vec3(deltaX, deltaY, 0);
      const axisMovement = Vec3.dot(mouseDelta, screenAxis);
      
      worldDelta.x = axisMovement * sensitivity;
      break;
    }
    case 'y': {
      worldDelta.y = -deltaY * sensitivity;
      break;
    }
    case 'z': {
      const worldAxis = new Vec3(0, 0, 1);
      const screenAxis = projectAxisToScreen(worldAxis, camera);
      
      const mouseDelta = new Vec3(deltaX, deltaY, 0);
      const axisMovement = Vec3.dot(mouseDelta, screenAxis);
      
      worldDelta.z = axisMovement * sensitivity;
      break;
    }
}
  // Update object position
  selectedObject.position = Vec3.add(dragStartObjectPos, worldDelta);
  
  // Notify React UI of position change
  if (onObjectPositionChanged && selectedObjectId) {
    onObjectPositionChanged(selectedObjectId, {
      x: selectedObject.position.x,
      y: selectedObject.position.y,
      z: selectedObject.position.z
    });
  }
  
  // Update gizmo arrows to follow the object
  updateGizmoArrows();
}

function projectAxisToScreen(worldAxis: Vec3, camera: Camera): Vec3 {
  // Transform world axis to view space
  const viewAxis = Mat4x4.multiplyVec(camera.view, worldAxis);
  
  // Project to screen (just use x,y components, ignore z)
  let screenAxis = Vec3.normalize(new Vec3(viewAxis.x, -viewAxis.y, 0));
  
  return screenAxis;
}

function stopDragging(): void {
  isDragging = false;
  activeArrow = null;
  dragStartMousePos = null;
  dragStartObjectPos = null;
  
  // console.log('Stopped dragging');
}

// Export functions to enable/disable object picking
export function enableObjectPicking(callback: (objectId: string | null) => void) {
  isObjectPickingEnabled = true;
  onObjectSelected = callback;
}

export function disableObjectPicking() {
  isObjectPickingEnabled = false;
  onObjectSelected = null;
}

// Export function to set position change callback
export function setObjectPositionCallback(callback: (objectId: string, position: { x: number, y: number, z: number }) => void) {
  onObjectPositionChanged = callback;
}
