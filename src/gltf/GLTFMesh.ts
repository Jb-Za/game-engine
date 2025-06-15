import { GLTFPrimitive } from "./GLTFPrimitive";

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
    bgLayouts: GPUBindGroupLayout[]
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
        `PrimitivePipeline${i}`
      );
    }
  }

  render(renderPassEncoder: GPURenderPassEncoder, bindGroups: GPUBindGroup[]) {
    // We take a pretty simple approach to start. Just loop through all the primitives and
    // call their individual draw methods
    for (let i = 0; i < this.primitives.length; ++i) {
      this.primitives[i].render(renderPassEncoder, bindGroups);
    }
  }
}