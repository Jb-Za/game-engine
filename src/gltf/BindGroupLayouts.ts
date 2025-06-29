import { Camera } from "../camera/Camera";

export class BindGroupLayouts {
  skinnedMaterialBindGroupLayout: GPUBindGroupLayout;
  cameraBGCluster: GPUBindGroupLayout;
  generalUniformsBGCCluster: GPUBindGroupLayout;
  generalUniformsBGCLuster: GPUBindGroupLayout;
  nodeUniformsBindGroupLayout: GPUBindGroupLayout;
  cameraBindGroup: GPUBindGroup;
  generalUniformsBuffer: GPUBuffer;
  generalUniformsBindGroup: GPUBindGroup;
  materialBindGroupLayout: GPUBindGroupLayout;
  constructor(device: GPUDevice, camera: Camera) {
    // Camera bind group layout for gltf: single mat4x4 (projectionView)
    this.cameraBGCluster = device.createBindGroupLayout({
      label: "Camera.bindGroupLayout",
      entries: [
        {
          binding: 0,
          buffer: { type: "uniform" },
          visibility: GPUShaderStage.VERTEX,
        },
      ],
    });

    this.generalUniformsBGCCluster = device.createBindGroupLayout({
      label: "General.bindGroupLayout",
      entries: [
        {
          binding: 0,
          buffer: { type: "uniform" },
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        },
      ],
    });

    this.generalUniformsBGCLuster = device.createBindGroupLayout({
      label: "General.bindGroupLayout",
      entries: [
        {
          binding: 0,
          buffer: { type: "uniform" },
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        },
      ],
    });

    // Node uniforms bind group layout (already in your code)
    this.nodeUniformsBindGroupLayout = device.createBindGroupLayout({
      label: "NodeUniforms.bindGroupLayout",
      entries: [
        {
          binding: 0,
          buffer: { type: "uniform" },
          visibility: GPUShaderStage.VERTEX,
        },
      ],
    });

    this.generalUniformsBGCCluster = device.createBindGroupLayout({
      label: "General.bindGroupLayout",
      entries: [
        {
          binding: 0,
          buffer: { type: "uniform" },
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        },
      ],
    });

    // Use the Camera class's buffer for MVP matrices (projView or whatever is in camera.buffer)
    this.cameraBindGroup = device.createBindGroup({
      label: "Camera.bindGroup",
      layout: this.cameraBGCluster,
      entries: [{ binding: 0, resource: { buffer: camera.buffer.buffer } }],
    });

    // General uniforms buffer (e.g., render mode, skin mode)
    this.generalUniformsBuffer = device.createBuffer({
      size: Uint32Array.BYTES_PER_ELEMENT * 2,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.generalUniformsBindGroup = device.createBindGroup({
      label: "GeneralUniforms.bindGroup",
      layout: this.generalUniformsBGCLuster,
      entries: [{ binding: 0, resource: { buffer: this.generalUniformsBuffer } }],
    }); // For rigid models - uses separate bind group

    this.materialBindGroupLayout = device.createBindGroupLayout({
      label: "Material.bindGroupLayout",
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
      ],
    });

    // For skinned models - combines with skin data in group 3
    this.skinnedMaterialBindGroupLayout = device.createBindGroupLayout({
      label: "SkinnedMaterial.bindGroupLayout",
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
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "read-only-storage" },
        },
        {
          binding: 3,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "read-only-storage" },
        },
      ],
    });
  }
}
