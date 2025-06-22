import { Mat4x4 } from "../math/Mat4x4";
import { Vec3 } from "../math/Vec3";
import { Vec4 } from "../math/Vec4";
import { BaseTransformation } from "./BaseTransformation";
import { GLTFMesh } from "./GLTFMesh";
import { GLTFSkin } from "./GLTFSkin";

//most of this implementation is based on the gltf-skinning example from the webgpu samples repo
//https://webgpu.github.io/webgpu-samples/.
// I have adapted it to fit my project with an attempt to build upon its features

export class GLTFNode {
  name: string;
  source: BaseTransformation;
  parent: GLTFNode | null;
  children: GLTFNode[];
  localMatrix: Mat4x4;
  worldMatrix: Mat4x4;
  drawables: GLTFMesh[];
  test = 0;
  skin?: GLTFSkin;
  private nodeTransformGPUBuffer: GPUBuffer;
  private nodeTransformBindGroup: GPUBindGroup;
  public _animState?: any;

  constructor(device: GPUDevice, bgLayout: GPUBindGroupLayout, source: BaseTransformation, name?: string, skin?: GLTFSkin) {
    this.name = name ? name : `node_${source.position} ${source.rotation} ${source.scale}`;
    this.source = source;
    this.parent = null;
    this.children = [];
    this.localMatrix = Mat4x4.identity();
    this.worldMatrix = Mat4x4.identity();
    this.drawables = [];
    this.nodeTransformGPUBuffer = device.createBuffer({
      size: Mat4x4.BYTE_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.nodeTransformBindGroup = device.createBindGroup({
      layout: bgLayout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.nodeTransformGPUBuffer,
          },
        },
      ],
    });
    this.skin = skin;
  }

  setParent(parent: GLTFNode) {
    if (this.parent) {
      this.parent.removeChild(this);
      this.parent = null;
    }
    parent.addChild(this);
    this.parent = parent;
  }

  updateWorldMatrix(device: GPUDevice, parentWorldMatrix?: Mat4x4) {
    this.localMatrix = this.source.getMatrix();
    if (parentWorldMatrix) {
      this.worldMatrix = Mat4x4.multiply(parentWorldMatrix, this.localMatrix);
    } else {
      this.worldMatrix = Mat4x4.identity();
      for (let i = 0; i < 16; ++i) this.worldMatrix[i] = this.localMatrix[i];
    }
    const worldMatrix = this.worldMatrix;
    device.queue.writeBuffer(this.nodeTransformGPUBuffer, 0, worldMatrix.buffer, worldMatrix.byteOffset, worldMatrix.byteLength);
    for (const child of this.children) {
      child.updateWorldMatrix(device, worldMatrix);
    }
  }

  traverse(fn: (n: GLTFNode, ...args: any[]) => void) {
    fn(this);
    for (const child of this.children) {
      child.traverse(fn);
    }
  }

  renderDrawables(passEncoder: GPURenderPassEncoder, bindGroups: GPUBindGroup[], materialBindGroups?: GPUBindGroup[]) {
    if (this.drawables !== undefined) {
      for (const drawable of this.drawables) {
        if (this.skin) {
          drawable.render(passEncoder, [...bindGroups, this.nodeTransformBindGroup, this.skin.skinBindGroup], materialBindGroups);
        } else {
          drawable.render(passEncoder, [...bindGroups, this.nodeTransformBindGroup], materialBindGroups);
        }
      }
    }
    // Render any of its children
    for (const child of this.children) {
      child.renderDrawables(passEncoder, bindGroups, materialBindGroups);
    }
  }

  private addChild(child: GLTFNode) {
    this.children.push(child);
  }

  private removeChild(child: GLTFNode) {
    const ndx = this.children.indexOf(child);
    this.children.splice(ndx, 1);
  }
}
