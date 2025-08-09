import { Camera } from "../camera/Camera";
import { Vec3 } from "../math/Vec3";
import computeShaderSource from "../shaders/RaytracingComputeShader.wgsl?raw";
import displayShaderSource from "../shaders/RaytracingDisplay.wgsl?raw";
import { RayTracedPlane, RayTracedSphere } from "../raytracing/Interface";

export class RayTracingRenderPipeline {
  private computePipeline!: GPUComputePipeline;
  private displayPipeline!: GPURenderPipeline;

  // Bind groups
  private cameraBindGroup!: GPUBindGroup;
  private sceneBindGroup!: GPUBindGroup;
  private displayBindGroup!: GPUBindGroup;

  // Textures and samplers
  private outputTexture!: GPUTexture;
  private outputSampler!: GPUSampler;

  // Storage buffers for scene data
  private spheresBuffer!: GPUBuffer;
  private planesBuffer!: GPUBuffer;
  private cameraBuffer!: GPUBuffer;
  private sceneCountsBuffer!: GPUBuffer;

  private frameBuffer!: GPUBuffer;
  private frame: number = 0;

  // Scene data
  private spheres: RayTracedSphere[] = [];
  private planes: RayTracedPlane[] = [];
  private previousFrameTexture!: GPUTexture;  private previousCameraEye: Vec3 = new Vec3(0, 0, 0);
  private previousCameraForward: Vec3 = new Vec3(0, 0, -1);

  constructor(private device: GPUDevice, private camera: Camera, private width: number, private height: number) {
    this.initializeTextures();
    this.initializeBuffers();
    this.createComputePipeline();
    this.createDisplayPipeline();
    this.createBindGroups();

    // Initialize with empty arrays after pipelines are created
    this.updateSpheres([]);
    this.updatePlanes([]);
  }

  private initializeTextures() {
    // Create output texture for raytracing results
    this.outputTexture = this.device.createTexture({
      size: [this.width, this.height],
      format: "rgba8unorm",
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
    });

    this.previousFrameTexture = this.device.createTexture({
      size: [this.width, this.height],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    // Create sampler for the output texture
    this.outputSampler = this.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
    });
  }

  private initializeBuffers() {
    // Create camera uniform buffer
    this.cameraBuffer = this.device.createBuffer({
      size: 20 * 4, // 20 floats = 80 bytes (aligned to 16 bytes)
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Create initial empty buffers - will be properly initialized later
    this.spheresBuffer = this.device.createBuffer({
      size: 44, // Minimum size for empty buffer (11 floats)
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.planesBuffer = this.device.createBuffer({
      size: 60, // Minimum size for empty buffer (15 floats)
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.frameBuffer = this.device.createBuffer({
      label: "Frame Buffer",
      size: 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Scene counts buffer (4 * 4 = 16 bytes, 4 u32s)
    this.sceneCountsBuffer = this.device.createBuffer({
      label: "Scene Counts Buffer",
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  private createComputePipeline() {
    const computeShaderModule = this.device.createShaderModule({
      code: computeShaderSource,
    });

    const computeBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          storageTexture: {
            access: "write-only",
            format: "rgba8unorm",
          },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        },
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          texture: { sampleType: "float" },
        },
      ],
    });

    const sceneBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        },
      ],
    });

    const computePipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [computeBindGroupLayout, sceneBindGroupLayout],
    });

    this.computePipeline = this.device.createComputePipeline({
      layout: computePipelineLayout,
      compute: {
        module: computeShaderModule,
        entryPoint: "main",
      },
    });
  }

  private createDisplayPipeline() {
    const displayShaderModule = this.device.createShaderModule({
      code: displayShaderSource,
    });

    this.displayPipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: displayShaderModule,
        entryPoint: "vs",
      },
      fragment: {
        module: displayShaderModule,
        entryPoint: "fs",
        targets: [
          {
            format: "bgra8unorm",
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
      },
    });
  }

  private createBindGroups() {
    // Camera bind group
    this.cameraBindGroup = this.device.createBindGroup({
      layout: this.computePipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.cameraBuffer,
          },
        },
        {
          binding: 1,
          resource: this.outputTexture.createView(),
        },
        {
          binding: 2,
          resource: {
            buffer: this.frameBuffer,
          },
        },
        {
          binding: 3,
          resource: this.previousFrameTexture.createView(),
        },
      ],
    });

    // Scene bind group (initial creation)
    this.sceneBindGroup = this.device.createBindGroup({
      layout: this.computePipeline.getBindGroupLayout(1),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.spheresBuffer,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: this.planesBuffer,
          },
        },
        {
          binding: 2,
          resource: {
            buffer: this.sceneCountsBuffer,
          },
        },
      ],
    });

    // Display bind group
    this.displayBindGroup = this.device.createBindGroup({
      layout: this.displayPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: this.outputTexture.createView(),
        },
        {
          binding: 1,
          resource: this.outputSampler,
        },
      ],
    });
  }

  private updateSceneBindGroup() {
    this.sceneBindGroup = this.device.createBindGroup({
      layout: this.computePipeline.getBindGroupLayout(1),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.spheresBuffer,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: this.planesBuffer,
          },
        },
        {
          binding: 2,
          resource: {
            buffer: this.sceneCountsBuffer,
          },
        },
      ],
    });
  }
  public updateCamera() {
    const previousEye = this.previousCameraEye || this.camera.eye;
    
    // Update camera data in buffer
    const cameraData = new Float32Array(20);
    // Eye position
    cameraData[0] = this.camera.eye.x;
    cameraData[1] = this.camera.eye.y;
    cameraData[2] = this.camera.eye.z;
    cameraData[3] = 0.0; // _pad0    // Use the camera's forward vector directly
    const forward = this.camera.forward;
    cameraData[4] = forward.x;
    cameraData[5] = forward.y;
    cameraData[6] = forward.z;
    cameraData[7] = 0.0; // _pad1
    // Right vector (cross product of forward and world up)
    const worldUp = new Vec3(0, 1, 0);
    const right = Vec3.normalize(Vec3.cross(forward, worldUp));
    cameraData[8] = right.x;
    cameraData[9] = right.y;
    cameraData[10] = right.z;
    cameraData[11] = 0.0; // _pad2
    // Up vector (cross product of right and forward)
    const up = Vec3.normalize(Vec3.cross(right, forward));
    cameraData[12] = up.x;
    cameraData[13] = up.y;
    cameraData[14] = up.z;
    cameraData[15] = 0.0; // _pad3
    // Half width and height (for ray generation)
    const aspectRatio = this.width / this.height;
    const fovRadians = (this.camera.fov * Math.PI) / 180;
    const halfHeight = Math.tan(fovRadians / 2);
    const halfWidth = halfHeight * aspectRatio;
    cameraData[16] = halfWidth;    
    cameraData[17] = halfHeight;
    cameraData[18] = 0.0; // _pad4.x
    cameraData[19] = 0.0; // _pad4.y

    // Check if the camera has moved or rotated
    const previousForward = this.previousCameraForward;
    if (!Vec3.equals(previousEye, this.camera.eye) || !Vec3.equals(previousForward, this.camera.forward)) {
      this.previousCameraEye = this.camera.eye;
      this.previousCameraForward = this.camera.forward;

      this.clearPreviousFrame();
    
    }
    this.device.queue.writeBuffer(this.cameraBuffer, 0, cameraData);
  }

  private clearPreviousFrame() {
     this.frame = 0;
     // Clear previous frame texture
      this.device.queue.writeTexture({ texture: this.previousFrameTexture }, new Uint8Array(this.width * this.height * 4), { bytesPerRow: this.width * 4, rowsPerImage: this.height }, [this.width, this.height]);
  }

  private spheresAreEqual = (a: RayTracedSphere[], b: RayTracedSphere[]): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const s = a[i], o = b[i];
    if (
      s.center.x !== o.center.x ||
      s.center.y !== o.center.y ||
      s.center.z !== o.center.z ||
      s.radius !== o.radius ||
      s.material.color.x !== o.material.color.x ||
      s.material.color.y !== o.material.color.y ||
      s.material.color.z !== o.material.color.z ||
      s.material.roughness !== o.material.roughness ||
      (s.material.emissionColor?.x ?? 0) !== (o.material.emissionColor?.x ?? 0) ||
      (s.material.emissionColor?.y ?? 0) !== (o.material.emissionColor?.y ?? 0) ||
      (s.material.emissionColor?.z ?? 0) !== (o.material.emissionColor?.z ?? 0) ||
      (s.material.emissionStrength ?? 0) !== (o.material.emissionStrength ?? 0) ||
      (s.material.reflectivity ?? 0) !== (o.material.reflectivity ?? 0) ||
      (s.material.indexOfRefraction ?? 0) !== (o.material.indexOfRefraction ?? 0)
    ) {
      return false;
    }
  }
  return true;
}

  public updateSpheres(spheres: RayTracedSphere[]) {
    if (!this.spheresAreEqual(this.spheres, spheres)) {
      this.spheres = spheres;

      this.clearPreviousFrame();

      const spheresInBuffer = spheres.length;
      const floatsPerSphere = 16;
      // Ensure we allocate at least one sphere slot (16 floats) even if there are no spheres
      // This prevents a zero-sized buffer which would cause binding errors
      const totalFloats = Math.max(spheresInBuffer * floatsPerSphere, floatsPerSphere);
      const sphereData = new Float32Array(totalFloats);

      for (let i = 0; i < spheres.length; i++) {
        const offset = i * floatsPerSphere;
        const sphere = spheres[i];

        // Center (vec3) + radius (f32) = vec4
        sphereData[offset + 0] = sphere.center.x;
        sphereData[offset + 1] = sphere.center.y;
        sphereData[offset + 2] = sphere.center.z;
        sphereData[offset + 3] = sphere.radius;
        // Material struct: color (vec3) + roughness (f32) = vec4
        sphereData[offset + 4] = sphere.material.color.x;
        sphereData[offset + 5] = sphere.material.color.y;
        sphereData[offset + 6] = sphere.material.color.z;
        sphereData[offset + 7] = sphere.material.roughness;

        // Material emission (vec3) + padding
        sphereData[offset + 8] = sphere.material.emissionColor?.x ?? 1.0;
        sphereData[offset + 9] = sphere.material.emissionColor?.y ?? 1.0;
        sphereData[offset + 10] = sphere.material.emissionColor?.z ?? 1.0;
        sphereData[offset + 11] = sphere.material.emissionStrength ?? 0.0;
        sphereData[offset + 12] = 0.0; // extra padding
        sphereData[offset + 13] = 0.0; // extra struct padding
        sphereData[offset + 14] = sphere.material.reflectivity ?? 0.0;// extra struct padding
        sphereData[offset + 15] = sphere.material.indexOfRefraction ?? 0.0;// extra struct padding
      }

      if (this.spheresBuffer) {
        this.spheresBuffer.destroy();
      }

      this.spheresBuffer = this.device.createBuffer({
        label: "Spheres Buffer",
        size: sphereData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });

      this.device.queue.writeBuffer(this.spheresBuffer, 0, sphereData);
      this.updateSceneCountsBuffer();
      this.updateSceneBindGroup();
    }
  }

  public updatePlanes(planes: RayTracedPlane[]) {
    this.planes = planes;

    // Each plane: position(3) + pad(1) + normal(3) + pad(1) + size(2) + pad(2) + color(3) + pad(1) + roughness(1) + emission(3) + pad(1) + struct_pad(1) = 24 floats
    const floatsPerPlane = 24;
    // Ensure at least one plane slot (24 floats) even if there are no planes
    const planeData = new Float32Array(Math.max(planes.length * floatsPerPlane, floatsPerPlane));

    for (let i = 0; i < planes.length; i++) {
      const offset = i * floatsPerPlane;
      const plane = planes[i];

      // Position (vec3) + padding
      planeData[offset + 0] = plane.position.x;
      planeData[offset + 1] = plane.position.y;
      planeData[offset + 2] = plane.position.z;
      planeData[offset + 3] = 0.0; // padding

      // Normal (vec3) + padding
      planeData[offset + 4] = plane.normal.x;
      planeData[offset + 5] = plane.normal.y;
      planeData[offset + 6] = plane.normal.z;
      planeData[offset + 7] = 0.0; // padding

      // Size (vec2) + padding
      planeData[offset + 8] = plane.size.x; // width
      planeData[offset + 9] = plane.size.y; // height
      planeData[offset + 10] = 0.0; // padding
      planeData[offset + 11] = 0.0; // padding

      // Material color (vec3) + padding
      planeData[offset + 12] = plane.material.color.x;
      planeData[offset + 13] = plane.material.color.y;
      planeData[offset + 14] = plane.material.color.z;
      planeData[offset + 15] = 0.0; // padding

      // Material roughness
      planeData[offset + 16] = plane.material.roughness;

      // Material emission (vec3) + padding
      planeData[offset + 17] = plane.material.emissionStrength ?? 0.0;
      planeData[offset + 18] = plane.material.emissionColor?.x ?? 0.0;
      planeData[offset + 19] = plane.material.emissionColor?.y ?? 0.0;
      planeData[offset + 20] = plane.material.emissionColor?.z ?? 0.0;
      planeData[offset + 21] = 0.0; // padding

      // Extra struct padding
      planeData[offset + 22] = 0.0;
      planeData[offset + 23] = 0.0;
    }

    if (this.planesBuffer) {
      this.planesBuffer.destroy();
    }

    this.planesBuffer = this.device.createBuffer({
      label: "Planes Buffer",
      size: planeData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.device.queue.writeBuffer(this.planesBuffer, 0, planeData);
    this.updateSceneCountsBuffer();
    this.updateSceneBindGroup();
  }

  private updateSceneCountsBuffer() {
    // SceneCounts struct: numSpheres, numPlanes, _pad0, _pad1 (all u32)
    const counts = new Uint32Array(4);
    counts[0] = this.spheres.length;
    counts[1] = this.planes.length;
    counts[2] = 0;
    counts[3] = 0;
    this.device.queue.writeBuffer(this.sceneCountsBuffer, 0, counts);
  }

  public compute(commandEncoder: GPUCommandEncoder) {
    // Update camera data
    this.updateCamera();

    const frameData = new Uint32Array([this.frame]);
    this.device.queue.writeBuffer(this.frameBuffer, 0, frameData);

    // Create compute pass
    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(this.computePipeline);
    computePass.setBindGroup(0, this.cameraBindGroup);
    computePass.setBindGroup(1, this.sceneBindGroup);

    // Dispatch compute shader
    const workgroupX = Math.ceil(this.width / 8);
    const workgroupY = Math.ceil(this.height / 8);
    computePass.dispatchWorkgroups(workgroupX, workgroupY);

    computePass.end();

    // Copy the current frame to the previous frame texture for the next iteration
    commandEncoder.copyTextureToTexture({ texture: this.outputTexture }, { texture: this.previousFrameTexture }, [this.width, this.height]);
    this.frame++;
  }

  public draw(renderPassEncoder: GPURenderPassEncoder) {
    // Draw the ray traced output texture to the screen using the display pipeline
    renderPassEncoder.setPipeline(this.displayPipeline);
    renderPassEncoder.setBindGroup(0, this.displayBindGroup);
    renderPassEncoder.draw(3, 1, 0, 0); // Fullscreen triangle
  }

  public destroy() {
    this.outputTexture?.destroy();
    this.spheresBuffer?.destroy();
    this.planesBuffer?.destroy();
    this.cameraBuffer?.destroy();
    this.sceneCountsBuffer?.destroy();
  }
}
