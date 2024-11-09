import { Camera } from "./camera/Camera";
import { Ball } from "./game_objects/Ball";
import { Paddle } from "./game_objects/Paddle";
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
import { Cube } from "./game_objects/Cube";
async function init() {
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  const gpuContext = canvas.getContext("webgpu") as GPUCanvasContext;

  if (!gpuContext) {
    alert("WebGPU not supported");
    return;
  }

  canvas.addEventListener("click", async () => {
    await canvas.requestPointerLock();
  });

  const adapter = await navigator.gpu.requestAdapter();

  const device = await adapter!.requestDevice();

  gpuContext.configure({
    device: device,
    format: "bgra8unorm",
  });

  //Input Manager
  const inputManager = new InputManager(canvas);

  GeometryBuffersCollection.initialize(device);

  // DEPTH TEXTURE
  const depthTexture = Texture2D.createDepthTexture(
    device,
    canvas.width,
    canvas.height
  );
  const shadowTexture = Texture2D.createShadowTexture(
    device,
    canvas.width,
    canvas.height
  );
  // LIGHTS
  const ambientLight = new AmbientLight(device);
  ambientLight.color = new Color(1, 1, 1, 1);
  ambientLight.intensity = 0.6;

  const directionalLight = new DirectionalLight(device);
  directionalLight.color = new Color(1, 1, 1, 1);
  directionalLight.intensity = 0;
  directionalLight.direction = new Vec3(0,0,0);
  directionalLight.specularIntensity = 0;
  directionalLight.specularColor = new Color(1,0,0,1)

  const pointLights = new PointLightsCollection(device);
  pointLights.lights[0].color = new Color(0, 0, 1, 1);
  pointLights.lights[0].intensity = 1;
  pointLights.lights[0].position = new Vec3(0, 2.5, 0);

  //Game Objects
  const camera = new Camera(device, canvas.width / canvas.height, inputManager);
  camera.eye = new Vec3(0, 0, 0);
  camera.target = new Vec3(3, -1.7, 0);

  //
  const shadowCamera = new ShadowCamera(device);
  shadowCamera.eye = new Vec3(0, 10, 0); // Let's imagine it as a negative direction light * -20 or any other fitting scalar


  // Game Objects
  const floor = new Floor(
    device,
    camera,
    shadowCamera,
    ambientLight,
    directionalLight,
    pointLights
  );
  floor.pipeline.shadowTexture = shadowTexture;
  floor.scale = new Vec3(40, 0.1, 40)
  floor.position = new Vec3(0, -2, 0);

  const cube1 = new Cube(
    device,
    camera,
    shadowCamera,
    ambientLight,
    directionalLight,
    pointLights
  );
  cube1.pipeline.shadowTexture = shadowTexture;
  cube1.scale = new Vec3(0.5, 0.5, 0.5);
  cube1.position = new Vec3(3, -1, 0);
  cube1.orbit = true;
  cube1.orbitPoint = pointLights.lights[0].position;
  cube1.orbitDistance = Vec3.distance(cube1.position, pointLights.lights[0].position);


  const update = () => {
    camera.update();
    shadowCamera.target = cube1.position ;
    cube1.update();
    ambientLight.update();
    directionalLight.update();
    pointLights.update();
    floor.update();
    shadowCamera.update();
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
    cube1.drawShadows(renderPassEncoder);
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
    floor.draw(renderPassEncoder);
    cube1.draw(renderPassEncoder);
    renderPassEncoder.end();
  };

  const draw = () => {
    update();
    const commandEncoder = device.createCommandEncoder();
    shadowPass(commandEncoder);
    scenePass(commandEncoder);
    device.queue.submit([commandEncoder.finish()]);

    requestAnimationFrame(draw);
  };

  draw();
}

init();
