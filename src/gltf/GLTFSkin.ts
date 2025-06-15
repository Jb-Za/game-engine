import { Mat4x4 } from "../math/Mat4x4";
import { GLTFAccessor } from "./GLTFAccessor";
import { GLTFNode } from "./GLTFNode";
import { GLTFDataComponentType } from "./Interfaces.ts";

export class GLTFSkin {
  // Nodes of the skin's joints
  // [5, 2, 3] means our joint info is at nodes 5, 2, and 3
  joints: number[];
  // Bind Group for this skin's uniform buffer
  skinBindGroup: GPUBindGroup;
  // Static bindGroupLayout shared across all skins
  // In a larger shader with more properties, certain bind groups
  // would likely have to be combined due to device limitations in the number of bind groups
  // allowed within a shader
  // Inverse bind matrices parsed from the accessor
  private inverseBindMatrices: Float32Array;
  private jointMatricesUniformBuffer: GPUBuffer;
  private inverseBindMatricesUniformBuffer: GPUBuffer;
  static skinBindGroupLayout: GPUBindGroupLayout;

  static createSharedBindGroupLayout(device: GPUDevice) {
    this.skinBindGroupLayout = device.createBindGroupLayout({
      label: 'StaticGLTFSkin.bindGroupLayout',
      entries: [
        // Holds the initial joint matrices buffer
        {
          binding: 0,
          buffer: {
            type: 'read-only-storage',
          },
          visibility: GPUShaderStage.VERTEX,
        },
        // Holds the inverse bind matrices buffer
        {
          binding: 1,
          buffer: {
            type: 'read-only-storage',
          },
          visibility: GPUShaderStage.VERTEX,
        },
      ],
    });
  }

  // For the sake of simplicity and easier debugging, we're going to convert our skin gpu accessor to a
  // float32array, which should be performant enough for this example since there is only one skin (again, this)
  // is not a comprehensive gltf parser
  constructor(
    device: GPUDevice,
    inverseBindMatricesAccessor: GLTFAccessor,
    joints: number[]
  ) {
    if (
      inverseBindMatricesAccessor.componentType !==
        GLTFDataComponentType.FLOAT ||
      inverseBindMatricesAccessor.byteStride !== 64
    ) {
      throw Error(
        `This skin's provided accessor does not access a mat4x4f matrix, or does not access the provided mat4x4f data correctly`
      );
    }
    // NOTE: Come back to this uint8array to float32array conversion in case it is incorrect
    this.inverseBindMatrices = new Float32Array(
      inverseBindMatricesAccessor.view.view.buffer,
      inverseBindMatricesAccessor.view.view.byteOffset,
      inverseBindMatricesAccessor.view.view.byteLength / 4
    );
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
      label: 'StaticGLTFSkin.bindGroup',
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.jointMatricesUniformBuffer,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: this.inverseBindMatricesUniformBuffer,
          },
        },
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