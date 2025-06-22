import { Camera } from "./camera/Camera";
import { GeometryBuffersCollection } from "./attribute_buffers/GeometryBuffersCollection";
import { AmbientLight } from "./lights/AmbientLight";
import { Color } from "./math/Color";
import { Vec3 } from "./math/Vec3";
import { Texture2D } from "./texture/Texture2D";
import { DirectionalLight } from "./lights/DirectionalLight";
import { PointLightsCollection } from "./lights/PointLight";
import { Floor } from "./game_objects/Floor";
import { InputManager } from "./input/InputManager";
import { ShadowCamera } from "./camera/ShadowCamera";
import { ObjectMap } from "./game_objects/ObjectMap";

import { GLTFGameObject } from "./gltf/GLTFGameObject";

async function init() {
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  const gpuContext = canvas.getContext("webgpu") as GPUCanvasContext;
  const presentationFormat: GPUTextureFormat = navigator.gpu.getPreferredCanvasFormat();

  const infoElem = document.querySelector("#info");
  if (!gpuContext) {
    alert("WebGPU not supported");
    return;
  }

  canvas.addEventListener("click", async () => {
    await canvas.requestPointerLock();
  });

  const adapter = await navigator.gpu.requestAdapter();

  const device: GPUDevice = await adapter!.requestDevice();

  gpuContext.configure({
    device: device,
    format: presentationFormat,
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
  const shadowTexture = Texture2D.createShadowTexture(device, 3072, 3072);
  // LIGHTS
  const ambientLight = new AmbientLight(device);
  ambientLight.color = new Color(1, 1, 1, 1);
  ambientLight.intensity = 0.6;

  const directionalLight = new DirectionalLight(device);
  directionalLight.color = new Color(1, 1, 1, 1);
  directionalLight.intensity = 0;
  directionalLight.direction = new Vec3(-1, 0, 0);
  directionalLight.specularIntensity = 0;
  directionalLight.specularColor = new Color(1, 0, 0, 1);

  const pointLights = new PointLightsCollection(device, 3);
  pointLights.lights[0].color = new Color(0, 0, 1, 1);
  pointLights.lights[0].intensity = 0.6;
  pointLights.lights[0].position = new Vec3(5.74, 2.48, -3.0);
  pointLights.lights[1].intensity = 1;
  pointLights.lights[1].specularIntensity = 0;
  pointLights.lights[1].position = new Vec3(5.74, 2.48, -3.0);
  pointLights.lights[2].intensity = 0;
  pointLights.lights[2].specularIntensity = 0;

  // Cameras
  const camera = new Camera(device, canvas.width / canvas.height, inputManager);
  camera.eye = new Vec3(5.74, 1.96, 4.44);
  camera.target = new Vec3(5.02, 1.94, 3.94);

  const shadowCamera = new ShadowCamera(device);
  shadowCamera.eye = new Vec3(5.74, 2.48, -3.0); // Let's imagine it as a negative direction light * -20 or any other fitting scalar
  shadowCamera.target = new Vec3(4.85, 2.38, -2.61);

  // Game Objects
  const floor = new Floor(device, camera, shadowCamera, ambientLight, directionalLight, pointLights);
  floor.pipeline.shadowTexture = shadowTexture;
  floor.scale = new Vec3(40, 0.1, 40);
  floor.position = new Vec3(0, -2, 0);

  const _gltfGameObject = new GLTFGameObject(device, camera, shadowCamera, ambientLight, directionalLight, pointLights, presentationFormat, depthTexture);
  await _gltfGameObject.initialize("../../assets/gltf/Fox.glb");
  _gltfGameObject.skinMode = 1;

  // Set position, scale, and rotation for the GLTF model
  _gltfGameObject.position = new Vec3(0, 0, 0); // Place at origin
  _gltfGameObject.scale = new Vec3(1, 1, 1);
  _gltfGameObject.rotation = [0, 0, 0, 1]; // TODO: turn this into Vec4

  // Add key controls to move the model
  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "e") {
      console.log(camera.eye);
      console.log(camera.target);
    }
    // Toggle skin mode with 'E' key
    if (e.key === "e" || e.key === "E") {
      _gltfGameObject.skinMode = _gltfGameObject.skinMode === 0 ? 1 : 0;
      if (_gltfGameObject.skinMode === 0) {
        _gltfGameObject.position = new Vec3(0, 0, 25); 
        _gltfGameObject.scale = new Vec3(1.5, 1.5, 1.5);
        _gltfGameObject.rotation = [1, 0, 0, 0]; 
      } else {
        _gltfGameObject.position = new Vec3(0, 0, 0)
        _gltfGameObject.scale = new Vec3(1, 1, 1);
        _gltfGameObject.rotation = [0, 0, 0, 1];
      }
      console.log(`Skin mode switched to: ${_gltfGameObject.skinMode === 0 ? "Skinned" : "Non-skinned"} (skin_mode=${_gltfGameObject.skinMode})`);
    }

    console.log(`Model position: (${_gltfGameObject.position.x.toFixed(2)}, ${_gltfGameObject.position.y.toFixed(2)}, ${_gltfGameObject.position.z.toFixed(2)})`);
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
    renderPassEncoder.end();
  };

  let then = performance.now() * 0.001;

  const draw = () => {
    let now = performance.now();
    now *= 0.001; // convert to seconds
    const deltaTime = now - then;
    then = now;
    const startTime = performance.now();
    update(deltaTime);

    const commandEncoder = device.createCommandEncoder();
    shadowPass(commandEncoder);
    const renderPassEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: gpuContext.getCurrentTexture().createView(),
          storeOp: "store",
          clearValue: { r: 0.4, g: 0.9, b: 0.9, a: 1.0 },
          loadOp: "clear",
        },
      ],
      depthStencilAttachment: {
        view: depthTexture.createView(),
        depthLoadOp: "clear",
        depthStoreOp: "store",
        depthClearValue: 1.0,
      },
    });

    // Draw your other objects as before
    objectMap.objects.forEach((object) => {
      object.draw(renderPassEncoder);
    });
    floor.draw(renderPassEncoder);
    _gltfGameObject.draw(renderPassEncoder);
    renderPassEncoder.end();

    device.queue.submit([commandEncoder.finish()]);

    const jsTime = performance.now() - startTime;

    if (infoElem != null) {
      infoElem.textContent = `\
      fps: ${(1 / deltaTime).toFixed(1)}
      js: ${jsTime.toFixed(1)}ms
      `;
    }
    requestAnimationFrame(draw);
  };

  draw();
}

init();
