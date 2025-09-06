import { Mat4x4 } from "../math/Mat4x4";
import { GLTFAccessor } from "./GLTFAccessor";
import { GLTFNode } from "./GLTFNode";
import { GLTFDataComponentType, GLTFDataStructureType } from "./Interfaces.ts";

//most of this implementation is based on the gltf-skinning example from the webgpu samples repo
//https://webgpu.github.io/webgpu-samples/.
// I have adapted it to fit my project with an attempt to build upon its features

export class GLTFSkin {
  // Nodes of the skin's joints
  // [5, 2, 3] means our joint info is at nodes 5, 2, and 3
  joints: number[];
  // Bind Group for this skin's uniform buffer
  skinBindGroup: GPUBindGroup;  // Static bindGroupLayout shared across all skins
  // In a larger shader with more properties, certain bind groups
  // would likely have to be combined due to device limitations in the number of bind groups
  // allowed within a shader
  // Inverse bind matrices parsed from the accessor
  private inverseBindMatrices: Float32Array;
  public jointMatricesUniformBuffer: GPUBuffer;
  public inverseBindMatricesUniformBuffer: GPUBuffer;
  static skinBindGroupLayout: GPUBindGroupLayout;
  static rigidBindGroupLayout: GPUBindGroupLayout;

  static createSharedBindGroupLayout(device: GPUDevice) {
    this.skinBindGroupLayout = device.createBindGroupLayout({
      label: 'GLTFSkin&Material.bindGroupLayout',
      entries: [
        //  texture
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {},
        },
        // sampler
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {},
        },
        // initial joint matrices buffer
        {
          binding: 2,
          buffer: {
            type: 'read-only-storage',
          },
          visibility: GPUShaderStage.VERTEX,
        },
        // inverse bind matrices buffer
        {
          binding: 3,
          buffer: {
            type: 'read-only-storage',
          },
          visibility: GPUShaderStage.VERTEX,
        },
      ],
    });
  }

  constructor(
    device: GPUDevice,
    inverseBindMatricesAccessor: GLTFAccessor,
    joints: number[],
    baseColorTexture: any,
    baseColorSampler: any,
  ) {
    // Verify it's a matrix type and float component type
    if (inverseBindMatricesAccessor.structureType !== GLTFDataStructureType.MAT4) {
      throw Error("Inverse bind matrices must be of type MAT4");
    }
    if (inverseBindMatricesAccessor.componentType !== GLTFDataComponentType.FLOAT) {
      throw Error("Inverse bind matrices must have FLOAT component type");
    }
    // Use the accessor's getTypedArray to get the correct type
    const matrixArray = inverseBindMatricesAccessor.getTypedArray();
    if (!(matrixArray instanceof Float32Array)) {
      throw new Error("Inverse bind matrices must be stored as float32 in GLTF (per spec)");
    }
    // JOINTS
    this.inverseBindMatrices = matrixArray;
    this.joints = joints;
    const skinGPUBufferUsage: GPUBufferDescriptor = {
      size: Float32Array.BYTES_PER_ELEMENT * 16 * joints.length,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    };
    this.jointMatricesUniformBuffer = device.createBuffer(skinGPUBufferUsage);
    this.inverseBindMatricesUniformBuffer =
      device.createBuffer(skinGPUBufferUsage);
    device.queue.writeBuffer(
      this.inverseBindMatricesUniformBuffer,
      0,
      this.inverseBindMatrices
    );
    this.skinBindGroup = device.createBindGroup({
      layout: GLTFSkin.skinBindGroupLayout,
      label: 'GLTFSkin&Material.bindGroup',
      entries: [
        {
          binding: 0,
          resource: baseColorTexture.createView(),
        },
        {
          binding: 1,
          resource: baseColorSampler,
        },
          // Skin data
        {
          binding: 2,
          resource: {
            buffer: this.jointMatricesUniformBuffer,
          },
        },
        {
          binding: 3,
          resource: {
            buffer: this.inverseBindMatricesUniformBuffer,
          },
        }
      ],
    });
  }

  update(device: GPUDevice, currentNodeIndex: number, nodes: GLTFNode[]) {
    // Get the inverse of the root node's world matrix - needed to transform joints into model space
    const globalWorldInverse = Mat4x4.inverse(nodes[currentNodeIndex].worldMatrix);
    
    for (let j = 0; j < this.joints.length; j++) {
      const joint = this.joints[j];
      // Calculate joint matrix in model space
      const jointMatrix = Mat4x4.multiply(globalWorldInverse, nodes[joint].worldMatrix);
      
      // Write the joint matrix to the GPU buffer
      device.queue.writeBuffer(
        this.jointMatricesUniformBuffer,
        j * 64,
        jointMatrix.buffer,
        jointMatrix.byteOffset,
        jointMatrix.byteLength
      );
    }
  }
}