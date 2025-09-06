import { Camera } from "../../camera/Camera";
import { GeometryBuffersCollection } from "../../attribute_buffers/GeometryBuffersCollection";
import { AmbientLight } from "../../lights/AmbientLight";
import { Color } from "../../math/Color";
import { Vec3 } from "../../math/Vec3";
import { Texture2D } from "../../texture/Texture2D";
import { DirectionalLight } from "../../lights/DirectionalLight";
import { PointLightsCollection } from "../../lights/PointLight";
import { Floor } from "../../game_objects/Floor";
import { InputManager } from "../../input/InputManager";
import { ShadowCamera } from "../../camera/ShadowCamera";
import { ObjectMap } from "../../game_objects/ObjectMap";
import { GLTFGameObject } from "../../gltf/GLTFGameObject";
import LayoutConfig from "./LayoutConfig.json";
import { Quaternion } from "../../math/Quaternion";
import { Ball } from "../../game_objects/Ball";
import { Cube } from "../../game_objects/Cube";

let animationFrameId: number | null = null;

async function init(canvas: HTMLCanvasElement, device: GPUDevice, gpuContext: GPUCanvasContext, presentationFormat: GPUTextureFormat, infoElem: HTMLPreElement, options?: {
  gltfPath?: string;
  skinMode?: boolean;
  onGLTFGameObject?: (gltfGameObject: any) => void;
}){
  canvas!.addEventListener("click", async () => {
    await canvas!.requestPointerLock();
  });

  //Input Manager
  const inputManager = new InputManager(canvas);
  GeometryBuffersCollection.initialize(device);

  const objectMap = new ObjectMap();

  // DEPTH TEXTURE
  const depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: "depth32float",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
  const shadowTexture = Texture2D.createShadowTexture(device, 4096, 4096);
  // LIGHTS
  const ambientLight = new AmbientLight(device);
  ambientLight.color = new Color(1, 1, 1, 1);
  ambientLight.intensity = 0.8;
  
  const directionalLight = new DirectionalLight(device);
  directionalLight.color = new Color(1, 1, 1, 1);
  directionalLight.intensity = 0.8
  directionalLight.direction = new Vec3(0, -0.8, -0.08);
  directionalLight.specularIntensity = 0.5;
  directionalLight.specularColor = new Color(1, 1, 1, 1);

  const pointLights = new PointLightsCollection(device, 3);
  pointLights.lights[0].color = new Color(0, 1, 0, 1);
  pointLights.lights[0].intensity = 0;
  pointLights.lights[0].position = new Vec3(2.2, 2, 4);
  pointLights.lights[1].intensity = 0;
  pointLights.lights[1].color = new Color(1, 0, 0, 1);
  pointLights.lights[1].specularIntensity = 0;
  pointLights.lights[1].position = new Vec3(5.74, 2.48, -3.0);
  pointLights.lights[2].intensity = 0;
  pointLights.lights[2].color = new Color(0, 0, 1, 1);
  pointLights.lights[2].specularIntensity = 0;

  // Cameras
  const camera = new Camera(device, canvas.width / canvas.height, inputManager);
  camera.eye = new Vec3(3.9, -0.68, 2.75);
  camera.target = new Vec3(3.2, -0.8, 2.1);

  // SHADOW CAMERA
  const sunRadius = 6;
  const sceneCenter = new Vec3(0, 0, 0);
  // we use directional light to simulate sunlight

  const sunPosition = Vec3.add(
    sceneCenter,
  Vec3.scale(directionalLight.direction, -sunRadius)
);

  const shadowCamera = new ShadowCamera(device);

  shadowCamera.eye = sunPosition;
  shadowCamera.target = sceneCenter;
  shadowCamera.far = Vec3.distance(shadowCamera.eye, shadowCamera.target) * 3.0;
  shadowCamera.scale = 40;

  // Game Objects
  const floor = new Floor(device, camera, shadowCamera, ambientLight, directionalLight, pointLights);
  floor.pipeline.shadowTexture = shadowTexture;
  floor.scale = new Vec3(40, 0.1, 40);
  floor.position = new Vec3(0, -2, 0);

  const gltfPath = options?.gltfPath || "/assets/gltf/sponza.glb";
  const _gltfGameObject = new GLTFGameObject(device, camera, shadowCamera, ambientLight, directionalLight, pointLights, presentationFormat, depthTexture, new Vec3(1, 1, 1), new Vec3(0, 0, 0), new Quaternion(), true); // Enable lighting
  await _gltfGameObject.initialize(gltfPath, shadowTexture); // Pass the shadow texture
  _gltfGameObject.skinMode = options?.skinMode ? options?.skinMode === true ? 1 : 0 : 0;
  if (typeof options?.onGLTFGameObject === "function") {
    options.onGLTFGameObject(_gltfGameObject);
  }

  const stripAssetName = (gltfPath: string) => {
    return gltfPath.split('/').pop()?.split('.').shift() || "gltfModel";
  }
  const objectConfig = (LayoutConfig as Record<string, typeof LayoutConfig.default>)[stripAssetName(gltfPath)] ?? LayoutConfig.default;

  // Set position, scale, and rotation for the GLTF model
  _gltfGameObject.position = new Vec3(objectConfig.static.position[0], objectConfig.static.position[1], objectConfig.static.position[2]); // Place at origin
  const scale = objectConfig.static.scale;
  _gltfGameObject.scale = new Vec3(scale, scale, scale);
  _gltfGameObject.rotation = new Quaternion(objectConfig.static.rotation[0], objectConfig.static.rotation[1], objectConfig.static.rotation[2], objectConfig.static.rotation[3]);

  // Add key controls to move the model
  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "e") {
      console.log(camera.eye);
      console.log(camera.target);
      console.log(`Model position: (${_gltfGameObject.position.x.toFixed(2)}, ${_gltfGameObject.position.y.toFixed(2)}, ${_gltfGameObject.position.z.toFixed(2)})`);
    }
  });

  const update = (deltaTime: number) => {
    camera.update();
    ambientLight.update();
    directionalLight.update();
    pointLights.update();
    shadowCamera.update();
    _gltfGameObject.update(deltaTime);
    floor.update();
  };

  const shadowPass = (commandEncoder: GPUCommandEncoder) => {
    const renderPassEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [],
      // CONFIGURE DEPTH
      depthStencilAttachment: {
        view: shadowTexture.texture.createView(),
        depthLoadOp: "clear",
        depthStoreOp: "store",
        depthClearValue: 1.0,
      },
    });

    // DRAW HERE
    objectMap.objects.forEach((object) => {
      object.drawShadows(renderPassEncoder);
    });
    //cube.drawShadows(renderPassEncoder);
    _gltfGameObject.drawShadows(renderPassEncoder);
    renderPassEncoder.end();
  };

  const scenePass = (commandEncoder: GPUCommandEncoder) => {
    const renderPassEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: gpuContext.getCurrentTexture().createView(),
          storeOp: "store",
          clearValue: { r: 0.4, g: 0.9, b: 0.9, a: 1.0 },
          loadOp: "clear",
        },
      ],
      // CONFIGURE DEPTH
      depthStencilAttachment: {
        view: depthTexture.createView(),
        depthLoadOp: "clear",
        depthStoreOp: "store",
        depthClearValue: 1.0,
      },
    });

    // DRAW HERE
    objectMap.objects.forEach((object) => {
      object.draw(renderPassEncoder);
    });
    floor.draw(renderPassEncoder);
    _gltfGameObject.draw(renderPassEncoder);
    renderPassEncoder.end();
  };

  let then = performance.now() * 0.001;
  const targetFPS = 60;
  const minFrameTime = 1 / targetFPS;
  let lastDrawTime = performance.now() * 0.001;

  const draw = () => {
    let now = performance.now();
    now *= 0.001; // convert to seconds
    const deltaTime = now - then;
    // Only proceed if enough time has passed for the target FPS
    if (now - lastDrawTime < minFrameTime) {
      animationFrameId = requestAnimationFrame(draw);
      return;
    }
    lastDrawTime = now;
    then = now;
    const startTime = performance.now();
    update(deltaTime);

    const commandEncoder = device.createCommandEncoder();
    shadowPass(commandEncoder);
    scenePass(commandEncoder);

    device.queue.submit([commandEncoder.finish()]);

    const jsTime = performance.now() - startTime;

    if (infoElem != null) {
      infoElem.textContent = `\
      fps: ${(1 / deltaTime).toFixed(1)}
      js: ${jsTime.toFixed(1)}ms
      `;
    }
    animationFrameId = requestAnimationFrame(draw);
  };

  draw();
}

export function dispose() {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

export { init };
