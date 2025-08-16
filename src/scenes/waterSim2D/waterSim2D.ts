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
import { WaterParticle } from "./WaterParticle";
import { Vec2 } from "../../math/Vec2";
let animationFrameId: number | null = null;

async function init(canvas: HTMLCanvasElement, device: GPUDevice, gpuContext: GPUCanvasContext, presentationFormat: GPUTextureFormat, infoElem: HTMLPreElement) {
  if (presentationFormat) {
  } // lazy linting
  // Input Manager
  const inputManager = new InputManager(canvas);

  GeometryBuffersCollection.initialize(device);
  // DEPTH TEXTURE
  const depthTexture = Texture2D.createDepthTexture(device, canvas.width, canvas.height); // LIGHTS
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
  const waterParticles: WaterParticle[] = [];
  const particleSprites: Circle2D[] = [];

  const NumWaterParticles = 100;
  for (let i = 0; i < NumWaterParticles; i++) {
    const circle = new Circle2D(device, camera, ambientLight, pointLights);
    circle.color = new Color(0, 0.3, 1, 1);
    // initial visual scale (will be overwritten by particle.radius mapping)
    circle.scale = new Vec3(0.1, 0.1, 1);
    particleSprites.push(circle);

    // initial particle position in world units
    const x = ((i % 10) - 5) ;
    const y = Math.floor(i / 10) ;
    const particle = new WaterParticle(new Vec2(x, y), { radius: circle.scale.x, mass: 1.0 });
    waterParticles.push(particle);
  }

  let then = performance.now() * 0.001;
  const targetFPS = 60;
  const minFrameTime = 1 / targetFPS;
  let lastDrawTime = performance.now() * 0.001;
  const update = (deltaTime: number) => {
    // Update camera
    camera.update();

    // Update lights
    ambientLight.update();
    pointLights.update();

    // naive neighbor search for now; replace with spatial hash later
    for (let i = 0; i < waterParticles.length; i++) {
      const p = waterParticles[i];
      const neighbors: WaterParticle[] = [];
      for (let j = 0; j < waterParticles.length; j++) {
        if (i === j) continue;
        // cheap distance check
        const dx = p.position.x - waterParticles[j].position.x;
        const dy = p.position.y - waterParticles[j].position.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= p.radius * 2) neighbors.push(waterParticles[j]);
      }
      p.update(neighbors, deltaTime);
    }

    // sync sprites to physics
    for (let i = 0; i < waterParticles.length; i++) {
      const p = waterParticles[i];
      const s = particleSprites[i];
      // map Vec2 -> Vec3 (z for draw order)
      s.position = new Vec3(p.position.x, p.position.y, 0);
      // visual scale depends on sprite default size; here assume sprite unit size = 1
      const size = p.radius * 2;
      s.scale = new Vec3(size, size, 1);
    }


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
    particleSprites.forEach((sprite) => {
      sprite.update();
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

    update(deltaTime);

    const commandEncoder = device.createCommandEncoder();
    scenePass(commandEncoder);

    device.queue.submit([commandEncoder.finish()]);

    const jsTime = performance.now() - startTime;
    if (infoElem != null) {
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
