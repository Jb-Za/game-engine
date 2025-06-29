import { Camera } from "../camera/Camera";
//mport { Ball } from "./game_objects/Ball";
//import { Paddle } from "./game_objects/Paddle";
import { GeometryBuffersCollection } from "../attribute_buffers/GeometryBuffersCollection";
import { AmbientLight } from "../lights/AmbientLight";
import { Color } from "../math/Color";
import { Vec3 } from "../math/Vec3";
import { Texture2D } from "../texture/Texture2D";
import { DirectionalLight } from "../lights/DirectionalLight";
import { PointLightsCollection } from "../lights/PointLight";
import { Floor } from "../game_objects/Floor";
import { InputManager } from "../input/InputManager";
import { ShadowCamera } from "../camera/ShadowCamera";
//import { Cube } from "./game_objects/Cube";
import { ObjectMap } from "../game_objects/ObjectMap";
import { Ball } from "../game_objects/Ball";
import { Mat4x4 } from "../math/Mat4x4";
import { Vec4 } from "../math/Vec4";

let animationFrameId: number | null = null;

async function init(canvas: HTMLCanvasElement, device: GPUDevice, gpuContext: GPUCanvasContext, presentationFormat: GPUTextureFormat, infoElem: HTMLPreElement){
  canvas!.addEventListener("click", async () => {
    await canvas!.requestPointerLock();
  });

  //Input Manager
  const inputManager = new InputManager(canvas);

  GeometryBuffersCollection.initialize(device);

  const objectMap = new ObjectMap();

  // DEPTH TEXTURE
  const depthTexture = Texture2D.createDepthTexture(
    device,
    canvas.width,
    canvas.height
  );
  const shadowTexture = Texture2D.createShadowTexture(
    device,
    3072,
    3072
  );
  // LIGHTS
  const ambientLight = new AmbientLight(device);
  ambientLight.color = new Color(1, 1, 1, 1);
  ambientLight.intensity = 0.6;

  const directionalLight = new DirectionalLight(device);
  directionalLight.color = new Color(1, 1, 1, 1);
  directionalLight.intensity = 0;
  directionalLight.direction = new Vec3(-1,0,0);
  directionalLight.specularIntensity = 0;
  directionalLight.specularColor = new Color(1,0,0,1);

  const pointLights = new PointLightsCollection(device, 3);
  pointLights.lights[0].color = new Color(0, 0, 1, 1);
  pointLights.lights[0].intensity = 0.6;
  pointLights.lights[0].position = new Vec3(5.74, 2.48, -3.0);
  pointLights.lights[1].intensity = 1;
  pointLights.lights[1].specularIntensity = 0;
  pointLights.lights[1].position = new Vec3(5.74, 2.48, -3.0);
  pointLights.lights[2].intensity = 0;
  pointLights.lights[2].specularIntensity = 0;

  //Game Objects
  const camera = new Camera(device, canvas.width / canvas.height, inputManager);
  camera.eye = new Vec3(5.74, 1.96, 4.44);
  camera.target = new Vec3(5.02, 1.94, 3.94);

  //
  const shadowCamera = new ShadowCamera(device);
  shadowCamera.eye = new Vec3(5.74, 2.48, -3.0); // Let's imagine it as a negative direction light * -20 or any other fitting scalar
  shadowCamera.target = new Vec3(4.85, 2.38, -2.61);

  // Game Objects
  const floor = new Floor(device, camera, shadowCamera, ambientLight, directionalLight, pointLights);
  floor.pipeline.shadowTexture = shadowTexture;
  floor.scale = new Vec3(40, 0.1, 40)
  floor.position = new Vec3(0, -2, 0);
  const wall1 = new Floor(device, camera, shadowCamera, ambientLight, directionalLight, pointLights);
  wall1.pipeline.shadowTexture = shadowTexture;
  wall1.scale = new Vec3(0.1, 40, 40)
  wall1.position = new Vec3(-5, 0, 0);

  // const cubes: Array<GameObject> = [];
  for(let i = 0; i < 15; i++){
    objectMap.createSphere({device,camera,shadowCamera,ambientLight,directionalLight,pointLights}, shadowTexture, true);
    objectMap.createCube({device,camera,shadowCamera,ambientLight,directionalLight,pointLights}, shadowTexture, true);
  }

 
  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if(e.key === 'e'){
      console.log(camera.eye);
      console.log(camera.target);
    }
  });


  const createOrbit = (orbitPoint: Vec3, objectMap: ObjectMap) => {
    const orbitRadius = 2.5;
    objectMap.objects.forEach((object) => {
      const distance = getRandomArbitrary(0.5, 1) * orbitRadius;
  
      // Calculate random initial position on a sphere
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.random() * Math.PI;
      const x = distance * Math.sin(phi) * Math.cos(theta);
      const y = distance * Math.sin(phi) * Math.sin(theta);
      const z = distance * Math.cos(phi);
  
      // Set object's initial relative position from orbitPoint
      const position = new Vec3(x, y, z); // Relative to orbitPoint
      object.orbitInitialPosition = position;
      object.orbitAxis = _getRandomOrthogonalVector(orbitPoint, position); // Use a consistent orbit axis (e.g., Y-axis)
      object.orbit = true;
      object.orbitDistance = distance;
      object.orbitPoint = orbitPoint;
      object.scale = Vec3.scale(object.scale, getRandomArbitrary(0.1, 0.4));
      //object.orbitDirection = (Math.random() >= 0.5) ? 1 : -1;
    });
  }

  const getRandomArbitrary = (min: number, max: number) => {
    return Math.random() * (max - min) + min;
  }

  const _getRandomOrthogonalVector = (origin: Vec3 , point: Vec3): Vec3 => {
    const distance: Vec3 = Vec3.subtract(point, origin);
    let arb_vec: Vec3;
    if(distance.y !== 0 || distance.z !== 0){
      arb_vec = new Vec3(1 , 0 , 0);
    }
    else{
      arb_vec = new Vec3(0 , 1 , 0);
    }
  
    const u = Vec3.normalize(Vec3.cross(distance , arb_vec));
    const v = Vec3.normalize(Vec3.cross(distance, u));
    
    const theta = Math.random() * 2 * Math.PI;
    
    return Vec3.add(Vec3.multiplyScalar(u , Math.cos(theta)) , Vec3.multiplyScalar(v , Math.sin(theta)));
  }

  createOrbit(new Vec3(0, 2, 0), objectMap);
  const orbitPoint = new Ball(device, camera, shadowCamera, ambientLight, directionalLight, pointLights);
  orbitPoint.pipeline.shadowTexture = shadowTexture;
  orbitPoint.scale = new Vec3(0.1,0.1,0.1);
  orbitPoint.position = new Vec3(0, 2, 0);

  const update = () => {
    camera.update();
    objectMap.objects.forEach((object) => {
      if (object.orbit) {
        const angle = performance.now() * 0.001;
        const rotationMatrix = Mat4x4.rotationAxis(object.orbitAxis, angle);
    
        // Step 1: Translate object to origin (relative position)
        const relativePosition = new Vec4(object.orbitInitialPosition.x, object.orbitInitialPosition.y, object.orbitInitialPosition.z, 1);
    
        // Step 2: Rotate the relative position
        const rotatedPosition = Mat4x4.transformVec4(rotationMatrix, relativePosition);
    
        // Step 3: Translate back to orbitPoint
        object.position.x = object.orbitPoint.x + rotatedPosition.x;
        object.position.y = object.orbitPoint.y + rotatedPosition.y;
        object.position.z = object.orbitPoint.z + rotatedPosition.z;
      }
      object.update();
    });
    ambientLight.update();
    directionalLight.update();
    pointLights.update();
    floor.update();
    wall1.update();
    orbitPoint.update();
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
    floor.draw(renderPassEncoder);
    wall1.draw(renderPassEncoder);
    orbitPoint.draw(renderPassEncoder);
    objectMap.objects.forEach((object) => {
      object.draw(renderPassEncoder);
    }); 
    renderPassEncoder.end();
  };

  let then = 0;
  
  const draw = () => {
    let now = performance.now();
    now *= 0.001;  // convert to seconds
    const deltaTime = now - then;
    then = now;
    const startTime = performance.now();
    update();
    const commandEncoder = device.createCommandEncoder();
    shadowPass(commandEncoder);
    scenePass(commandEncoder);
    device.queue.submit([commandEncoder.finish()]);

    const jsTime = performance.now() - startTime;

    if(infoElem != null){
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
