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
  // canvas!.addEventListener("click", async () => {
  //   await canvas!.requestPointerLock();
  // });
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

  const NumWaterParticles = 400;
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

  const handleInput = () => {
    // Handle user input for controlling the simulation
    if (inputManager.isKeyDown("ArrowUp")) {
      waterParticles.forEach(p => {
        p.densityRadius += 0.1;
      });
    }
    if (inputManager.isKeyDown("ArrowDown")) {
      waterParticles.forEach(p => {
        p.densityRadius -= 0.1;
      });
    }

  };

  let then = performance.now() * 0.001;
  const targetFPS = 60;
  const minFrameTime = 1 / targetFPS;
  let lastDrawTime = performance.now() * 0.001;

  let nearbyRadius = 0.5;
  const update = (deltaTime: number) => {
    handleInput();
    
    // Update camera
    camera.update();

    // Update lights
    ambientLight.update();
    pointLights.update();

    // SPH simulation with proper neighbor finding
    for (let i = 0; i < waterParticles.length; i++) {
      const particle = waterParticles[i];
      const neighbors: { particle: WaterParticle, distance: number }[] = [];
      
      // Find neighbors within interaction radius
      for (let j = 0; j < waterParticles.length; j++) {
        if (i === j) continue; // Skip self
        
        const other = waterParticles[j];
        const dx = particle.position.x - other.position.x;
        const dy = particle.position.y - other.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Use the particle's densityRadius as interaction range
        if (distance <= particle.densityRadius) {
          neighbors.push({ particle: other, distance });
        }
      }
      
      // Update particle with only nearby neighbors
      particle.update(neighbors, deltaTime);
      
      // Sync sprite position
      const sprite = particleSprites[i];
      sprite.position = new Vec3(particle.position.x, particle.position.y, 0);
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
    // if (now - lastDrawTime < minFrameTime) {
    //   animationFrameId = requestAnimationFrame(draw);
    //   return;
    // }

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
    //console.log('density:, ', waterParticles[50].density, ' densityRadius: ', waterParticles[50].densityRadius);

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
