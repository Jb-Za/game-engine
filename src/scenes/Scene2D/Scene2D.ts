import { Camera } from "../../camera/Camera";
import { GeometryBuffersCollection } from "../../attribute_buffers/GeometryBuffersCollection";
import { AmbientLight } from "../../lights/AmbientLight";
import { Color } from "../../math/Color";
import { Vec3 } from "../../math/Vec3";
import { Texture2D } from "../../texture/Texture2D";
import { InputManager } from "../../input/InputManager";
import { Quad2D } from "../../game_objects/2D/Quad2D";
import { Circle2D } from "../../game_objects/2D/Circle2D";
import { PointLightsCollection } from "../../lights/PointLight";
let animationFrameId: number | null = null;

async function init(canvas: HTMLCanvasElement, device: GPUDevice, gpuContext: GPUCanvasContext, presentationFormat: GPUTextureFormat, infoElem: HTMLPreElement) {
  if (presentationFormat) {
  } // lazy linting
  // Input Manager
  const inputManager = new InputManager(canvas);

  GeometryBuffersCollection.initialize(device);
  // DEPTH TEXTURE
  const depthTexture = Texture2D.createDepthTexture(device, canvas.width, canvas.height);  // LIGHTS
  const ambientLight = new AmbientLight(device);
  ambientLight.color = new Color(1, 1, 1, 1);
  ambientLight.intensity = 1; // Ambient lighting for 2D

  const pointLights = new PointLightsCollection(device, 3);
  pointLights.lights[0].color = new Color(0, 0, 0, 1);
  pointLights.lights[0].intensity = 0;

  pointLights.lights[1].color = new Color(0, 0, 0, 1);
  pointLights.lights[1].intensity = 0;

  pointLights.lights[2].color = new Color(0, 0, 0, 1);
  pointLights.lights[2].intensity = 0;

  // 2D CAMERA (Using perspective but positioned for 2D-like view)
  const camera = new Camera(device, canvas.width / canvas.height, inputManager);
  camera.eye = new Vec3(0, 0, 20);
  camera.target = new Vec3(0, 0, 0);
  camera.fov = 30; // Smaller FOV for more orthographic-like appearance
  camera.near = 0.1;
  camera.far = 100;

  // CREATE 2D SPRITES
  const sprites: (Quad2D | Circle2D)[] = [];
  
  // Create a red quad
  const quad = new Quad2D(device, camera, ambientLight, pointLights);
  quad.color = new Color(1, 0, 0, 1); // Bright red
  quad.scale = new Vec3(2, 2, 1); // Scale for visibility
  quad.position = new Vec3(-3, 0, 0);
  sprites.push(quad);

  // Create a blue circle
  const circle = new Circle2D(device, camera, ambientLight, pointLights);
  circle.color = new Color(0, 0, 1, 1); // Bright blue
  circle.scale = new Vec3(1.5, 1.5, 1); // Scale for visibility
  circle.position = new Vec3(3, 0, 0);
  sprites.push(circle);


  let then = performance.now() * 0.001;
  const targetFPS = 60;
  const minFrameTime = 1 / targetFPS;
  let lastDrawTime = performance.now() * 0.001;
    const update = (/*deltaTime: number*/) => {
    // Update camera
    camera.update();

    // Update lights
    ambientLight.update();
    pointLights.update();

    // Add simple animation - rotate sprites
    sprites.forEach((sprite) => {
      sprite.update();
    });
  };

  const scenePass = (commandEncoder: GPUCommandEncoder) => {
    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: gpuContext.getCurrentTexture().createView(),
          clearValue: { r: 0.1, g: 0.1, b: 0.2, a: 1.0 }, // Dark blue background
          loadOp: "clear",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: depthTexture.texture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });

    // Render sprites
    sprites.forEach((sprite) => {
      sprite.draw(passEncoder);
    });

    passEncoder.end();
  };

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

    update(/*deltaTime*/);

    const commandEncoder = device.createCommandEncoder();
    scenePass(commandEncoder);

    device.queue.submit([commandEncoder.finish()]);

    const jsTime = performance.now() - startTime;    if (infoElem != null) {
      infoElem.textContent = `\
        2D Scene Demo
        fps: ${(1 / deltaTime).toFixed(1)}
        js: ${jsTime.toFixed(1)}ms
        `;
    }

    animationFrameId = requestAnimationFrame(draw);
  }; 
  // Start the game loop
  draw();
}

function cleanup() {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

export { init, cleanup };
