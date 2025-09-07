import { GeometryBuffers } from "../attribute_buffers/GeometryBuffers";
import { Color } from "../math/Color";
import { UniformBuffer } from "../uniform_buffers/UniformBuffer";

export class GizmoRenderPipeline {
  private device: GPUDevice;
  private renderPipeline!: GPURenderPipeline;
  private vertexBindGroup!: GPUBindGroup;
  private materialBindGroup!: GPUBindGroup;

  private diffuseColorBuffer: UniformBuffer;

  constructor(
    device: GPUDevice,
    transformsBuffer: UniformBuffer
  ) {
    this.device = device;

    // Create uniform buffer for diffuse color
    this.diffuseColorBuffer = new UniformBuffer(device, 4 * Float32Array.BYTES_PER_ELEMENT, "Gizmo Diffuse Color");

    const bufferLayout: GPUVertexBufferLayout[] = [
      // position
      {
        arrayStride: 12,
        attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }],
      },
      // color
      {
        arrayStride: 16,
        attributes: [{ shaderLocation: 1, offset: 0, format: "float32x4" }],
      },
      // tex coords
      {
        arrayStride: 8,
        attributes: [{ shaderLocation: 2, offset: 0, format: "float32x2" }],
      },
      // normals
      {
        arrayStride: 12,
        attributes: [{ shaderLocation: 3, offset: 0, format: "float32x3" }],
      },
    ];

    // Create bind group layouts - simplified to only what we need
    const vertexGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "uniform" },
        },
      ],
    });    const materialGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
      ],
    });

    const layout = device.createPipelineLayout({
      bindGroupLayouts: [
        vertexGroupLayout,
        materialGroupLayout,
      ],
    });

    const shaderModule = device.createShaderModule({
      code: `
        struct VertexInput {
          @location(0) position: vec3<f32>,
          @location(1) color: vec4<f32>,
          @location(2) texCoord: vec2<f32>,
          @location(3) normal: vec3<f32>,
        }

        struct VertexOutput {
          @builtin(position) position: vec4<f32>,
          @location(0) color: vec4<f32>,
        }

        struct Material {
          diffuseColor: vec4<f32>,
        }

        @group(0) @binding(0) var<uniform> mvpMatrix: mat4x4<f32>;
        @group(1) @binding(0) var<uniform> material: Material;

        @vertex
        fn materialVS(input: VertexInput) -> VertexOutput {
          var output: VertexOutput;
          // Direct MVP transformation - the matrix already combines model, view, and projection
          output.position = mvpMatrix * vec4<f32>(input.position, 1.0);
          output.color = material.diffuseColor;
          return output;
        }

        @fragment
        fn materialFS(input: VertexOutput) -> @location(0) vec4<f32> {
          return input.color;
        }
      `,
    });

    // Create the render pipeline with modified depth testing for gizmos
    this.renderPipeline = device.createRenderPipeline({
      layout: layout,
      label: "Gizmo Render Pipeline",
      vertex: {
        buffers: bufferLayout,
        module: shaderModule,
        entryPoint: "materialVS",
      },
      fragment: {
        module: shaderModule,
        entryPoint: "materialFS",
        targets: [
          {
            format: "bgra8unorm",
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
      },
      // CONFIGURE DEPTH FOR GIZMOS - Always render, but don't write to depth buffer
      depthStencil: {
        depthWriteEnabled: false, // Don't write to depth buffer so gizmos don't affect other objects
        depthCompare: "always",   // Always render regardless of depth
        format: "depth32float"
      }
    });

    this.vertexBindGroup = device.createBindGroup({
      layout: vertexGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: transformsBuffer.buffer } },
      ],
    });

    this.materialBindGroup = device.createBindGroup({
      layout: materialGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.diffuseColorBuffer.buffer } },
      ],
    });
  }

  public set diffuseColor(color: Color) {
    const colorArray = new Float32Array([color.r, color.g, color.b, color.a]);
    this.diffuseColorBuffer.update(colorArray);
  }

  public draw(
    renderPassEncoder: GPURenderPassEncoder,
    buffers: GeometryBuffers,
    instanceCount: number = 1
  ) {
    renderPassEncoder.setPipeline(this.renderPipeline);

    renderPassEncoder.setVertexBuffer(0, buffers.positionsBuffer);
    renderPassEncoder.setVertexBuffer(1, buffers.colorsBuffer);
    renderPassEncoder.setVertexBuffer(2, buffers.texCoordsBuffer);
    renderPassEncoder.setVertexBuffer(3, buffers.normalsBuffer);

    renderPassEncoder.setBindGroup(0, this.vertexBindGroup);
    renderPassEncoder.setBindGroup(1, this.materialBindGroup);

    if (buffers.indicesBuffer) {
      renderPassEncoder.setIndexBuffer(buffers.indicesBuffer, "uint16");
      renderPassEncoder.drawIndexed(buffers.indexCount!, instanceCount, 0, 0, 0);
    } else {
      renderPassEncoder.draw(buffers.vertexCount, instanceCount, 0, 0);
    }
  }
}
