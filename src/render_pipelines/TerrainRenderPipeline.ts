import { GeometryBuffers } from "../attribute_buffers/GeometryBuffers";
import { Camera } from "../camera/Camera";
import { ShadowCamera } from "../camera/ShadowCamera";
import { AmbientLight } from "../lights/AmbientLight";
import { DirectionalLight } from "../lights/DirectionalLight";
import { PointLightsCollection } from "../lights/PointLight";
import { Color } from "../math/Color";
import { Vec2 } from "../math/Vec2";
import shaderSource from "../shaders/TerrainShader.wgsl?raw";
import { Texture2D } from "../texture/Texture2D";
import { UniformBuffer } from "../uniform_buffers/UniformBuffer";

export class TerrainRenderPipeline {
  private renderPipeline: GPURenderPipeline;
  private wireframeRenderPipeline: GPURenderPipeline;
  private materialBindGroupLayout: GPUBindGroupLayout;
  private _wireframeMode: boolean = false;

  public set wireframeMode(value: boolean) {
    this._wireframeMode = value;
  }

  public get wireframeMode(): boolean {
    return this._wireframeMode;
  }

  private materialBindGroup!: GPUBindGroup;
  private vertexBindGroup!: GPUBindGroup;
  private lightsBindGroup!: GPUBindGroup;
  private projectionViewBindGroup!: GPUBindGroup;

  private _diffuseTexture!: Texture2D;
  private _shadowTexture!: Texture2D;

  public set diffuseTexture(texture: Texture2D) {
    this._diffuseTexture = texture;
    this.materialBindGroup = this.createMaterialBindGroup(this._diffuseTexture, this._shadowTexture);
  }

  public set shadowTexture(texture: Texture2D) {
      this._shadowTexture = texture;
      this.materialBindGroup = this.createMaterialBindGroup(this._diffuseTexture, this._shadowTexture);
  }

  private textureTilingBuffer: UniformBuffer;
  private _textureTiling: Vec2 = new Vec2(1, 1);

  public set textureTiling(value: Vec2) {
    this._textureTiling = value;
    this.textureTilingBuffer.update(value);
  }

  private diffuseColorBuffer: UniformBuffer;
  private _diffuseColor: Color = Color.white();

  public set diffuseColor(value: Color) {
    this._diffuseColor = value;
    this.diffuseColorBuffer.update(value);
  }

  private shininessBuffer: UniformBuffer;
  private _shininess = 32;

  public set shininess(value: number) {
    this._shininess = value;
    this.shininessBuffer.update(new Float32Array([value]));
  }

  constructor(private device: GPUDevice, camera: Camera, shadowCamera: ShadowCamera, transformsBuffer: UniformBuffer, normalmatrixBuffer: UniformBuffer,
    ambientLight: AmbientLight,
    directionalLight: DirectionalLight,
    pointLights: PointLightsCollection
  ) {

    this.textureTilingBuffer = new UniformBuffer(
      device,
      this._textureTiling,
      "Texture Tiling Buffer"
    );

    this.diffuseColorBuffer = new UniformBuffer(
      device,
      this._diffuseColor,
      "Diffuse Color Buffer"
    );

    this.shininessBuffer = new UniformBuffer(
      device, 
      new Float32Array([this._shininess]), "Shininess Buffer"
    );

    const shaderModule = device.createShaderModule({
      code: shaderSource,
    });

    const bufferLayout: Array<GPUVertexBufferLayout> = [];

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

    bufferLayout.push({
      arrayStride: 4 * Float32Array.BYTES_PER_ELEMENT,
      attributes: [
        {
          shaderLocation: 1,
          offset: 0,
          format: "float32x4",
        },
      ],
    });

    bufferLayout.push({
      arrayStride: 2 * Float32Array.BYTES_PER_ELEMENT,
      attributes: [
        {
          shaderLocation: 2,
          offset: 0,
          format: "float32x2",
        },
      ],
    });

    bufferLayout.push({
        arrayStride: 3 * Float32Array.BYTES_PER_ELEMENT,
        attributes: [
          {
            shaderLocation: 3,
            offset: 0,
            format: "float32x3",
          },
        ],
      });

    const vertexGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: {},
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX,
          buffer: {},
        },
        {
          binding: 2,
          visibility: GPUShaderStage.VERTEX,
          buffer: {},
        },
      ],
    });

    //projection view group for camera
    // TODO rename to cameraViewGroupLayout
    const projectionViewGroupLayout = device.createBindGroupLayout({
      entries:[
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: {},
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX,
          buffer: {},
        },
        {
          binding: 2,
          visibility: GPUShaderStage.VERTEX,
          buffer: {},
        },
      ]
    })


    this.materialBindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {},
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {},
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: {},
        },
        {
          binding: 3,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: {},
        },
        {
          binding: 4,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {
            sampleType: "depth"
          },
        },
        {
          binding: 5,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {
            type: "comparison"
          }
        },
      ],
    });

    const lightsBindGroupLayout = device.createBindGroupLayout({
        label: "Lights Bind Group Layout",
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: {}
            },
            {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: {}
            },
            {
              binding: 2,
              visibility: GPUShaderStage.FRAGMENT,
              buffer: {}
          },
        ]
    });

    const layout = device.createPipelineLayout({
      bindGroupLayouts: [
        vertexGroupLayout, // group 0
        projectionViewGroupLayout, // group 1
        this.materialBindGroupLayout, // group 2
        lightsBindGroupLayout // group 3
      ],
    });

    this.renderPipeline = device.createRenderPipeline({
      layout: layout,
      label: "Render Pipeline",
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
      // CONFIGURE DEPTH
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth32float"
      }
    });

    // Create wireframe pipeline
    this.wireframeRenderPipeline = device.createRenderPipeline({
      layout: layout,
      label: "Wireframe Render Pipeline",
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
        topology: "line-list",
      },
      // CONFIGURE DEPTH
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth32float"
      }
    });

    this._diffuseTexture = Texture2D.createEmpty(device, true); // Use sRGB format for color textures
    // this._shadowTexture = Texture2D.createShadowTexture(device, 1024, 1024);
    // this.materialBindGroup = this.createMaterialBindGroup(this._diffuseTexture, this._shadowTexture);

    this.vertexBindGroup = device.createBindGroup({
      layout: vertexGroupLayout,
      entries: [
        {
            binding: 0,
            resource: {
              buffer: transformsBuffer.buffer,
            },
        },
        {
          binding: 1,
          resource: {
            buffer: normalmatrixBuffer.buffer,
          },
        },
        {
          binding: 2,
          resource: {
            buffer: this.textureTilingBuffer.buffer,
          },
        },
      ],
    });

    this.projectionViewBindGroup = device.createBindGroup({
      layout: projectionViewGroupLayout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: camera.buffer.buffer,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: camera.eyeBuffer.buffer,
          },
        },
        {
          binding: 2,
          resource: {
            buffer: shadowCamera.buffer.buffer,
          },
        },
      ],
    });

    this.lightsBindGroup = device.createBindGroup({
        label: "Lights Bind Group",
        layout: lightsBindGroupLayout,
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: ambientLight.buffer.buffer
                }
            },
            {
                binding: 1,
                resource: {
                    buffer: directionalLight.buffer.buffer
                }
            },
            {
                binding: 2,
                resource: {
                    buffer: pointLights.buffer.buffer
                }
          },
      ],
    });
  }

  private createMaterialBindGroup(texture: Texture2D, shadowTexture: Texture2D) {
    return this.device.createBindGroup({
      layout: this.materialBindGroupLayout,
      entries: [
          {
            binding: 0,
            resource: texture.texture.createView()
          },
          {
            binding: 1,
            resource: texture.sampler
          },
          {
            binding: 2,
            resource: {
                buffer: this.diffuseColorBuffer.buffer
            }
          },
          {
            binding: 3,
            resource: {
                buffer: this.shininessBuffer.buffer
            }
          },
          {
            binding: 4,
            resource: shadowTexture.texture.createView()
          },
          {
            binding: 5,
            resource: shadowTexture.sampler
          }
      ]
    });
}

  public draw(
    renderPassEncoder: GPURenderPassEncoder,
    buffers: GeometryBuffers,
    instanceCount: number = 1
  ) {
    // Choose pipeline based on wireframe mode
    const pipeline = this._wireframeMode ? this.wireframeRenderPipeline : this.renderPipeline;
    renderPassEncoder.setPipeline(pipeline);
    
    renderPassEncoder.setVertexBuffer(0, buffers.positionsBuffer);
    renderPassEncoder.setVertexBuffer(1, buffers.colorsBuffer);
    renderPassEncoder.setVertexBuffer(2, buffers.texCoordsBuffer);
    renderPassEncoder.setVertexBuffer(3, buffers.normalsBuffer);

    // passes texture
    renderPassEncoder.setBindGroup(0, this.vertexBindGroup);
    renderPassEncoder.setBindGroup(1, this.projectionViewBindGroup);
    renderPassEncoder.setBindGroup(2, this.materialBindGroup);
    renderPassEncoder.setBindGroup(3, this.lightsBindGroup);

    // draw with indexed buffer
    if (buffers.indicesBuffer) {
      renderPassEncoder.setIndexBuffer(buffers.indicesBuffer, "uint16");
      renderPassEncoder.drawIndexed(buffers.indexCount!, instanceCount, 0, 0, 0);
    } else {
      renderPassEncoder.draw(buffers.vertexCount, instanceCount, 0, 0);
    }
  }
}
