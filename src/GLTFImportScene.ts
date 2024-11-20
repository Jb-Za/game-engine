import { Camera } from "./camera/Camera";
//mport { Ball } from "./game_objects/Ball";
//import { Paddle } from "./game_objects/Paddle";
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
//import { Cube } from "./game_objects/Cube";
import { ObjectMap } from "./game_objects/ObjectMap";
import { uploadGLB } from "./gltb/GLB_Upload";
import shaderSource from "./shaders/GLTFShader.wgsl?raw";
import { GLTFMesh } from "./gltb/GLTFMesh";

async function init() {
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  const gpuContext = canvas.getContext("webgpu") as GPUCanvasContext;

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
    format: "bgra8unorm",
  });

  //Input Manager
  const inputManager = new InputManager(canvas);
  //GeometryBuffersCollection.initialize(device);

  const objectMap = new ObjectMap();

  // DEPTH TEXTURE
  const depthTexture = Texture2D.createDepthTexture(
    device,
    canvas.width,
    canvas.height
  );
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
  // const floor = new Floor(
  //   device,
  //   camera,
  //   shadowCamera,
  //   ambientLight,
  //   directionalLight,
  //   pointLights
  // );
  // floor.pipeline.shadowTexture = shadowTexture;
  // // floor.scale = new Vec3(40, 0.1, 40);
  // floor.position = new Vec3(3, 0, 0);

  async function loadGLBFromURL(url: string, device: GPUDevice, camera: Camera, shadowCamera: ShadowCamera, ambientLight: AmbientLight, directionalLight: DirectionalLight,  pointLights: PointLightsCollection) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return uploadGLB(arrayBuffer, device, camera, shadowCamera, ambientLight, directionalLight, pointLights);
  }

  const glbMesh: GLTFMesh = await loadGLBFromURL("../assets/gltf/walking.glb", device, camera, shadowCamera, ambientLight, directionalLight, pointLights);
  glbMesh.scale = new Vec3(1, 1, 1);
  glbMesh.position = new Vec3(0, 0, 0);
  glbMesh.pipeline.shadowTexture = shadowTexture;
  //gltfObjects.shadow;

  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "e") {
      console.log(camera.eye);
      console.log(camera.target);
    }
  });

  const update = () => {
    camera.update();
    ambientLight.update();
    directionalLight.update();
    pointLights.update();
    //floor.update();
    shadowCamera.update();
    glbMesh.update();
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
        view: depthTexture.texture.createView(),
        depthLoadOp: "clear",
        depthStoreOp: "store",
        depthClearValue: 1.0,
      },
    });

    // DRAW HERE
    //floor.draw(renderPassEncoder);
    objectMap.objects.forEach((object) => {
      object.draw(renderPassEncoder);
    });

    glbMesh.draw(renderPassEncoder);
    renderPassEncoder.end();
  };

  let then = 0;

  const draw = () => {
    let now = performance.now();
    now *= 0.001; // convert to seconds
    const deltaTime = now - then;
    then = now;
    const startTime = performance.now();
    update();
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
    requestAnimationFrame(draw);
  };

  draw();
}

init();
