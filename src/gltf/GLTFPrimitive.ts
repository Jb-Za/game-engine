import { convertGPUVertexFormatToWGSLFormat } from "./GLTFUtils.ts";
import { AttributeMapInterface, GLTFRenderMode } from "./Interfaces.ts";

//most of this implementation is based on the gltf-skinning example from the webgpu samples repo
//https://webgpu.github.io/webgpu-samples/.
// I have adapted it to fit my project with an attempt to build upon its features

export class GLTFPrimitive {
  topology: GLTFRenderMode;
  renderPipeline: GPURenderPipeline | undefined;
  private attributeMap: AttributeMapInterface;
  private attributes: string[] = [];
  materialIndex?: number; // Track which material this primitive uses
  constructor(
    topology: GLTFRenderMode,
    attributeMap: AttributeMapInterface,
    attributes: string[],
    materialIndex?: number
  ) {
    this.topology = topology;
    this.renderPipeline = undefined;
    // Maps attribute names to accessors
    this.attributeMap = attributeMap;
    this.attributes = attributes;
    this.materialIndex = materialIndex;

    for (const key in this.attributeMap) {
      this.attributeMap[key].view.needsUpload = true;
      if (key === 'INDICES') {
        this.attributeMap['INDICES'].view.addUsage(GPUBufferUsage.INDEX);
        continue;
      }
      this.attributeMap[key].view.addUsage(GPUBufferUsage.VERTEX);
    }
  }

  buildRenderPipeline(
    device: GPUDevice,
    vertexShader: string,
    fragmentShader: string,
    colorFormat: GPUTextureFormat,
    depthFormat: GPUTextureFormat,
    bgLayouts: GPUBindGroupLayout[],
    label: string
  ) {
    // For now, just check if the attributeMap contains a given attribute using map.has(), and add it if it does
    // POSITION, NORMAL, TEXCOORD_0, JOINTS_0, WEIGHTS_0 for order
    // Vertex attribute state and shader stage
    let VertexInputShaderString = `struct VertexInput {\n`;
    const vertexBuffers: GPUVertexBufferLayout[] = this.attributes.map(
      (attr, idx) => {
        const vertexFormat: GPUVertexFormat = this.attributeMap[attr].vertexType as GPUVertexFormat;
        const attrString = attr.toLowerCase().replace(/_0$/, '');
        VertexInputShaderString += `\t@location(${idx}) ${attrString}: ${convertGPUVertexFormatToWGSLFormat(vertexFormat)},\n`;
        return {
          arrayStride: this.attributeMap[attr].byteStride,
          attributes: [
            {
              format: this.attributeMap[attr].vertexType,
              offset: 0, // <-- Always 0 for non-interleaved buffers
              shaderLocation: idx,
            },
          ],
        } as GPUVertexBufferLayout;
      }
    );
    VertexInputShaderString += '}';

    const vertexState: GPUVertexState = {
      // Shader stage info
      module: device.createShaderModule({
        code: VertexInputShaderString + vertexShader,
      }),
      buffers: vertexBuffers,
      entryPoint: 'vertexMain'
    };

    const fragmentState: GPUFragmentState = {
      // Shader info
      module: device.createShaderModule({
        code: VertexInputShaderString + fragmentShader,
      }),
      // Output render target info
      targets: [{ format: colorFormat }],
      entryPoint: 'fragmentMain'
    };

    // Our loader only supports triangle lists and strips, so by default we set
    // the primitive topology to triangle list, and check if it's instead a triangle strip
    const primitive: GPUPrimitiveState = { topology: 'triangle-list' };
    if (this.topology == GLTFRenderMode.TRIANGLE_STRIP) {
      primitive.topology = 'triangle-strip';
      primitive.stripIndexFormat = this.attributeMap['INDICES'].vertexType as GPUIndexFormat;
    }

    const layout: GPUPipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: bgLayouts,
      label: `${label}.pipelineLayout`,
    });

    const rpDescript: GPURenderPipelineDescriptor = {
      layout: layout,
      label: `${label}.pipeline`,
      vertex: vertexState,
      fragment: fragmentState,
      primitive: primitive,
      depthStencil: {
        format: depthFormat,
        depthWriteEnabled: true,
        depthCompare: 'less',
      },
    };

    this.renderPipeline = device.createRenderPipeline(rpDescript);
  }

  render(renderPassEncoder: GPURenderPassEncoder, bindGroups: GPUBindGroup[], materialBindGroups?: GPUBindGroup[]) {
    if (!this.renderPipeline) throw new Error("Render pipeline not built");
    renderPassEncoder.setPipeline(this.renderPipeline);
    
    // Set required bind groups
    bindGroups.forEach((bg, idx) => {
      renderPassEncoder.setBindGroup(idx, bg);
    });

    // Set material bind group if available and primitive has a material
    if (materialBindGroups && this.materialIndex !== undefined && materialBindGroups[this.materialIndex]) {
      renderPassEncoder.setBindGroup(bindGroups.length, materialBindGroups[this.materialIndex]);
    }

    // Set vertex buffers
    this.attributes.map((attr, idx) => {
      renderPassEncoder.setVertexBuffer(
        idx,
        this.attributeMap[attr].view.gpuBuffer!,
        this.attributeMap[attr].byteOffset,
        this.attributeMap[attr].byteLength
      );
    });

    if (this.attributeMap['INDICES']) {
      renderPassEncoder.setIndexBuffer(
        this.attributeMap['INDICES'].view.gpuBuffer!,
        this.attributeMap['INDICES'].vertexType as GPUIndexFormat,
        this.attributeMap['INDICES'].byteOffset,
        this.attributeMap['INDICES'].byteLength
      );
      renderPassEncoder.drawIndexed(this.attributeMap['INDICES'].count);
    } else {
      renderPassEncoder.draw(this.attributeMap['POSITION'].count);
    }
  }
}