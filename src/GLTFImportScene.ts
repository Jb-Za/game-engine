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
import gltfWGSL from "./shaders/gltf.wgsl?raw";
import { convertGLBToJSONAndBinary, GLTFSkin } from "./gltf/glbUtils";
import { Mat4x4 } from "./math/Mat4x4";

async function init() {
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;
  const gpuContext = canvas.getContext("webgpu") as GPUCanvasContext;
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

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
    format: "depth32float", // CHANGED from "depth24plus" to "depth32float"
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

  // Fetch whale resources from the glb file
  const gltfScene = await fetch("../../assets/gltf/whale.glb")
    .then((res) => res.arrayBuffer())
    .then((buffer) => convertGLBToJSONAndBinary(buffer, device));

  // Debug: print mesh attributes
  if (gltfScene.meshes && gltfScene.meshes.length > 0) {
    const mesh = gltfScene.meshes[0];
    if (mesh.primitives && mesh.primitives.length > 0) {
      console.log("Whale mesh attributes:", Object.keys(mesh.primitives[0]['attributeMap']));
    }
  }

  // Camera bind group layout for whale: single mat4x4 (projectionView)
  const cameraBGCluster = device.createBindGroupLayout({
    label: "Camera.bindGroupLayout",
    entries: [
      {
        binding: 0,
        buffer: { type: "uniform" },
        visibility: GPUShaderStage.VERTEX,
      },
    ],
  });

  const generalUniformsBGCLuster = device.createBindGroupLayout({
    label: "General.bindGroupLayout",
    entries: [
      {
        binding: 0,
        buffer: { type: "uniform" },
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
      },
    ],
  });

  // Node uniforms bind group layout (already in your code)
  const nodeUniformsBindGroupLayout = device.createBindGroupLayout({
    label: "NodeUniforms.bindGroupLayout",
    entries: [
      {
        binding: 0,
        buffer: { type: "uniform" },
        visibility: GPUShaderStage.VERTEX,
      },
    ],
  });

  // Build whale pipeline with new camera layout (single mat4x4)
  gltfScene.meshes[0].buildRenderPipeline(device, gltfWGSL, gltfWGSL, presentationFormat, depthTexture.format, [
    cameraBGCluster,
    generalUniformsBGCLuster,
    nodeUniformsBindGroupLayout,
    GLTFSkin.skinBindGroupLayout,
  ]);

  
  // --- BEGIN: Whale GLTF Uniform Buffers and Bind Groups ---
  // Use the Camera class's buffer for MVP matrices (projView or whatever is in camera.buffer)
  const cameraBindGroup = device.createBindGroup({
    layout: cameraBGCluster,
    entries: [
      { binding: 0, resource: { buffer: camera.buffer.buffer } },
    ],
  });

  // General uniforms buffer (e.g., render mode, skin mode)
  const generalUniformsBuffer = device.createBuffer({
    size: Uint32Array.BYTES_PER_ELEMENT * 2,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const generalUniformsBindGroup = device.createBindGroup({
    layout: generalUniformsBGCLuster,
    entries: [
      { binding: 0, resource: { buffer: generalUniformsBuffer } },
    ],
  });
  // --- END: Whale GLTF Uniform Buffers and Bind Groups ---
  // Track the skin mode to toggle between skinned and non-skinned
  let skinMode = 1;

  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "e") {
      console.log(camera.eye);
      console.log(camera.target);
    }    // Toggle skin mode with 'E' key
    if (e.key === "e" || e.key === "E") {
      skinMode = skinMode === 0 ? 1 : 0;
      console.log(`Skin mode switched to: ${skinMode === 0 ? 'Skinned' : 'Non-skinned'} (skin_mode=${skinMode})`);
    }
  });

  const update = (deltaTime: number) => {
    camera.update();
    ambientLight.update();
    directionalLight.update();
    pointLights.update();
    shadowCamera.update();
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

  // Store original matrices for skin joints
  const origMatrices = new Map<number, any>();

  let then = performance.now() * 0.001;

  const draw = () => {
    let now = performance.now();
    now *= 0.001; // convert to seconds
    const deltaTime = now - then;
    then = now;
    const startTime = performance.now();
    update(deltaTime);

    // --- BEGIN: Whale GLTF Uniform Buffer Updates ---
    // Animate whale skin joints (simple example: swing bones by angle)
    if (gltfScene.skins && gltfScene.skins.length > 0) {
      const t = now * 0.5; // time-based angle
      const angle = Math.sin(t) * 0.3; // amplitude can be adjusted
      const skin = gltfScene.skins[0];
      for (let i = 0; i < skin.joints.length; i++) {
        const joint = skin.joints[i];
        const node = gltfScene.nodes[joint];
        if (!origMatrices.has(joint)) {
          origMatrices.set(joint, node.source.getMatrix());
        }
        const origMatrix = origMatrices.get(joint);
        let m: any;
        if (joint === 0 || joint === 1) {
          m = Mat4x4.multiply(origMatrix, Mat4x4.rotationY(-angle));
        } else if (joint === 3 || joint === 4) {
          m = Mat4x4.multiply(origMatrix, Mat4x4.rotationX(joint === 3 ? angle : -angle));
        } else {
          m = Mat4x4.multiply(origMatrix, Mat4x4.rotationZ(angle));
        }        // Use the setMatrix method which handles everything properly
        node.source.setMatrix(m);
        //console.log("Animating joint", joint, "angle", angle, node.source.position, node.source.scale, node.source.rotation);
      }
    }
    // After animating joints, update all node world matrices
    for (const scene of gltfScene.scenes) {
      scene.root.updateWorldMatrix(device);
    }
    // Update all skins (for animation)
    if (gltfScene.skins) {
      for (let i = 0; i < gltfScene.skins.length; ++i) {
        // Find the node index that uses this skin
        for (let n = 0; n < gltfScene.nodes.length; ++n) {
          if (gltfScene.nodes[n].skin === gltfScene.skins[i]) {
            gltfScene.skins[i].update(device, n, gltfScene.nodes);
          }
        }
      }    }
    // Set skin_mode based on our skinMode variable (0=skinned, 1=non-skinned) and render_mode=0 (default)
    device.queue.writeBuffer(generalUniformsBuffer, 0, new Uint32Array([0, skinMode])); //render_mode=0, skin_mode=variable
    // --- END: Whale GLTF Uniform Buffer Updates ---

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

    // --- BEGIN: Whale GLTF Draw Call ---
    // Draw the whale mesh using the correct bind groups
    for (const scene of gltfScene.scenes) {
      scene.root.renderDrawables(renderPassEncoder, [
        cameraBindGroup,
        generalUniformsBindGroup,
      ]);
    }
    // --- END: Whale GLTF Draw Call ---

    // Draw your other objects as before
    objectMap.objects.forEach((object) => {
      object.draw(renderPassEncoder);
    });
    floor.draw(renderPassEncoder);
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
