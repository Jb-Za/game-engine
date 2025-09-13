import { GLTFPrimitive } from "./GLTFPrimitive";

//most of this implementation is based on the gltf-skinning example from the webgpu samples repo
//https://webgpu.github.io/webgpu-samples/.
// I have adapted it to fit my project with an attempt to build upon its features

export class GLTFMesh {
  name: string;
  primitives: GLTFPrimitive[];
  constructor(name: string, primitives: GLTFPrimitive[]) {
    this.name = name;
    this.primitives = primitives;
  }  
  
  buildRenderPipeline(
    device: GPUDevice,
    vertexShader: string,
    fragmentShader: string,
    colorFormat: GPUTextureFormat,
    depthFormat: GPUTextureFormat,
    bgLayouts: GPUBindGroupLayout[],
    multipleRenderTargets: boolean = false
  ) {
    // We take a pretty simple approach to start. Just loop through all the primitives and
    // build their respective render pipelines
    for (let i = 0; i < this.primitives.length; ++i) {
      this.primitives[i].buildRenderPipeline(
        device,
        vertexShader,
        fragmentShader,
        colorFormat,
        depthFormat,
        bgLayouts,
        `PrimitivePipeline${i}`,
        multipleRenderTargets
      );
    }
  }

  buildShadowRenderPipelines(
    device: GPUDevice,
    rigidShadowBgLayouts: GPUBindGroupLayout[],
    skinnedShadowBgLayouts: GPUBindGroupLayout[]
  ) {
    // Build shadow pipelines for all primitives
    for (let i = 0; i < this.primitives.length; ++i) {
      const primitive = this.primitives[i];
      const isSkinned = primitive.attributeNames.includes('JOINTS_0');
      const bgLayouts = isSkinned ? skinnedShadowBgLayouts : rigidShadowBgLayouts;
      
      primitive.buildShadowRenderPipeline(
        device,
        bgLayouts,
        `PrimitiveShadowPipeline${i}`
      );
    }
  }

  renderShadows(renderPassEncoder: GPURenderPassEncoder, bindGroups: GPUBindGroup[]) {
    // For shadow rendering, we only need to render geometry without materials
    // We'll use the shadow render method with minimal bind groups
    for (let i = 0; i < this.primitives.length; ++i) {
      this.primitives[i].renderShadows(renderPassEncoder, bindGroups);
    }
  }

  render(renderPassEncoder: GPURenderPassEncoder, bindGroups: GPUBindGroup[], getBindGroupForPrimitive?: (primitive: GLTFPrimitive) => GPUBindGroup) {
    // We take a pretty simple approach to start. Just loop through all the primitives and
    // call their individual draw methods
    for (let i = 0; i < this.primitives.length; ++i) {
      // If we have a primitive-specific bind group function, use it to get the correct bind group
      if (getBindGroupForPrimitive) {
        const primitiveSpecificBindGroup = getBindGroupForPrimitive(this.primitives[i]);
        // Replace the last bind group (material/skin bind group) with the primitive-specific one
        const primitiveBindGroups = [...bindGroups];
        primitiveBindGroups[primitiveBindGroups.length - 1] = primitiveSpecificBindGroup;
        this.primitives[i].render(renderPassEncoder, primitiveBindGroups);
      } else {
        // Fallback to original behavior
        this.primitives[i].render(renderPassEncoder, bindGroups);
      }
    }
  }
}