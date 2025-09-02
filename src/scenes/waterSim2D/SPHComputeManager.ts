import { WaterParticle } from "./WaterParticle";
import externalForcesShader from "./shaders/2D/ExternalForcesCompute.wgsl?raw";
import spatialHashShader from "./shaders/2D/SpacialHashCompute.wgsl?raw";
import densityShader from "./shaders/2D/DensityCompute.wgsl?raw";
import updatePositionsShader from "./shaders/2D/UpdatePositionsCompute.wgsl?raw";
import pressureShader from "./shaders/2D/PressureCompute.wgsl?raw";
import bitonicSortShader from "./shaders/2D/BitonicSortCompute.wgsl?raw";
import BitonicSortOffsets from "./shaders/2D/BitonicSortOffsetsCompute.wgsl?raw";
import ViscosityShader from "./shaders/2D/ViscosityCompute.wgsl?raw";
import RenderParticles from "./shaders/2D/RenderParticles.wgsl?raw";
import { Vec2 } from "../../math/Vec2";

export class SPHComputeManager {
  private device: GPUDevice;
  private externalForcesShader!: GPUComputePipeline;
  private spatialHashShader!: GPUComputePipeline;
  private densityShader!: GPUComputePipeline;
  private updatePositionsShader!: GPUComputePipeline;
  private pressureShader!: GPUComputePipeline;
  private bitonicSortShader!: GPUComputePipeline;
  private bitonicSortOffsetsShader!: GPUComputePipeline;
  private viscosityShader!: GPUComputePipeline;  private particleRenderPipeline!: GPURenderPipeline;  private renderBindGroup!: GPUBindGroup;
  private circleVertexBuffer!: GPUBuffer;
  private circleIndexBuffer!: GPUBuffer;


  private particles: WaterParticle[];
  private gravity: number;
  private targetDensity: number = 5.0;
  private pressureMultiplier: number = 20.0;
  private nearPressureMultiplier: number = 2.0;
  private viscosityStrength: number = 0.8;
  private smoothingRadius: number = 0.6; // Todo: make adjustable



  //   private targetDensity: number = 8.0;
  // public pressureMultiplier: number = 10.0;
  // private nearPressureMultiplier: number = 1.2;
  // private gravity: number = -2.0;
  // private viscosityStrength: number = 15;
  // public smoothingRadius: number = 0.6;
  // private collisionDamping: number = 0.95;

  // Add more pipelines for pressure, viscosity, etc.
  // Buffers
  private particleBuffer!: GPUBuffer;
  private predictedPositionsBuffer!: GPUBuffer;
  private spatialIndicesBuffer!: GPUBuffer;
  private spatialOffsetsBuffer!: GPUBuffer;
  private simulationParamsBuffer!: GPUBuffer; // Static simulation parameters
  private frameParamsBuffer!: GPUBuffer; // Just dt (changes every frame)
  private mouseParamsBuffer!: GPUBuffer; // Mouse data (only when clicking)
  private sortStageBuffer!: GPUBuffer; // New buffer for sort stage parameters

  // Tracking state for efficient updates
  private lastDt: number = 0;
  private lastMouseParams: any = {};
  private simulationParamsNeedUpdate: boolean = true;
  constructor(device: GPUDevice, particles: WaterParticle[], parameters: any) {
    this.device = device;
    this.gravity = parameters.gravity ?? -4.0;
    this.targetDensity = parameters.targetDensity ?? 5.0;
    this.pressureMultiplier = parameters.pressureMultiplier ?? 20.0;
    this.nearPressureMultiplier = parameters.nearPressureMultiplier ?? 2.0;
    this.viscosityStrength = parameters.viscosityStrength ?? 0.8;
    this.smoothingRadius = parameters.smoothingRadius ?? 0.6;
    this.particles = particles;
    
    this.initBuffers(particles.length);
    this.initShaders();
    this.createCircleGeometry();
    this.updateSimulationParams(); // One-time setup
    this.updateFrameParams(0);
    this.updateMouseParams({
      mousePosition: new Vec2(0, 0),
      mouseRadius: 4.0,
      mouseForceStrength: 0,
      isMousePressed: false,
      isMouseRightPressed: false,
    });
  }

  private async initShaders() {
    // Load and create compute pipelines

    this.externalForcesShader = this.device.createComputePipeline({
      layout: "auto",
      label: "External Forces Compute Shader",
      compute: {
        module: this.device.createShaderModule({ code: externalForcesShader }),
        entryPoint: "main",
      },
    });

    this.spatialHashShader = this.device.createComputePipeline({
      layout: "auto",
      label: "Spatial Hash Compute Shader",
      compute: {
        module: this.device.createShaderModule({ code: spatialHashShader }),
        entryPoint: "main",
      },
    });

    this.densityShader = this.device.createComputePipeline({
      layout: "auto",
      label: "Density Compute Shader",
      compute: {
        module: this.device.createShaderModule({ code: densityShader }),
        entryPoint: "main",
      },
    });

    this.updatePositionsShader = this.device.createComputePipeline({
      layout: "auto",
      label: "Update Positions Compute Shader",
      compute: {
        module: this.device.createShaderModule({ code: updatePositionsShader }),
        entryPoint: "main",
      },
    });

    this.pressureShader = this.device.createComputePipeline({
      layout: "auto",
      label: "Pressure Compute Shader",
      compute: {
        module: this.device.createShaderModule({ code: pressureShader }),
        entryPoint: "main",
      },
    });

    this.bitonicSortShader = this.device.createComputePipeline({
      layout: "auto",
      label: "Bitonic Sort Compute Shader",
      compute: {
        module: this.device.createShaderModule({ code: bitonicSortShader }),
        entryPoint: "main",
      },
    });

    this.bitonicSortOffsetsShader = this.device.createComputePipeline({
      layout: "auto",
      label: "Bitonic Sort Offsets Compute Shader",
      compute: {
        module: this.device.createShaderModule({ code: BitonicSortOffsets }),
        entryPoint: "main",
      },
    });

    this.viscosityShader = this.device.createComputePipeline({
      layout: "auto",
      label: "Viscosity Compute Shader",
      compute: {
        module: this.device.createShaderModule({ code: ViscosityShader }),
        entryPoint: "main",
      },
    });    this.particleRenderPipeline = this.device.createRenderPipeline({
      layout: "auto",
      label: "Render Particles Pipeline",
      vertex: {
        module: this.device.createShaderModule({ code: RenderParticles }),
        entryPoint: "vs_main",
        buffers: [{
          arrayStride: 8, // 2 floats * 4 bytes = 8 bytes per vertex
          attributes: [{
            shaderLocation: 0,
            offset: 0,
            format: "float32x2"
          }]
        }]
      },
      fragment: {
        module: this.device.createShaderModule({ code: RenderParticles }),
        entryPoint: "fs_main",
        targets: [{ 
          format: "bgra8unorm"
        }]
      },
      primitive: { 
        topology: "triangle-list" 
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth32float"
      }
    });

  }

  private initBuffers(numParticles: number) {
    // Create GPU buffers for particles, positions, etc.
    this.particleBuffer = this.device.createBuffer({
      label: "Particle Buffer",
      size: numParticles * 64, // 12 floats per particle (pos.xy, vel.xy, density, nearDensity, color.rgba)
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });

    this.predictedPositionsBuffer = this.device.createBuffer({
      label: "Predicted Positions Buffer",
      size: numParticles * 8, // 2 floats per predicted position (pos.xy)
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });

    this.spatialIndicesBuffer = this.device.createBuffer({
      label: "Spatial Indices Buffer",
      size: numParticles * 12, // 3 ints per index (index, hash, key)
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });

    this.spatialOffsetsBuffer = this.device.createBuffer({
      label: "Spatial Offsets Buffer",
      size: numParticles * 4, // 1 int per offset
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });

    const offsetsData = new Uint32Array(numParticles);
    offsetsData.fill(numParticles); // Fill with invalid index
    this.device.queue.writeBuffer(this.spatialOffsetsBuffer, 0, offsetsData.buffer);

    const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(numParticles)));
  
    this.spatialIndicesBuffer = this.device.createBuffer({
      label: "Spatial Indices Buffer",
      size: nextPowerOf2 * 12, // Use power of 2 size
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });

    // Initialize with padding entries that will sort to the end
    const spatialData = new Uint32Array(nextPowerOf2 * 3);
    for (let i = 0; i < nextPowerOf2; i++) {
      if (i < numParticles) {
        spatialData[i * 3 + 0] = i; // index
        spatialData[i * 3 + 1] = 0; // hash (will be set by spatial hash shader)
        spatialData[i * 3 + 2] = 0; // key (will be set by spatial hash shader)
      } else {
        // Padding entries with max values to sort to end
        spatialData[i * 3 + 0] = 0xFFFFFFFF; // max uint32
        spatialData[i * 3 + 1] = 0xFFFFFFFF; // max uint32  
        spatialData[i * 3 + 2] = 0xFFFFFFFF; // max uint32
      }
    }
    
    this.device.queue.writeBuffer(this.spatialIndicesBuffer, 0, spatialData.buffer);

    // Initialize particle data
    const particleData = new Float32Array(numParticles * 16); // pos.xy, vel.xy, density, nearDensity, color.rgba
    const predictedPositionData = new Float32Array(numParticles * 2);
    for (let i = 0; i < numParticles; i++) {
      particleData[i * 16 + 0] = this.particles[i].position.x;
      particleData[i * 16 + 1] = this.particles[i].position.y;
      particleData[i * 16 + 2] = this.particles[i].velocity.x;
      particleData[i * 16 + 3] = this.particles[i].velocity.y;
      particleData[i * 16 + 4] = this.particles[i].density;
      particleData[i * 16 + 5] = this.particles[i].nearDensity;
      particleData[i * 16 + 6] = 0; //padding
      particleData[i * 16 + 7] = 0; //padding
      particleData[i * 16 + 8] = this.particles[i].color.r;
      particleData[i * 16 + 9] = this.particles[i].color.g;
      particleData[i * 16 + 10] = this.particles[i].color.b;
      particleData[i * 16 + 11] = this.particles[i].color.a;
      particleData[i * 16 + 12] = 0; //padding
      particleData[i * 16 + 13] = 0; //padding
      particleData[i * 16 + 14] = 0; //padding
      particleData[i * 16 + 15] = 0; //padding

      predictedPositionData[i * 2 + 0] = this.particles[i].position.x;
      predictedPositionData[i * 2 + 1] = this.particles[i].position.y;
    }    this.device.queue.writeBuffer(this.particleBuffer, 0, particleData.buffer, particleData.byteOffset, particleData.byteLength);
    this.device.queue.writeBuffer(this.predictedPositionsBuffer, 0, predictedPositionData.buffer, predictedPositionData.byteOffset, predictedPositionData.byteLength);

    // Create separate parameter buffers
    this.simulationParamsBuffer = this.device.createBuffer({
      label: "Simulation Parameters Buffer",
      size: 32, // 8 floats * 4 bytes
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.frameParamsBuffer = this.device.createBuffer({
      label: "Frame Parameters Buffer", 
      size: 16, // 4 floats * 4 bytes (dt + 3 padding)
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.mouseParamsBuffer = this.device.createBuffer({
      label: "Mouse Parameters Buffer",
      size: 32, // 8 values * 4 bytes 
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }
  public async update(dt: number, mouseParams: any): Promise<void> {
    let commandEncoder = this.device.createCommandEncoder();

    // Always update dt (changes every frame)
    if (dt !== this.lastDt) {
      this.updateFrameParams(dt);
      this.lastDt = dt;
    }

    // Only update mouse params if clicking or params changed
    if ((mouseParams.isMousePressed || mouseParams.isMouseRightPressed) || 
        JSON.stringify(mouseParams) !== JSON.stringify(this.lastMouseParams)) {
      this.updateMouseParams(mouseParams);
      this.lastMouseParams = { ...mouseParams };
    }

    // Update simulation params only if flagged
    if (this.simulationParamsNeedUpdate) {
      this.updateSimulationParams();
      this.simulationParamsNeedUpdate = false;
    }

    // Dispatch compute shaders in sequence
    this.dispatchExternalForces(commandEncoder);
    
    this.dispatchSpatialHash(commandEncoder);
    commandEncoder = await this.dispatchSort(commandEncoder); // Sort needs special handling for synchronization
    this.dispatchOffsets(commandEncoder);
    
    this.dispatchDensity(commandEncoder);
    this.dispatchPressure(commandEncoder);
    this.dispatchViscosity(commandEncoder);
    this.dispatchUpdatePositions(commandEncoder);

    this.device.queue.submit([commandEncoder.finish()]);
  }
  private updateSimulationParams() {
    const buffer = new ArrayBuffer(8 * 4); // 8 floats
    const view = new DataView(buffer);
    let offset = 0;

    view.setFloat32(offset, this.gravity, true); offset += 4;
    view.setFloat32(offset, this.targetDensity, true); offset += 4;
    view.setFloat32(offset, this.pressureMultiplier, true); offset += 4;
    view.setFloat32(offset, this.nearPressureMultiplier, true); offset += 4;
    view.setFloat32(offset, this.viscosityStrength, true); offset += 4;
    view.setFloat32(offset, this.smoothingRadius, true); offset += 4;
    view.setUint32(offset, this.particles.length, true); offset += 4;
    view.setUint32(offset, 0, true); // padding

    this.device.queue.writeBuffer(this.simulationParamsBuffer, 0, buffer);
  }

  private updateFrameParams(dt: number) {
    const buffer = new ArrayBuffer(4 * 4); // 4 floats
    const view = new DataView(buffer);
    
    view.setFloat32(0, dt, true);
    view.setFloat32(4, 0, true); // padding
    view.setFloat32(8, 0, true); // padding
    view.setFloat32(12, 0, true); // padding

    this.device.queue.writeBuffer(this.frameParamsBuffer, 0, buffer);
  }

  private updateMouseParams(mouseParams: any) {
    const buffer = new ArrayBuffer(8 * 4); // 8 values
    const view = new DataView(buffer);
    let offset = 0;

    view.setFloat32(offset, mouseParams.mouseForceStrength, true); offset += 4;
    view.setFloat32(offset, mouseParams.mouseRadius, true); offset += 4;
    view.setFloat32(offset, mouseParams.mousePosition.x, true); offset += 4;
    view.setFloat32(offset, mouseParams.mousePosition.y, true); offset += 4;
    view.setUint32(offset, mouseParams.isMousePressed ? 1 : 0, true); offset += 4;
    view.setUint32(offset, mouseParams.isMouseRightPressed ? 1 : 0, true); offset += 4;
    view.setUint32(offset, 0, true); offset += 4; // padding
    view.setUint32(offset, 0, true); // padding

    this.device.queue.writeBuffer(this.mouseParamsBuffer, 0, buffer);
  }

  // Setter methods that mark simulation params as dirty
  public setGravity(gravity: number) {
    if (this.gravity !== gravity) {
      this.gravity = gravity;
      this.simulationParamsNeedUpdate = true;
    }
  }

  public setPressureMultiplier(pressure: number) {
    if (this.pressureMultiplier !== pressure) {
      this.pressureMultiplier = pressure;
      this.simulationParamsNeedUpdate = true;
    }
  }

  public setSmoothingRadius(radius: number) {
    if (this.smoothingRadius !== radius) {
      this.smoothingRadius = radius;
      this.simulationParamsNeedUpdate = true;
    }  }

  public setTargetDensity(targetDensity: number): void {
    if (this.targetDensity !== targetDensity) {
      this.targetDensity = targetDensity;
      this.simulationParamsNeedUpdate = true;
    }
  }

  public setNearPressureMultiplier(nearPressureMultiplier: number): void {
    if (this.nearPressureMultiplier !== nearPressureMultiplier) {
      this.nearPressureMultiplier = nearPressureMultiplier;
      this.simulationParamsNeedUpdate = true;
    }
  }

  public setViscosityStrength(viscosityStrength: number): void {
    if (this.viscosityStrength !== viscosityStrength) {
      this.viscosityStrength = viscosityStrength;
      this.simulationParamsNeedUpdate = true;
    }
  }

  private dispatchExternalForces(encoder: GPUCommandEncoder) {
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.externalForcesShader);
    pass.setBindGroup(0, this.createExternalForcesBindGroup());
    pass.dispatchWorkgroups(Math.ceil(this.particles.length / 128));
    pass.end();
  }
  private createExternalForcesBindGroup(): GPUBindGroup {
    return this.device.createBindGroup({
      layout: this.externalForcesShader.getBindGroupLayout(0),
      label: "External Forces Bind Group",
      entries: [
        { binding: 0, resource: { buffer: this.particleBuffer } },
        { binding: 1, resource: { buffer: this.predictedPositionsBuffer } },
        { binding: 2, resource: { buffer: this.simulationParamsBuffer } },
        { binding: 3, resource: { buffer: this.frameParamsBuffer } },
        { binding: 4, resource: { buffer: this.mouseParamsBuffer } },
      ],
    });
  }

  private dispatchSpatialHash(encoder: GPUCommandEncoder) {
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.spatialHashShader);
    pass.setBindGroup(0, this.createSpatialHashBindGroup());
    pass.dispatchWorkgroups(Math.ceil(this.particles.length / 128));
    pass.end();
  }
  private createSpatialHashBindGroup(): GPUBindGroup {
    return this.device.createBindGroup({
      layout: this.spatialHashShader.getBindGroupLayout(0),
      label: "Spatial Hash Bind Group",
      entries: [
        { binding: 0, resource: { buffer: this.particleBuffer } },
        { binding: 1, resource: { buffer: this.spatialIndicesBuffer } },
        { binding: 2, resource: { buffer: this.simulationParamsBuffer } },
      ],
    });
  }

private async dispatchSort(encoder: GPUCommandEncoder): Promise<GPUCommandEncoder> {
  const N = this.particles.length;
  const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(N)));
  
  // Create SortStage buffer if needed
  if (!this.sortStageBuffer) {
    this.sortStageBuffer = this.device.createBuffer({
      label: "Sort Stage Buffer",
      size: 16, // 4 u32 values * 4 bytes each
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  // Submit the current encoder first
  this.device.queue.submit([encoder.finish()]);

  for (let k = 2; k <= nextPowerOf2; k *= 2) {
    for (let j = k / 2; j >= 1; j /= 2) {
      // Use nextPowerOf2 for sort parameters
      const sortStage = new Uint32Array([k, j, nextPowerOf2, 0]);
      this.device.queue.writeBuffer(this.sortStageBuffer, 0, sortStage.buffer);

      const sortEncoder = this.device.createCommandEncoder();
      const pass = sortEncoder.beginComputePass();
      pass.setPipeline(this.bitonicSortShader);
      pass.setBindGroup(0, this.createSortBindGroup());
      // Dispatch for the full power-of-2 size
      pass.dispatchWorkgroups(Math.ceil(nextPowerOf2 / 128));
      pass.end();
      
      this.device.queue.submit([sortEncoder.finish()]);
    }
  }

  return this.device.createCommandEncoder();
}

  private createSortBindGroup(): GPUBindGroup {
    return this.device.createBindGroup({
      layout: this.bitonicSortShader.getBindGroupLayout(0),
      label: "Bitonic Sort Bind Group",
      entries: [
        { binding: 0, resource: { buffer: this.spatialIndicesBuffer } },
        { binding: 2, resource: { buffer: this.sortStageBuffer } }, // Optional: if you implement dynamic sort stages
      ],
    });
  }

  private dispatchOffsets(encoder: GPUCommandEncoder) {
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.bitonicSortOffsetsShader);
    pass.setBindGroup(0, this.createOffsetsBindGroup());
    pass.dispatchWorkgroups(Math.ceil(this.particles.length / 128));
    pass.end();
  }
  private createOffsetsBindGroup(): GPUBindGroup {
    return this.device.createBindGroup({
      layout: this.bitonicSortOffsetsShader.getBindGroupLayout(0),
      label: "Bitonic Sort Offsets Bind Group",
      entries: [
        { binding: 0, resource: { buffer: this.spatialIndicesBuffer } },
        { binding: 1, resource: { buffer: this.spatialOffsetsBuffer } },
        { binding: 2, resource: { buffer: this.simulationParamsBuffer } },
      ],
    });
  }

  private dispatchDensity(encoder: GPUCommandEncoder) {
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.densityShader);
    pass.setBindGroup(0, this.createDensityBindGroup());
    pass.dispatchWorkgroups(Math.ceil(this.particles.length / 128));
    pass.end();
  }
  private createDensityBindGroup(): GPUBindGroup {
    return this.device.createBindGroup({
      layout: this.densityShader.getBindGroupLayout(0),
      label: "Density Bind Group",
      entries: [
        { binding: 0, resource: { buffer: this.predictedPositionsBuffer } },
        { binding: 1, resource: { buffer: this.spatialIndicesBuffer } },
        { binding: 2, resource: { buffer: this.spatialOffsetsBuffer } },
        { binding: 3, resource: { buffer: this.particleBuffer } },
        { binding: 4, resource: { buffer: this.simulationParamsBuffer } },
      ],
    });
  }

  private dispatchPressure(encoder: GPUCommandEncoder) {
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.pressureShader);
    pass.setBindGroup(0, this.createPressureBindGroup());
    pass.dispatchWorkgroups(Math.ceil(this.particles.length / 128));
    pass.end();
  }  private createPressureBindGroup(): GPUBindGroup {
    return this.device.createBindGroup({
      layout: this.pressureShader.getBindGroupLayout(0),
      label: "Pressure Bind Group",
      entries: [
        { binding: 0, resource: { buffer: this.predictedPositionsBuffer } },
        { binding: 1, resource: { buffer: this.spatialIndicesBuffer } },
        { binding: 2, resource: { buffer: this.spatialOffsetsBuffer } },
        { binding: 3, resource: { buffer: this.particleBuffer } },
        { binding: 4, resource: { buffer: this.simulationParamsBuffer } },
        { binding: 5, resource: { buffer: this.frameParamsBuffer } },
      ],
    });
  }

  private dispatchViscosity(encoder: GPUCommandEncoder) {
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.viscosityShader);
    pass.setBindGroup(0, this.createViscosityBindGroup());
    pass.dispatchWorkgroups(Math.ceil(this.particles.length / 128));
    pass.end();
  }  private createViscosityBindGroup(): GPUBindGroup {
    return this.device.createBindGroup({
      layout: this.viscosityShader.getBindGroupLayout(0),
      label: "Viscosity Bind Group",
      entries: [
        { binding: 0, resource: { buffer: this.predictedPositionsBuffer } },
        { binding: 1, resource: { buffer: this.spatialIndicesBuffer } },
        { binding: 2, resource: { buffer: this.spatialOffsetsBuffer } },
        { binding: 3, resource: { buffer: this.particleBuffer } },
        { binding: 4, resource: { buffer: this.simulationParamsBuffer } },
        { binding: 5, resource: { buffer: this.frameParamsBuffer } },
      ],
    });
  }

  private dispatchUpdatePositions(encoder: GPUCommandEncoder) {
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.updatePositionsShader);
    pass.setBindGroup(0, this.createUpdatePositionsBindGroup());
    pass.dispatchWorkgroups(Math.ceil(this.particles.length / 128));
    pass.end();
  }
  private createUpdatePositionsBindGroup(): GPUBindGroup {
    return this.device.createBindGroup({
      layout: this.updatePositionsShader.getBindGroupLayout(0),
      label: "Update Positions Bind Group",
      entries: [
        { binding: 0, resource: { buffer: this.particleBuffer } },
        { binding: 1, resource: { buffer: this.simulationParamsBuffer } },
        { binding: 2, resource: { buffer: this.frameParamsBuffer } },
      ],
    });
  }

  public async getPredictedParticlePositions(): Promise<Float32Array> {
    // Create a staging buffer for readback
    const readBuffer = this.device.createBuffer({
      size: this.predictedPositionsBuffer.size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    // Encode copy from GPU buffer to staging buffer
    const commandEncoder = this.device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(this.predictedPositionsBuffer, 0, readBuffer, 0, this.predictedPositionsBuffer.size);
    this.device.queue.submit([commandEncoder.finish()]);

    // Wait for the buffer to be mapped
    await readBuffer.mapAsync(GPUMapMode.READ);
    const arrayBuffer = readBuffer.getMappedRange();
    const positions = new Float32Array(arrayBuffer.slice(0));
    readBuffer.unmap();

    return positions;
  }

  public async getParticles(): Promise<WaterParticle[]> {
    const numParticles = this.particles.length;
    const particleBufferSize = numParticles * 64;
    const readBuffer = this.device.createBuffer({
      size: particleBufferSize,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    const commandEncoder = this.device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(this.particleBuffer, 0, readBuffer, 0, particleBufferSize);
    this.device.queue.submit([commandEncoder.finish()]);

    await readBuffer.mapAsync(GPUMapMode.READ);
    const arrayBuffer = readBuffer.getMappedRange();
    const data = new Float32Array(arrayBuffer.slice(0));
    readBuffer.unmap();

    for (let i = 0; i < numParticles; i++) {
      this.particles[i].position.x = data[i * 16 + 0];
      this.particles[i].position.y = data[i * 16 + 1];
      this.particles[i].velocity.x = data[i * 16 + 2];
      this.particles[i].velocity.y = data[i * 16 + 3];
      this.particles[i].density = data[i * 16 + 4];
      this.particles[i].nearDensity = data[i * 16 + 5];
      // padding x2
      this.particles[i].color.r = data[i * 16 + 8];
      this.particles[i].color.g = data[i * 16 + 9];
      this.particles[i].color.b = data[i * 16 + 10];
      this.particles[i].color.a = data[i * 16 + 11];
      //padding x 4
    }
    return this.particles;
  }

  public async debugSpatialHashBuffers(): Promise<void> {
    const numParticles = this.particles.length;

    // Read spatialOffsetsBuffer
    const offsetsReadBuffer = this.device.createBuffer({
      size: numParticles * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const indicesReadBuffer = this.device.createBuffer({
      size: numParticles * 12,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    const commandEncoder = this.device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(this.spatialOffsetsBuffer, 0, offsetsReadBuffer, 0, numParticles * 4);
    commandEncoder.copyBufferToBuffer(this.spatialIndicesBuffer, 0, indicesReadBuffer, 0, numParticles * 12);
    this.device.queue.submit([commandEncoder.finish()]);

    await offsetsReadBuffer.mapAsync(GPUMapMode.READ);
    await indicesReadBuffer.mapAsync(GPUMapMode.READ);

    const offsetsArray = new Uint32Array(offsetsReadBuffer.getMappedRange());
    const indicesArray = new Uint32Array(indicesReadBuffer.getMappedRange());

    // Log offsets
    console.log("Spatial Offsets:");
    for (let i = 0; i < numParticles; i++) {
      console.log(`Offset[${i}]: ${offsetsArray[i]}`);
    }

    // Log indices
    console.log("Spatial Indices:");
    for (let i = 0; i < numParticles; i++) {
      const base = i * 3;
      console.log(`Index[${i}]: index=${indicesArray[base]}, hash=${indicesArray[base + 1]}, key=${indicesArray[base + 2]}`);
    }

    offsetsReadBuffer.unmap();
    indicesReadBuffer.unmap();
  }

  private createCircleGeometry() {
    const segments = this.particles.length > 2000 ? 8 : 16; // Adaptive LOD
    const vertices: number[] = [];
    const indices: number[] = [];
    
    // Center vertex
    vertices.push(0, 0);
    
    // Ring vertices
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      vertices.push(Math.cos(angle), Math.sin(angle));
    }
    
    // Create triangles
    for (let i = 0; i < segments; i++) {
      indices.push(0, i + 1, i + 2);
    }
    // Close the circle
    indices[indices.length - 1] = 1;
    
    // Create vertex buffer
    const vertexData = new Float32Array(vertices);
    this.circleVertexBuffer = this.device.createBuffer({
      label: "Circle Vertex Buffer",
      size: vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    new Float32Array(this.circleVertexBuffer.getMappedRange()).set(vertexData);
    this.circleVertexBuffer.unmap();
    
    // Create index buffer
    const indexData = new Uint16Array(indices);
    this.circleIndexBuffer = this.device.createBuffer({
      label: "Circle Index Buffer", 
      size: indexData.byteLength,
      usage: GPUBufferUsage.INDEX,
      mappedAtCreation: true,
    });
    new Uint16Array(this.circleIndexBuffer.getMappedRange()).set(indexData);
    this.circleIndexBuffer.unmap();
  }

  // Add this method for GPU-only particle rendering
  public drawParticles(passEncoder: GPURenderPassEncoder, cameraBuffer: GPUBuffer) {
    if (!this.renderBindGroup) {
      this.renderBindGroup = this.device.createBindGroup({
        layout: this.particleRenderPipeline.getBindGroupLayout(0),
        label: "Particle Render Bind Group",
        entries: [
          { binding: 0, resource: { buffer: this.particleBuffer } },
          { binding: 1, resource: { buffer: cameraBuffer } },
        ],
      });
    }

    passEncoder.setPipeline(this.particleRenderPipeline);
    passEncoder.setBindGroup(0, this.renderBindGroup);
    passEncoder.setVertexBuffer(0, this.circleVertexBuffer);
    passEncoder.setIndexBuffer(this.circleIndexBuffer, "uint16");
    
    // Draw instanced: one circle per particle
    const indicesPerCircle = (this.particles.length > 2000 ? 8 : 16) * 3; // 16 or 8 triangles * 3 indices each
    passEncoder.drawIndexed(indicesPerCircle, this.particles.length);
  }
}
