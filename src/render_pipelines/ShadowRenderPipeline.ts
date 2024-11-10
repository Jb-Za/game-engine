import { GeometryBuffers } from "../attribute_buffers/GeometryBuffers";
import { ShadowCamera } from "../camera/ShadowCamera";
import shaderSource from "../shaders/ShadowShader.wgsl?raw";
import { UniformBuffer } from "../uniform_buffers/UniformBuffer";

export class ShadowRenderPipeline {
  private renderPipeline: GPURenderPipeline;

  private vertexBindGroup!: GPUBindGroup;
  private projectionViewBindGroup!: GPUBindGroup;

  //@ts-ignore
  constructor(private device: GPUDevice, camera: ShadowCamera | CubeMapShadowCamera, transformsBuffer: UniformBuffer) {

    const shaderModule = device.createShaderModule({
      code: shaderSource,
    });

    const bufferLayout: Array<GPUVertexBufferLayout> = [];

    //POSITIONS
    bufferLayout.push({
      arrayStride: 3 * Float32Array.BYTES_PER_ELEMENT,
      attributes: [
        {
          shaderLocation: 0,
          offset: 0,
          format: "float32x3",
        },
      ],
    });

    // RELATED TO VERTEX
    const vertexGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: {},
        }
      ],
    });

    //prthographic view group for camera
    const projectionViewGroupLayout = device.createBindGroupLayout({
      entries:[
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: {},
        },
      ]
    });

    const layout = device.createPipelineLayout({
      bindGroupLayouts: [
        vertexGroupLayout, // group 0
        projectionViewGroupLayout, // group 1
      ],
    });

    this.renderPipeline = device.createRenderPipeline({
      layout: layout,
      label: "Shadow Render Pipeline",
      vertex: {
        buffers: bufferLayout,
        module: shaderModule,
        entryPoint: "shadowVS",
      },

      // CONFIGURE DEPTH
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth32float"
      }
    });

    // BIND GROUP RELATED TO VERTEX. TRANSFORMATIONS ETC.
    this.vertexBindGroup = device.createBindGroup({
      layout: vertexGroupLayout,
      entries: [
        {
            binding: 0,
            resource: {
              buffer: transformsBuffer.buffer,
            },
        },
      ],
    });

    //BIND GROUP RELATED TO CAMERA. PROJECTION VIEW ETC if we ver have one
    this.projectionViewBindGroup = device.createBindGroup({
      layout: projectionViewGroupLayout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: camera.buffer.buffer,
          },
        },
      ],
    });
  }

  public draw(
    renderPassEncoder: GPURenderPassEncoder,
    buffers: GeometryBuffers,
    instanceCount: number = 1
  ) {
    renderPassEncoder.setPipeline(this.renderPipeline);
    renderPassEncoder.setVertexBuffer(0, buffers.positionsBuffer);

    // passes texture
    renderPassEncoder.setBindGroup(0, this.vertexBindGroup);
    renderPassEncoder.setBindGroup(1, this.projectionViewBindGroup);
    // draw with indexed buffer
    if (buffers.indicesBuffer) {
      renderPassEncoder.setIndexBuffer(buffers.indicesBuffer, "uint16");
      renderPassEncoder.drawIndexed(buffers.indexCount!, instanceCount, 0, 0, 0);
    } else {
      renderPassEncoder.draw(buffers.vertexCount, instanceCount, 0, 0);
    }
  }
}
