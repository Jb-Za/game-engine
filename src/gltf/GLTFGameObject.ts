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
  //public materialBindGroupLayout: GPUBindGroupLayout;


  public get gltfScene(): any {
    return this._gltfScene;
  }

  public skinMode = 0; // 0=skinned, 1=non-skinned
  constructor(
    private device: GPUDevice,
    private camera: Camera,
    private shadowCamera: ShadowCamera,
    private ambientLight: AmbientLight,
    private directionalLight: DirectionalLight,
    private pointLights: PointLightsCollection,
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
    });

    // // Add this after your other bind group layouts
    // this.materialBindGroupLayout = device.createBindGroupLayout({
    //   label: "Material.bindGroupLayout",
    //   entries: [
    //     {
    //       binding: 0,
    //       visibility: GPUShaderStage.FRAGMENT,
    //       texture: {},
    //     },
    //     {
    //       binding: 1,
    //       visibility: GPUShaderStage.FRAGMENT,
    //       sampler: {},
    //     },
    //   ],
    // });
  }

  public update(deltaTime: number, now: number) {
    if (!this._gltfScene) return;

    // --- BEGIN: Animation playback ---
    if (this.animationPlayer) {
      this.animationPlayer.update(deltaTime);
    }
    else{
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
    // Set skin_mode and render_mode
    this.device.queue.writeBuffer(this.generalUniformsBuffer, 0, new Uint32Array([0, this.skinMode]));
  }

  public draw(renderPassEncoder: GPURenderPassEncoder) {
    for (const scene of this._gltfScene.scenes) {
      scene.root.renderDrawables(renderPassEncoder, [this.cameraBindGroup, this.generalUniformsBindGroup]);
    }
  }

  public async initialize(assetLocation: string) {
    this._gltfScene = await fetch(assetLocation)
      .then((res) => res.arrayBuffer())
      .then((buffer) => convertGLBToJSONAndBinary(buffer, this.device));

    // Build gltf pipeline with new camera layout (single mat4x4)
    this._gltfScene.meshes.forEach((mesh: GLTFMesh) => {
      if (this.skinMode === 0) {
        mesh.buildRenderPipeline(this.device, gltfRigidWGSL, gltfRigidWGSL, this.presentationFormat, this.depthTexture.format, [this.cameraBGCluster, this.generalUniformsBGCLuster, this.nodeUniformsBindGroupLayout]);
      } else {
        mesh.buildRenderPipeline(this.device, gltfSkinnedWGSL, gltfSkinnedWGSL, this.presentationFormat, this.depthTexture.format, [this.cameraBGCluster, this.generalUniformsBGCLuster, this.nodeUniformsBindGroupLayout, GLTFSkin.skinBindGroupLayout]);
      }
    });
  }
}
