import { GeometryBuffers } from "../attribute_buffers/GeometryBuffers";
import { Camera } from "../camera/Camera";
import { ShadowCamera } from "../camera/ShadowCamera";
import { AmbientLight } from "../lights/AmbientLight";
import { DirectionalLight } from "../lights/DirectionalLight";
import { PointLightsCollection } from "../lights/PointLight";
import { Color } from "../math/Color";
import { Vec2 } from "../math/Vec2";
import { Vec4 } from "../math/Vec4";
import waterShaderSource from "../shaders/WaterShader.wgsl?raw";
import { Texture2D } from "../texture/Texture2D";
import { UniformBuffer } from "../uniform_buffers/UniformBuffer";

export class WaterRenderPipeline {
  private renderPipeline: GPURenderPipeline;
  private wireframeRenderPipeline: GPURenderPipeline;
  private materialBindGroupLayout!: GPUBindGroupLayout;

  private materialBindGroup!: GPUBindGroup;
  private vertexBindGroup!: GPUBindGroup;
  private lightsBindGroup!: GPUBindGroup;
  private projectionViewBindGroup!: GPUBindGroup;

  private _diffuseTexture!: Texture2D;
  private _shadowTexture!: Texture2D;
  private _wireframeMode: boolean = false;

  public set wireframeMode(value: boolean) {
    this._wireframeMode = value;
  }

  public get wireframeMode(): boolean {
    return this._wireframeMode;
  }

  public set diffuseTexture(texture: Texture2D) {
    this._diffuseTexture = texture;
    this.materialBindGroup = this.createMaterialBindGroup(this._diffuseTexture, this._shadowTexture);
  }

  public set shadowTexture(texture: Texture2D) {
      this._shadowTexture = texture;
      this.materialBindGroup = this.createMaterialBindGroup(this._diffuseTexture, this._shadowTexture);
  }

  // Combined water parameters to reduce uniform buffer count
  private waterParamsBuffer: UniformBuffer; // time, texTilingX, texTilingY, unused
  private _waterParams: Vec4 = new Vec4(0, 1, 1, 0); // time, texTilingX, texTilingY, unused

  private waveParamsBuffer: UniformBuffer;
  private _waveParams: Vec4 = new Vec4(1.0, 0.5, 2.0, 1.0); // speed, height, frequency, scale

  public set time(value: number) {
    this._waterParams.x = value;
    this.waterParamsBuffer.update(this._waterParams);
  }

  public set textureTiling(value: Vec2) {
    this._waterParams.y = value.x;
    this._waterParams.z = value.y;
    this.waterParamsBuffer.update(this._waterParams);
  }

  public set waveParams(value: Vec4) {
    this._waveParams = value;
    this.waveParamsBuffer.update(value);
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

  constructor(
    private device: GPUDevice, 
    camera: Camera, 
    shadowCamera: ShadowCamera, 
    transformsBuffer: UniformBuffer, 
    normalmatrixBuffer: UniformBuffer,
    ambientLight: AmbientLight,
    directionalLight: DirectionalLight,
    pointLights: PointLightsCollection
  ) {

    this.waterParamsBuffer = new UniformBuffer(
      device,
      this._waterParams,
      "Water Combined Parameters Buffer"
    );

    this.waveParamsBuffer = new UniformBuffer(
      device,
      this._waveParams,
      "Water Wave Parameters Buffer"
    );

    this.diffuseColorBuffer = new UniformBuffer(
      device,
      this._diffuseColor,
      "Water Diffuse Color Buffer"
    );

    this.shininessBuffer = new UniformBuffer(
      device, 
      new Float32Array([this._shininess]), 
      "Water Shininess Buffer"
    );

    const shaderModule = device.createShaderModule({
      code: waterShaderSource,
    });

    const bufferLayout: Array<GPUVertexBufferLayout> = [];

    bufferLayout.push({
      arrayStride: 3 * Float32Array.BYTES_PER_ELEMENT,
      attributes: [
        {
          format: "float32x3" as GPUVertexFormat,
          offset: 0,
          shaderLocation: 0,
        },
      ],
    });

    bufferLayout.push({
      arrayStride: 4 * Float32Array.BYTES_PER_ELEMENT,
      attributes: [
        {
          format: "float32x4" as GPUVertexFormat,
          offset: 0,
          shaderLocation: 1,
        },
      ],
    });

    bufferLayout.push({
      arrayStride: 2 * Float32Array.BYTES_PER_ELEMENT,
      attributes: [
        {
          format: "float32x2" as GPUVertexFormat,
          offset: 0,
          shaderLocation: 2,
        },
      ],
    });

    bufferLayout.push({
      arrayStride: 3 * Float32Array.BYTES_PER_ELEMENT,
      attributes: [
        {
          format: "float32x3" as GPUVertexFormat,
          offset: 0,
          shaderLocation: 3,
        },
      ],
    });

    const bindGroupLayouts = this.createBindGroupLayouts();

    this.renderPipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: bindGroupLayouts,
      }),
      vertex: {
        module: shaderModule,
        entryPoint: "waterVS",
        buffers: bufferLayout,
      },
      fragment: {
        module: shaderModule,
        entryPoint: "waterFS",
        targets: [
          {
            format: "bgra8unorm" as GPUTextureFormat,
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add'
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'zero',
                operation: 'add'
              }
            }
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth32float'
      },
    });

    // Wireframe version
    this.wireframeRenderPipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: bindGroupLayouts,
      }),
      vertex: {
        module: shaderModule,
        entryPoint: "waterVS",
        buffers: bufferLayout,
      },
      fragment: {
        module: shaderModule,
        entryPoint: "waterFS",
        targets: [
          {
            format: "bgra8unorm" as GPUTextureFormat,
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add'
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'zero',
                operation: 'add'
              }
            }
          },
        ],
      },
      primitive: {
        topology: "line-list",
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth32float'
      },
    });

    this.vertexBindGroup = this.createVertexBindGroup(transformsBuffer, normalmatrixBuffer);
    this.projectionViewBindGroup = this.createProjectionViewBindGroup(camera, shadowCamera);
    this.lightsBindGroup = this.createLightsBindGroup(ambientLight, directionalLight, pointLights);

    // Create default textures for water
    this.createDefaultTextures();
  }

  private createDefaultTextures() {
    // Create a simple 1x1 blue texture for water
    const defaultWaterTexture = this.device.createTexture({
      label: "Default_Water_Texture",
      size: [1, 1],
      format: "rgba8unorm-srgb",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    const defaultSampler = this.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "linear",
      addressModeU: "repeat",
      addressModeV: "repeat",
    });

    // Write blue pixel to texture
    this.device.queue.writeTexture(
      { texture: defaultWaterTexture }, 
      new Uint8Array([100, 150, 255, 255]), // Light blue
      { bytesPerRow: 4 }, 
      { width: 1, height: 1 }
    );

    this._diffuseTexture = new Texture2D(this.device, defaultWaterTexture);
    this._diffuseTexture.sampler = defaultSampler;
  }

  private createBindGroupLayouts(): GPUBindGroupLayout[] {
    const vertexBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: {},
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: {},
        },
        {
          binding: 2,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: {},
        },
        {
          binding: 3,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: {},
        },
      ],
    });

    const projectionViewBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: {},
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: {},
        },
        {
          binding: 2,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: {},
        },
      ],
    });

    this.materialBindGroupLayout = this.device.createBindGroupLayout({
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
            sampleType: 'depth'
          },
        },
        {
          binding: 5,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {
            type: 'comparison'
          },
        },
      ],
    });

    const lightsBindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: {},
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: {},
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: {},
        },
      ],
    });

    return [vertexBindGroupLayout, projectionViewBindGroupLayout, this.materialBindGroupLayout, lightsBindGroupLayout];
  }

  private createVertexBindGroup(transformsBuffer: UniformBuffer, normalmatrixBuffer: UniformBuffer): GPUBindGroup {
    return this.device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
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
            buffer: this.waterParamsBuffer.buffer,
          },
        },
        {
          binding: 3,
          resource: {
            buffer: this.waveParamsBuffer.buffer,
          },
        },
      ],
    });
  }

  private createProjectionViewBindGroup(camera: Camera, shadowCamera: ShadowCamera): GPUBindGroup {
    return this.device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(1),
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
  }

  private createMaterialBindGroup(diffuseTexture: Texture2D, shadowTexture: Texture2D): GPUBindGroup {
    if (!diffuseTexture || !shadowTexture) {
      throw new Error('Textures must be set before creating material bind group');
    }

    return this.device.createBindGroup({
      layout: this.materialBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: diffuseTexture.texture.createView(),
        },
        {
          binding: 1,
          resource: diffuseTexture.sampler,
        },
        {
          binding: 2,
          resource: {
            buffer: this.diffuseColorBuffer.buffer,
          },
        },
        {
          binding: 3,
          resource: {
            buffer: this.shininessBuffer.buffer,
          },
        },
        {
          binding: 4,
          resource: shadowTexture.texture.createView(),
        },
        {
          binding: 5,
          resource: shadowTexture.sampler,
        },
      ],
    });
  }

  private createLightsBindGroup(ambientLight: AmbientLight, directionalLight: DirectionalLight, pointLights: PointLightsCollection): GPUBindGroup {
    return this.device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(3),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: ambientLight.buffer.buffer,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: directionalLight.buffer.buffer,
          },
        },
        {
          binding: 2,
          resource: {
            buffer: pointLights.buffer.buffer,
          },
        },
      ],
    });
  }

  public draw(renderPassEncoder: GPURenderPassEncoder, geometryBuffers: GeometryBuffers) {
    const pipeline = this._wireframeMode ? this.wireframeRenderPipeline : this.renderPipeline;
    
    renderPassEncoder.setPipeline(pipeline);
    renderPassEncoder.setBindGroup(0, this.vertexBindGroup);
    renderPassEncoder.setBindGroup(1, this.projectionViewBindGroup);
    renderPassEncoder.setBindGroup(2, this.materialBindGroup);
    renderPassEncoder.setBindGroup(3, this.lightsBindGroup);

    renderPassEncoder.setVertexBuffer(0, geometryBuffers.positionsBuffer);
    renderPassEncoder.setVertexBuffer(1, geometryBuffers.colorsBuffer);
    renderPassEncoder.setVertexBuffer(2, geometryBuffers.texCoordsBuffer);
    renderPassEncoder.setVertexBuffer(3, geometryBuffers.normalsBuffer);
    
    if (geometryBuffers.indicesBuffer && geometryBuffers.indexCount) {
      renderPassEncoder.setIndexBuffer(geometryBuffers.indicesBuffer, "uint16");
      renderPassEncoder.drawIndexed(geometryBuffers.indexCount, 1, 0, 0, 0);
    } else {
      renderPassEncoder.draw(geometryBuffers.vertexCount, 1, 0, 0);
    }
  }
}
