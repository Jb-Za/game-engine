import { Camera } from "../camera/Camera";
import { ShadowCamera } from "../camera/ShadowCamera";
import { AmbientLight } from "../lights/AmbientLight";
import { DirectionalLight } from "../lights/DirectionalLight";
import { convertGLBToJSONAndBinary } from "./GLTFUtils";

import { GLTFAnimationPlayer } from "./GLTFAnimationPlayer";
import { Vec3 } from "../math/Vec3";
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
  private animationPlayer?: GLTFAnimationPlayer;
  public materialBindGroups: GPUBindGroup[] = [];

  public get gltfScene(): any {
    return this._gltfScene;
  }

  public skinMode = 0; // 0=skinned, 1=non-skinned
  constructor(
    private device: GPUDevice,
    private camera: Camera,
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

    // Default to normal visualization if no materials/textures
    this.device.queue.writeBuffer(this._gltfScene.bindGroupLayouts.generalUniformsBuffer, 0, new Uint32Array([2, this.skinMode]));
  }

  public draw(renderPassEncoder: GPURenderPassEncoder) {
    for (const scene of this._gltfScene.scenes) {
      scene.root.renderDrawables(renderPassEncoder, [this._gltfScene.bindGroupLayouts.cameraBindGroup, this._gltfScene.bindGroupLayouts.generalUniformsBindGroup, this._gltfScene.selectedBindGroup]);
    }
  }  public async initialize(assetLocation: string) {
    try {
      const response = await fetch(assetLocation);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch GLB file from ${assetLocation}: ${response.status} ${response.statusText}`);
      }
      
      const buffer = await response.arrayBuffer();
      
      if (buffer.byteLength === 0) {
        throw new Error(`Empty GLB file from ${assetLocation}`);
      }
      
      console.log(`Successfully loaded GLB file from ${assetLocation}, size: ${buffer.byteLength} bytes`);
      
      this._gltfScene = await convertGLBToJSONAndBinary(
        buffer, 
        this.device, 
        this.camera, 
        this.depthTexture, 
        this.presentationFormat
      );
    } catch (error) {
      console.error(`Error initializing GLTFGameObject with ${assetLocation}:`, error);
      throw error;
    }
  }

  /**
   * Set the render mode for GLTF models
   * @param mode 0: normal visualization, 1: UV visualization (or joints for skinned models),
   *             2: texture mode,
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
    this.device.queue.writeBuffer(this._gltfScene.generalUniformsBuffer, 0, new Uint32Array([mode, this.skinMode]));
  }

  // Add a public method to set the active animation by index
  public setActiveAnimation(idx: number) {
    if (this.animationPlayer) {
      this.animationPlayer.activeAnimation = idx;
    }
  }  // Add a public method to set the active animation by name
  public setActiveAnimationByName(name: string) {
    if (!this.gltfScene || !this.gltfScene.animations) {
      console.warn("Cannot set animation: No animations available for this model");
      return;
    }
    const animPlayer = this.animationPlayer;
    if (!animPlayer) {
      console.warn("Cannot set animation: No animation player available for this model");
      return;
    }
    const idx = this.gltfScene.animations.findIndex((a: any) => a.name === name);
    if (idx >= 0) {
      animPlayer.activeAnimation = idx;
    } else {
      console.warn(`Animation "${name}" not found in this model`);
    }
  }

  /**
   * Set the animation playback speed
   * @param speed Animation speed multiplier (0.0 to 1.0)
   */
  public setAnimationSpeed(speed: number) {
    if (this.animationPlayer) {
      this.animationPlayer.speed = Math.max(0, Math.min(1, speed));
    } else {
      console.warn("Cannot set animation speed: No animation player available for this model");
    }
  }
}

// Add a function to get animation names from a loaded GLTFGameObject
export function getGLTFAnimationNames(gltfGameObject: any): string[] {
  if (!gltfGameObject || !gltfGameObject.gltfScene || !gltfGameObject.gltfScene.animations) return [];
  return gltfGameObject.gltfScene.animations.map((a: any, i: number) => a.name || `Animation ${i}`);
}
