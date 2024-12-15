
import { Vec4 } from "../math/Vec4";
import { GLTFTexture, ImageUsage } from "./GLTFTexture";

export class GLTFMaterial {
  baseColorFactor: Vec4 = new Vec4(1, 1, 1, 1);
  baseColorTexture: GLTFTexture | null = null;

  // TODO later: multiple texture coords support

  metallicFactor: number = 1;
  roughnessFactor: number = 1;
  metallicRoughnessTexture: GLTFTexture | null = null;

  // TODO: normal, occlusion, emissive textures

  // Uniform buffer holding the material factor params
  paramBuffer: GPUBuffer | null = null;

  bindGroupLayout: GPUBindGroupLayout | null= null;
  bindGroup: GPUBindGroup | null= null;

  constructor(
    baseColorFactor: Vec4,
    baseColorTexture: GLTFTexture | null,
    metallicFactor: number,
    roughnessFactor: number,
    metallicRoughnessTexture: GLTFTexture | null
  ) {
    this.baseColorFactor = baseColorFactor;
    this.baseColorTexture = baseColorTexture;
    if (this.baseColorTexture) {
      this.baseColorTexture.setUsage(ImageUsage.BASE_COLOR);
    }

    this.metallicFactor = metallicFactor;
    this.roughnessFactor = roughnessFactor;
    this.metallicRoughnessTexture = metallicRoughnessTexture;
    if (this.metallicRoughnessTexture) {
      this.metallicRoughnessTexture.setUsage(ImageUsage.METALLIC_ROUGHNESS);
    }
  }

  // Upload params buffer and create the bind group and bind group layout
  // for the material params
  upload(device: GPUDevice) {
    this.paramBuffer = device.createBuffer({
      // We'll be passing 6 floats, which round up to 8 in UBO alignment
      size: 8 * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
      mappedAtCreation: true,
    });

    // Upload the factor params
    {
      const params = new Float32Array(this.paramBuffer.getMappedRange());
      params.set(this.baseColorFactor, 0);
      params.set([this.metallicFactor, this.roughnessFactor], 4);
    }
    this.paramBuffer.unmap();

    let bgLayoutEntries: GPUBindGroupLayoutEntry[] = [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: {
          type: "uniform",
        },
      },
    ];

    let bgEntries: GPUBindGroupEntry[] = [
      {
        binding: 0,
        resource: {
          buffer: this.paramBuffer,
          size: 8 * 4,
        },
      },
    ];

    // If we have a base color texture, add the sampler and texture bindings
    if (this.baseColorTexture) {
      bgLayoutEntries.push({
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {},
      });
      bgLayoutEntries.push({
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {},
      });

      bgEntries.push({
        binding: 1,
        resource: this.baseColorTexture.sampler.sampler as GPUSampler,
      });
      bgEntries.push({
        binding: 2,
        resource: this.baseColorTexture.image.view as GPUTextureView,
      });
    }

    // If we have a metallicRoughnessTexture, add its sampler and texture bindings
    if (this.metallicRoughnessTexture) {
      bgLayoutEntries.push({
        binding: 3,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {},
      });
      bgLayoutEntries.push({
        binding: 4,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {},
      });

      bgEntries.push({
        binding: 3,
        resource: this.metallicRoughnessTexture.sampler.sampler as GPUSampler,
      });
      bgEntries.push({
        binding: 4,
        resource: this.metallicRoughnessTexture.image.view as GPUTextureView,
      });
    }

    this.bindGroupLayout = device.createBindGroupLayout({
      entries: bgLayoutEntries,
    });

    // Create the bind group
    this.bindGroup = device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: bgEntries,
    });
  }
}