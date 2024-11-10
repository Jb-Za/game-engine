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
import { GameObject, ObjectMap } from "./game_objects/ObjectMap";
async function init() {
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  const gpuContext = canvas.getContext("webgpu") as GPUCanvasContext;
  
  const infoElem = document.querySelector('#info');
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

  const objectMap = new ObjectMap();

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
  camera.eye = new Vec3(5, 2, 4);
  camera.target = new Vec3(4, 2, 3);

  //
  const shadowCamera = new ShadowCamera(device);
  shadowCamera.eye = new Vec3(0, 0, -20); // Let's imagine it as a negative direction light * -20 or any other fitting scalar


  // Game Objects
  const floor = new Floor(device, camera, shadowCamera, ambientLight, directionalLight, pointLights);
  floor.pipeline.shadowTexture = shadowTexture;
  floor.scale = new Vec3(40, 0.1, 40)
  floor.position = new Vec3(0, -2, 0);

  // const cubes: Array<GameObject> = [];
  for(let i = 0; i < 20; i++){
    objectMap.createCube({device,camera,shadowCamera,ambientLight,directionalLight,pointLights}, shadowTexture, true)
  }

 
  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if(e.key === 'e'){
      console.log(camera.eye);
      console.log(camera.target);
    }
  });


  const createOrbit = (orbitPoint: Vec3, objectMap: ObjectMap) => {
    const orbitRadius = 4;
    objectMap.objects.forEach((object: GameObject) => {
      const distance = Math.random() * orbitRadius;
      // Calculate random direction within the sphere
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.random() * Math.PI;
      const x = distance * Math.sin(phi) * Math.cos(theta);
      const y = distance * Math.sin(phi) * Math.sin(theta);
      const z = distance * Math.cos(phi);
      //object.scale = new Vec3
      // Set the object's position relative to the orbit point
      const position = new Vec3(orbitPoint.x + x, orbitPoint.y + y, orbitPoint.z + z);
      object.scale = Vec3.scale(object.scale, getRandomArbitrary(0.5, 0.8));
      object.orbitInitialPosition = position;
      object.orbitAxis = Vec3.normalize(Vec3.subtract(new Vec3(Math.random(), Math.random(), Math.random()), orbitPoint));
      object.orbit = true;
      object.orbitDistance = distance;
      object.orbitDirection = (Math.random()>=0.5)? 1 : -1;
      
    });
  }

  const getRandomArbitrary = (min: number, max: number) => {
    return Math.random() * (max - min) + min;
  }

  createOrbit(new Vec3(0, 3, 0), objectMap);

  const update = () => {
    camera.update();
    objectMap.objects.forEach((object) => {
      object.update();
    }); 
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
    requestAnimationFrame(draw);
  };

  draw();
}

init();
