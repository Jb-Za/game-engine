import { Camera } from "../camera/Camera";
import { ShadowCamera } from "../camera/ShadowCamera";
import { AmbientLight } from "../lights/AmbientLight";
import { DirectionalLight } from "../lights/DirectionalLight";
import { PointLightsCollection } from "../lights/PointLight";

export class BindGroupLayouts {
  skinnedMaterialBindGroupLayout: GPUBindGroupLayout;
  litSkinnedMaterialBindGroupLayout: GPUBindGroupLayout;
  cameraBGCluster: GPUBindGroupLayout;
  generalUniformsBGCCluster: GPUBindGroupLayout;
  generalUniformsBGCLuster: GPUBindGroupLayout;
  nodeUniformsBindGroupLayout: GPUBindGroupLayout;
  cameraBindGroup: GPUBindGroup;
  generalUniformsBuffer: GPUBuffer;
  generalUniformsBindGroup: GPUBindGroup;
  materialBindGroupLayout: GPUBindGroupLayout;
  litMaterialBindGroupLayout: GPUBindGroupLayout;
  lightsBindGroupLayout: GPUBindGroupLayout;
  lightsBindGroup?: GPUBindGroup;constructor(device: GPUDevice, camera: Camera, shadowCamera?: ShadowCamera, ambientLight?: AmbientLight, directionalLight?: DirectionalLight, pointLights?: PointLightsCollection) {
    // Camera bind group layout for gltf: updated to include eye and light space projection
    this.cameraBGCluster = device.createBindGroupLayout({
      label: "Camera.bindGroupLayout",
      entries: [
        {
          binding: 0,
          buffer: { type: "uniform" },
          visibility: GPUShaderStage.VERTEX,
        },
        {
          binding: 1,
          buffer: { type: "uniform" },
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        },
        {
          binding: 2,
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
    });    // Use the Camera class's buffer for MVP matrices (projView or whatever is in camera.buffer)
    this.cameraBindGroup = device.createBindGroup({
      label: "Camera.bindGroup",
      layout: this.cameraBGCluster,
      entries: [
        { binding: 0, resource: { buffer: camera.buffer.buffer } },
        { binding: 1, resource: { buffer: camera.eyeBuffer.buffer } },
        { binding: 2, resource: { buffer: shadowCamera?.buffer.buffer || camera.buffer.buffer } }, // Fallback to camera buffer if no shadow camera
      ],
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
          buffer: { type: "read-only-storage" },        },
      ],
    });    // Enhanced material bind group layout for lit rendering (includes lights to stay within 4 bind group limit)
    this.litMaterialBindGroupLayout = device.createBindGroupLayout({
      label: "LitMaterial.bindGroupLayout",
      entries: [
        // Material entries
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
          texture: { sampleType: "depth" },
        },
        {
          binding: 5,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: "comparison" },
        },
        // Light entries (combined to stay within 4 bind group limit)
        {
          binding: 6,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: {},
        },
        {
          binding: 7,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: {},
        },        {
          binding: 8,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: {},
        },
      ],
    });

    // Enhanced skinned material bind group layout for lit rendering (includes skin data + lights to stay within 4 bind group limit)
    this.litSkinnedMaterialBindGroupLayout = device.createBindGroupLayout({
      label: "LitSkinnedMaterial.bindGroupLayout",
      entries: [
        // Material entries
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
        // Skin data entries
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
        // Additional material properties for lighting
        {
          binding: 4,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: {},
        },
        {
          binding: 5,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: {},
        },
        {
          binding: 6,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: "depth" },
        },
        {
          binding: 7,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: "comparison" },
        },
        // Light entries (combined to stay within 4 bind group limit)
        {
          binding: 8,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: {},
        },
        {
          binding: 9,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: {},
        },
        {
          binding: 10,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: {},
        },
      ],
    });

    // Lights bind group layout
    this.lightsBindGroupLayout = device.createBindGroupLayout({
      label: "Lights.bindGroupLayout",
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

    // Create lights bind group if lighting data is provided
    if (ambientLight && directionalLight && pointLights) {
      this.lightsBindGroup = device.createBindGroup({
        label: "Lights.bindGroup",
        layout: this.lightsBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: ambientLight.buffer.buffer } },
          { binding: 1, resource: { buffer: directionalLight.buffer.buffer } },
          { binding: 2, resource: { buffer: pointLights.buffer.buffer } },
        ],
      });
    }
  }
}
