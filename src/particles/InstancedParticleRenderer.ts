import { Camera } from "../camera/Camera";
import { Geometry } from "../geometry/Geometry";

export interface ParticleInstance {
  position: { x: number; y: number };
  scale: { x: number; y: number };
  color: { r: number; g: number; b: number; a: number };
}

export interface GeometryData {
  vertices: Float32Array;
  indices?: Uint16Array;
  vertexCount: number;
}

export class InstancedParticleRenderer<T extends ParticleInstance> {
  private device: GPUDevice;
  private renderPipeline!: GPURenderPipeline;
  private instanceBuffer!: GPUBuffer;
  private vertexBuffer!: GPUBuffer;
  private indexBuffer?: GPUBuffer;
  private bindGroup!: GPUBindGroup;
  private maxParticles: number;
  private geometry: Geometry;
  private vertexCount: number;
  private useIndices: boolean;
  constructor(device: GPUDevice, camera: Camera, geometry: Geometry, maxParticles: number = 2048) {
    this.device = device;
    this.geometry = geometry;
    this.maxParticles = maxParticles;
    this.vertexCount = geometry.positions.length / 2; // TODO: Assuming 2D positions (x, y) / 3 for 3d
    this.useIndices = !!geometry.indices;

    this.createBuffers();
    this.createRenderPipeline(camera);
  }

  private createBuffers() {
    // Vertex buffer for base geometry
    this.vertexBuffer = this.device.createBuffer({
      size: this.geometry.positions.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    new Float32Array(this.vertexBuffer.getMappedRange()).set(this.geometry.positions);
    this.vertexBuffer.unmap();

    // Index buffer if geometry uses indices
    if (this.geometry.indices) {
      this.indexBuffer = this.device.createBuffer({
        size: this.geometry.indices.byteLength,
        usage: GPUBufferUsage.INDEX,
        mappedAtCreation: true,
      });
      new Uint16Array(this.indexBuffer.getMappedRange()).set(this.geometry.indices);
      this.indexBuffer.unmap();
    }

    // Instance data buffer (position, scale, color per particle)
    this.instanceBuffer = this.device.createBuffer({
      size: this.maxParticles * 8 * 4, // 8 floats per instance * 4 bytes
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
  }

private createRenderPipeline(camera: Camera) {
  const shaderModule = this.device.createShaderModule({
    code: this.getShaderCode(),
  });

  const vertexBufferLayout: GPUVertexBufferLayout[] = [
    // Base geometry vertices
    {
      arrayStride: 3 * 4, // 3 floats * 4 bytes (x,y,z positions)
      stepMode: "vertex",
      attributes: [
        {
          shaderLocation: 0,
          offset: 0,
          format: "float32x3", // Changed from float32x2 to float32x3
        },
      ],
    },
    // Instance data
    {
      arrayStride: 8 * 4, // 8 floats * 4 bytes
      stepMode: "instance",
      attributes: [
        {
          shaderLocation: 1, // position
          offset: 0,
          format: "float32x2",
        },
        {
          shaderLocation: 2, // scale
          offset: 2 * 4,
          format: "float32x2",
        },
        {
          shaderLocation: 3, // color
          offset: 4 * 4,
          format: "float32x4",
        },
      ],
    },
  ];

  const bindGroupLayout = this.device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "uniform" },
      },
    ],
  });

  this.renderPipeline = this.device.createRenderPipeline({
    layout: this.device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    }),
    vertex: {
      module: shaderModule,
      entryPoint: "vs_main",
      buffers: vertexBufferLayout,
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fs_main",
      targets: [
        {
          format: "bgra8unorm",
        },
      ],
    },
    primitive: {
      topology: "triangle-list",
    },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: "less",
      format: "depth32float", // Changed to match your depth texture format
    },
  });

  this.bindGroup = this.device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: { buffer: camera.buffer.buffer },
      },
    ],
  });
}

  private getShaderCode(): string {
    return `
      struct Uniforms {
        projectionViewMatrix: mat4x4<f32>,
      }

      @group(0) @binding(0) var<uniform> uniforms: Uniforms;

      struct VertexInput {
        @location(0) position: vec3<f32>,
        @location(1) instancePosition: vec3<f32>,
        @location(2) instanceScale: vec3<f32>,
        @location(3) instanceColor: vec4<f32>,
      }

      struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) color: vec4<f32>,
      }

      @vertex
      fn vs_main(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;
        
        // Scale and translate the base geometry
        let scaledPos = input.position * input.instanceScale;
        let worldPos = vec4<f32>(scaledPos + input.instancePosition, 0.0, 1.0);
        
        output.position = uniforms.projectionViewMatrix * worldPos;
        output.color = input.instanceColor;
        
        return output;
      }

      @fragment
      fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
        return input.color;
      }
    `;
  }
  updateInstances(particles: T[]) {
    const instanceData = new Float32Array(particles.length * 8);

    for (let i = 0; i < particles.length; i++) {
      const offset = i * 8;
      const particle = particles[i];

      instanceData[offset + 0] = particle.position.x;
      instanceData[offset + 1] = particle.position.y;
      instanceData[offset + 2] = particle.scale.x;
      instanceData[offset + 3] = particle.scale.y;
      instanceData[offset + 4] = particle.color.r;
      instanceData[offset + 5] = particle.color.g;
      instanceData[offset + 6] = particle.color.b;
      instanceData[offset + 7] = particle.color.a;
    }

    this.device.queue.writeBuffer(this.instanceBuffer, 0, instanceData);
  }

  draw(passEncoder: GPURenderPassEncoder, particleCount: number) {
    passEncoder.setPipeline(this.renderPipeline);
    passEncoder.setBindGroup(0, this.bindGroup);
    passEncoder.setVertexBuffer(0, this.vertexBuffer);
    passEncoder.setVertexBuffer(1, this.instanceBuffer);

    if (this.useIndices && this.indexBuffer) {
      passEncoder.setIndexBuffer(this.indexBuffer, "uint16");
      passEncoder.drawIndexed(this.geometry.indices!.length, particleCount);
    } else {
      passEncoder.draw(this.vertexCount, particleCount);
    }
  }
}
