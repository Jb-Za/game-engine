import { Camera } from "../../camera/Camera";
import { GeometryBuffersCollection } from "../../attribute_buffers/GeometryBuffersCollection";
import { AmbientLight } from "../../lights/AmbientLight";
import { Color } from "../../math/Color";
import { Vec3 } from "../../math/Vec3";
import { Texture2D } from "../../texture/Texture2D";
import { InputManager } from "../../input/InputManager";
import { Circle2D } from "../../game_objects/2D/Circle2D";
import { PointLightsCollection } from "../../lights/PointLight";
import { WaterParticle } from "./WaterParticle";
import { SPHSimulatorGPU } from "./SPHSimulatorGPU";
import { Vec2 } from "../../math/Vec2";

let animationFrameId: number | null = null;

async function init(canvas: HTMLCanvasElement, device: GPUDevice, gpuContext: GPUCanvasContext, presentationFormat: GPUTextureFormat, infoElem: HTMLPreElement) {
  if (presentationFormat) {
  } // lazy linting

  const inputManager = new InputManager(canvas);

  let mouseX = 0;
  let mouseY = 0;
  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    // Check that the mouse is over the canvas
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
      return;
    }

    if (!rect) return;

    mouseX = (e.clientX - rect.left) / rect.width;
    mouseY = (e.clientY - rect.top) / rect.height;
  });
  GeometryBuffersCollection.initialize(device);

  // DEPTH TEXTURE
  const depthTexture = Texture2D.createDepthTexture(device, canvas.width, canvas.height);

  // LIGHTS
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

  // 2D CAMERA
  const camera = new Camera(device, canvas.width / canvas.height, inputManager);
  camera.eye = new Vec3(0, 0, 20);
  camera.target = new Vec3(0, 0, 0);
  camera.fov = 30;
  camera.near = 0.1;
  camera.far = 100;

  // SIMULATION SETUP
  const NumWaterParticles = 4000;
  const particleRadius = 0.1;
  const particleSpacing = 0.15;
  const spacing = particleRadius * 2 + particleSpacing;

  const parameters = {
    gravity: -10,
    targetDensity: 8.0,
    pressureMultiplier: 100.0,
    nearPressureMultiplier: 2.0,
    viscosityStrength: 10.0,
    smoothingRadius: 0.7,
  };

  // Create SPH simulator
  const gridCellSize = parameters.smoothingRadius;
  const containerBounds = {
    minX: -28,
    maxX: 28,
    minY: -14,
    maxY: 14,
  };

  const waterParticles: WaterParticle[] = [];
  let particleIndex = 0;
  let ring = 0;

  while (particleIndex < NumWaterParticles) {
    if (ring === 0) {
      // Center particle
      const particle = new WaterParticle(new Vec2(0, 0), {
        radius: particleRadius,
        mass: 1.0,
      });
      waterParticles.push(particle);
      particleIndex++;
      ring++;
    } else {
      // Calculate particles in this ring for tight packing
      const circumference = 2 * Math.PI * ring * spacing;
      const particlesInRing = Math.floor(circumference / spacing);
      const radius = ring * spacing;

      for (let j = 0; j < particlesInRing && particleIndex < NumWaterParticles; j++) {
        const angle = (2 * Math.PI * j) / particlesInRing;
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);

        const particle = new WaterParticle(new Vec2(x, y), {
          radius: particleRadius,
          mass: 1.0,
        });
        waterParticles.push(particle);
        particleIndex++;
      }
      ring++;
    }
  }

  // Add particles to simulator
  const sphSimulator = new SPHSimulatorGPU(device, gridCellSize, waterParticles, containerBounds, parameters);

  const handleInput = () => {
    // Handle user input for controlling the simulation
    if (inputManager.isKeyDown("m")) {
      sphSimulator.pressureMultiplier += 0.1; // Increase pressure
    }
    if (inputManager.isKeyDown("n")) {
      sphSimulator.pressureMultiplier -= 0.1; // Decrease pressure
    }
    if (inputManager.isKeyDown("ArrowLeft")) {
      sphSimulator.showParticle = Math.max(0, sphSimulator.showParticle - 1);
    }
    if (inputManager.isKeyDown("ArrowRight")) {
      sphSimulator.showParticle = Math.min(NumWaterParticles - 1, sphSimulator.showParticle + 1);
    }
    if (inputManager.isKeyDown("ArrowUp")) {
      sphSimulator.smoothingRadius = Math.max(0, sphSimulator.smoothingRadius + 0.005);
    }
    if (inputManager.isKeyDown("ArrowDown")) {
      sphSimulator.smoothingRadius = Math.max(0, sphSimulator.smoothingRadius - 0.005);
    }
    if (inputManager.isMouseDown(2)) {
      mouseBounds.color = new Color(1, 0, 0, 1); // Red if mouse button 2
      sphSimulator.setMousePressed(true, false);
      sphSimulator.setMousePosition(mouseBounds.position.x, mouseBounds.position.y);
      sphSimulator.setMouseForceStrength(20.0);
      sphSimulator.setMouseRadius(mouseBounds.scale.x * 2.0);
    } else if (inputManager.isMouseDown(0)) {
      mouseBounds.color = new Color(0, 0, 1, 1); // Blue if mouse button 2
      sphSimulator.setMousePressed(false, true);
      sphSimulator.setMousePosition(mouseBounds.position.x, mouseBounds.position.y);
      sphSimulator.setMouseForceStrength(20.0);
      sphSimulator.setMouseRadius(mouseBounds.scale.x * 2.0);
    } else {
      mouseBounds.color = new Color(0, 1, 0, 1); // Green otherwise
      sphSimulator.setMousePressed(false, false);
    }
    if (inputManager.isMouseWheelUp()) {
      mouseBounds.scale = Vec3.add(mouseBounds.scale, new Vec3(0.2, 0.2, 0.0));
    }
    if (inputManager.isMouseWheelDown()) {
      mouseBounds.scale = Vec3.subtract(mouseBounds.scale, new Vec3(0.2, 0.2, 0.0));
    }
  };

  const mouseBounds = new Circle2D(device, camera, ambientLight, pointLights, true);
  mouseBounds.scale = new Vec3(4, 4, 1);
  mouseBounds.color = new Color(1, 0, 0, 1);
  mouseBounds.position = new Vec3(0, 0, 1);
  let zDist = 19.9999; // distance in front of camera
  let halfHeight = zDist * Math.tan((camera.fov * Math.PI) / 180);
  let halfWidth = halfHeight * (canvas.width / canvas.height); // Use actual canvas aspect ratio
  const handleMouseMovement = () => {
    let worldX = -(mouseX * 2 - 1) * halfWidth;
    let worldY = (1 - mouseY * 2) * halfHeight;
    let worldZ = camera.eye.z - zDist + 5.2;

    mouseBounds.position = new Vec3(worldX, worldY, worldZ);
  };

  let then = performance.now() * 0.001;

  const update = (deltaTime: number) => {
    handleInput();
    handleMouseMovement();

    mouseBounds.update();
    // Update camera and lights
    camera.update();
    ambientLight.update();
    pointLights.update();

    // Run SPH simulation
    sphSimulator.update(deltaTime);
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
    }); // Render particles directly from GPU buffers (no CPU roundtrip)
    sphSimulator.getComputeManager().drawParticles(passEncoder, camera.buffer.buffer);
    mouseBounds.draw(passEncoder);
    passEncoder.end();
  };

  const draw = () => {
    let now = performance.now();
    now *= 0.001; // convert to seconds
    const deltaTime = now - then;
    then = now;

    const startTime = performance.now();

    update(deltaTime);

    const commandEncoder = device.createCommandEncoder();
    scenePass(commandEncoder);

    device.queue.submit([commandEncoder.finish()]);

    const jsTime = performance.now() - startTime;
    if (infoElem != null) {
      infoElem.textContent = `\
        2D Water Simulation
        fps: ${(1 / deltaTime).toFixed(1)}
        js: ${jsTime.toFixed(1)}ms
        particles: ${NumWaterParticles}
        pressure: ${sphSimulator.pressureMultiplier.toFixed(2)}
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
