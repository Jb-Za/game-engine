import { Camera } from "../camera/Camera";
import { ShadowCamera } from "../camera/ShadowCamera";
import { AmbientLight } from "../lights/AmbientLight";
import { DirectionalLight } from "../lights/DirectionalLight";
import { Mat4x4 } from "../math/Mat4x4";
import { GLTFMesh } from "./GLTFMesh";
import { GLTFScene } from "./GLTFScene";
import { GLTFSkin } from "./GLTFSkin";
import { convertGLBToJSONAndBinary, TempReturn } from "./GLTFUtils";
import gltfSkinnedWGSL from "../shaders/gltfSkinned.wgsl?raw";
import gltfRigidWGSL from "../shaders/gltfRigid.wgsl?raw";
import { GLTFAnimationPlayer } from "./GLTFAnimationPlayer";
import { Vec3 } from "../math/Vec3";
import { GLTFNode } from "./GLTFNode";
import { PointLightsCollection } from "../lights/PointLight";

//most of this implementation is based on the gltf-skinning example from the webgpu samples repo
//https://webgpu.github.io/webgpu-samples/.
// I have adapted it to fit my project with an attempt to build upon its features

/**
 * Render modes:
 * 0: Normal visualization (default)
 * 1: UV coordinates visualization (or joint indices for skinned models)
 * 2: Texture rendering (if available) or weights visualization for skinned models
 * 3: Weights visualization (skinned models only)
 */
export class GLTFGameObject {
  private _gltfScene: any;
  public cameraBGCluster: GPUBindGroupLayout;
  public generalUniformsBGCCluster: GPUBindGroupLayout;
  public nodeUniformsBindGroupLayout: GPUBindGroupLayout;
  public cameraBindGroup: GPUBindGroup;
  public generalUniformsBindGroup: GPUBindGroup;
  public generalUniformsBuffer: GPUBuffer;
  public generalUniformsBGCLuster: GPUBindGroupLayout;
  private animationPlayer?: GLTFAnimationPlayer;
  public materialBindGroupLayout: GPUBindGroupLayout;
  public skinnedMaterialBindGroupLayout: GPUBindGroupLayout;
  public materialBindGroups: GPUBindGroup[] = [];

  public get gltfScene(): any {
    return this._gltfScene;
  }

  public skinMode = 0; // 0=skinned, 1=non-skinned
  constructor(
    private device: GPUDevice,
    camera: Camera,
    _shadowCamera: ShadowCamera,
    _ambientLight: AmbientLight,
    _directionalLight: DirectionalLight,
    _pointLights: PointLightsCollection,
    private presentationFormat: GPUTextureFormat,
    private depthTexture: GPUTexture,
    public scale: Vec3 = new Vec3(1, 1, 1),
    public position: Vec3 = new Vec3(0, 0, 0),
    public rotation: number[] = [0, 0, 0, 1] // quaternion [x, y, z, w]
  ) {
    // Camera bind group layout for gltf: single mat4x4 (projectionView)
    this.cameraBGCluster = this.device.createBindGroupLayout({
      label: "Camera.bindGroupLayout",
      entries: [
        {
          binding: 0,
          buffer: { type: "uniform" },
          visibility: GPUShaderStage.VERTEX,
        },
      ],
    });

    this.generalUniformsBGCCluster = this.device.createBindGroupLayout({
      label: "General.bindGroupLayout",
      entries: [
        {
          binding: 0,
          buffer: { type: "uniform" },
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        },
      ],
    });

    this.generalUniformsBGCLuster = this.device.createBindGroupLayout({
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
    this.nodeUniformsBindGroupLayout = this.device.createBindGroupLayout({
      label: "NodeUniforms.bindGroupLayout",
      entries: [
        {
          binding: 0,
          buffer: { type: "uniform" },
          visibility: GPUShaderStage.VERTEX,
        },
      ],
    });

    this.generalUniformsBGCCluster = this.device.createBindGroupLayout({
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
      layout: this.cameraBGCluster,
      entries: [{ binding: 0, resource: { buffer: camera.buffer.buffer } }],
    });

    // General uniforms buffer (e.g., render mode, skin mode)
    this.generalUniformsBuffer = device.createBuffer({
      size: Uint32Array.BYTES_PER_ELEMENT * 2,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.generalUniformsBindGroup = device.createBindGroup({
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
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "read-only-storage" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "read-only-storage" },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {},
        },
        {
          binding: 3,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {},
        },
      ],
    });
  }
  public update(deltaTime: number) {
    if (!this._gltfScene) return;

    // --- BEGIN: Animation playback ---
    if (this.animationPlayer) {
      this.animationPlayer.update(deltaTime);
    } else {
      this.animationPlayer = new GLTFAnimationPlayer(this._gltfScene.animations, this._gltfScene.nodes);
    }
    //--- END: Animation playback --

    if (this._gltfScene.scenes && this._gltfScene.scenes.length > 0) {
      const scene = this._gltfScene.scenes[0];

      // Apply transformation to the root node
      if (scene.root) {
        scene.root.source.position = this.position;
        scene.root.source.scale = this.scale; // Scale down to fit the scene;
        scene.root.source.rotation = this.rotation;
      }
    }
    // After animating joints, update all node world matrices
    for (const scene of this.gltfScene.scenes) {
      scene.root.updateWorldMatrix(this.device);
    }

    // Update all skins (for animation)
    if (this.gltfScene.skins) {
      for (let i = 0; i < this.gltfScene.skins.length; ++i) {
        // Find the node index that uses this skin
        for (let n = 0; n < this.gltfScene.nodes.length; ++n) {
          if (this.gltfScene.nodes[n].skin === this.gltfScene.skins[i]) {
            this.gltfScene.skins[i].update(this.device, n, this.gltfScene.nodes);
          }
        }
      }
    }

    // Default to showing textures (mode 2) if we have them available
    // Can be overridden by calling setRenderMode explicitly
    if (this.materialBindGroups.length > 0) {
      // Check if any materials have textures
      let hasTextures = false;
      if (this._gltfScene.materials) {
        for (const material of this._gltfScene.materials) {
          if (material.pbrMetallicRoughness && material.pbrMetallicRoughness.baseColorTexture) {
            hasTextures = true;
            break;
          }
        }
      }

      // Use texture render mode if textures are available
      const renderMode = hasTextures ? 2 : 0;
      this.device.queue.writeBuffer(this.generalUniformsBuffer, 0, new Uint32Array([renderMode, this.skinMode]));
    } else {
      // Default to normal visualization if no materials/textures
      this.device.queue.writeBuffer(this.generalUniformsBuffer, 0, new Uint32Array([0, this.skinMode]));
    }
  }
  public draw(renderPassEncoder: GPURenderPassEncoder) {
    for (const scene of this._gltfScene.scenes) {
      scene.root.renderDrawables(renderPassEncoder, [this.cameraBindGroup, this.generalUniformsBindGroup], this.materialBindGroups);
    }
  }
  public async initialize(assetLocation: string) {
    this._gltfScene = await fetch(assetLocation)
      .then((res) => res.arrayBuffer())
      .then((buffer) => convertGLBToJSONAndBinary(buffer, this.device)); // First decode textures
    await this.decodeTextures(this.device, this._gltfScene.textures || []);

    // Then create material bind groups
    this.createMaterialBindGroups(this.device, this._gltfScene.materials || [], this._gltfScene.textures || []);

    // Define bind group layouts for the pipeline
    const bindGroupLayouts = [this.cameraBGCluster, this.generalUniformsBGCLuster, this.nodeUniformsBindGroupLayout, this.materialBindGroupLayout];

    const skinLayouts = [this.cameraBGCluster, this.generalUniformsBGCLuster, this.nodeUniformsBindGroupLayout, this.skinnedMaterialBindGroupLayout];

    // Build gltf pipeline with new camera layout (single mat4x4)
    this._gltfScene.meshes.forEach((mesh: GLTFMesh) => {
      if (this.skinMode === 0) {
        mesh.buildRenderPipeline(this.device, gltfRigidWGSL, gltfRigidWGSL, this.presentationFormat, this.depthTexture.format, bindGroupLayouts);
      } else {
        mesh.buildRenderPipeline(this.device, gltfSkinnedWGSL, gltfSkinnedWGSL, this.presentationFormat, this.depthTexture.format, skinLayouts);
      }
    });
  }

  private async decodeTextures(device: GPUDevice, textures: any[]) {
    // Decode images and create textures
    for (const texture of textures) {
      if (texture.source.view !== undefined) {
        // 1. Extract bytes from bufferView
        const bufferView = texture.source.view; // This should be your GLTFBufferView instance
        const imageBytes = new Uint8Array(bufferView.buffer, bufferView.byteOffset, bufferView.byteLength);

        // 2. Create a Blob and ImageBitmap
        const blob = new Blob([imageBytes], { type: texture.mimeType });
        const imageBitmap = await createImageBitmap(blob); // 3. Upload to GPU
        const gpuTexture = device.createTexture({
          size: [imageBitmap.width, imageBitmap.height],
          format: "rgba8unorm",
          usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        });
        device.queue.copyExternalImageToTexture({ source: imageBitmap }, { texture: gpuTexture }, [imageBitmap.width, imageBitmap.height]);
        texture.texture = gpuTexture;

        let sampler = texture.sampler;

        // Create sampler with default or provided parameters
        const samplerDescriptor: GPUSamplerDescriptor = {
          addressModeU: sampler.wrapS === 10497 ? "repeat" : "clamp-to-edge",
          addressModeV: sampler.wrapT === 10497 ? "repeat" : "clamp-to-edge",
          magFilter: sampler.magFilter === 9728 ? "nearest" : "linear",
          minFilter: sampler.minFilter === 9728 ? "nearest" : "linear",
          mipmapFilter: "linear",
        };
        sampler.gpuSampler = device.createSampler(samplerDescriptor);
        texture.gpuSampler = sampler.gpuSampler;
      }
    }
  }
  private createMaterialBindGroups(device: GPUDevice, materials: any[], textures: any[]) {
    this.materialBindGroups = [];
    // Create a default white texture for materials without textures
    const defaultTexture = device.createTexture({
      size: [1, 1],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    device.queue.writeTexture({ texture: defaultTexture }, new Uint8Array([255, 255, 255, 255]), { bytesPerRow: 4 }, { width: 1, height: 1 });

    // Create a default sampler
    const defaultSampler = device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "linear",
      addressModeU: "repeat",
      addressModeV: "repeat",
    });

    // Process each material
    for (const material of materials) {
      // Get base color texture from material or use default
      let baseColorTexture = defaultTexture;
      let baseColorSampler = defaultSampler;

      if (material.pbrMetallicRoughness && material.pbrMetallicRoughness.baseColorTexture && material.pbrMetallicRoughness.baseColorTexture.index !== undefined) {
        const textureInfo = material.pbrMetallicRoughness.baseColorTexture;
        const texture = textures[textureInfo.index];

        if (texture && texture.texture) {
          baseColorTexture = texture.texture;
          baseColorSampler = texture.gpuSampler || defaultSampler;
        }
      }

      // For rigid models - create standard material bind group
      const bindGroup = device.createBindGroup({
        layout: this.materialBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: baseColorTexture.createView(),
          },
          {
            binding: 1,
            resource: baseColorSampler,
          },
        ],
        label: `Material_${this.materialBindGroups.length}_BindGroup`,
      });

      this.materialBindGroups.push(bindGroup);

      // Create combined skin+material bind groups for each skin
      // This handles the WebGPU limitation of max 4 bind groups (indices 0-3)
      if (this.gltfScene?.skins) {
        for (const skin of this.gltfScene.skins) {
          const combinedBindGroup = device.createBindGroup({
            layout: this.skinnedMaterialBindGroupLayout,
            entries: [
              // Skin data
              {
                binding: 0,
                resource: {
                  buffer: skin.jointMatricesUniformBuffer,
                },
              },
              {
                binding: 1,
                resource: {
                  buffer: skin.inverseBindMatricesUniformBuffer,
                },
              },
              // Material data
              {
                binding: 2,
                resource: baseColorTexture.createView(),
              },
              {
                binding: 3,
                resource: baseColorSampler,
              },
            ],
            label: `Combined_Skin${skin.joints.join("_")}_Material${this.materialBindGroups.length - 1}_BindGroup`,
          });

          // Store combined bind group in the skin for later use
          skin.combinedMaterialBindGroups = skin.combinedMaterialBindGroups || [];
          skin.combinedMaterialBindGroups.push(combinedBindGroup);
        }
      }
    }

    // Add a default material bind group if no materials are defined
    if (this.materialBindGroups.length === 0) {
      const bindGroup = device.createBindGroup({
        layout: this.materialBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: defaultTexture.createView(),
          },
          {
            binding: 1,
            resource: defaultSampler,
          },
        ],
        label: "Default_Material_BindGroup",
      });

      this.materialBindGroups.push(bindGroup);
    }
  }

  /**
   * Set the render mode for GLTF models
   * @param mode 0: normal visualization, 1: UV visualization (or joints for skinned models),
   *             2: texture mode (or weights for skinned models if no textures),
   *             3: weights visualization (skinned models only)
   */
  public setRenderMode(mode: number) {
    if (this.skinMode === 1 && mode > 3) {
      console.warn("Invalid render mode for skinned models. Valid modes: 0-3");
      mode = 0;
    } else if (mode > 2) {
      console.warn("Invalid render mode for rigid models. Valid modes: 0-2");
      mode = 0;
    }

    // Update the general uniforms buffer with the new render mode
    this.device.queue.writeBuffer(this.generalUniformsBuffer, 0, new Uint32Array([mode, this.skinMode]));
  }
}
