import { GLTFBufferView } from "./GLTFBufferView";
import { GLTFUtils } from "./GLTFUtils";

export interface Accessor {
  count: number;
  componentType: number;
  type: string;
  byteOffset?: number;
}

export class GLTFAccessor {
  private componentType: any;
  private count: number;
  private gltfType: any;
  public byteOffset: number;
  public view: GLTFBufferView;

  constructor(view: GLTFBufferView, accessor: Accessor) {
    this.count = accessor["count"];
    this.componentType = accessor["componentType"];
    this.gltfType = GLTFUtils.parseGltfType(accessor["type"]);
    this.view = view;
    this.byteOffset = 0;
    if (accessor["byteOffset"] !== undefined) {
      this.byteOffset = accessor["byteOffset"];
    }
  }

  get byteStride() {
    var elementSize = GLTFUtils.gltfTypeSize(this.componentType, this.gltfType);
    return Math.max(elementSize, this.view.byteStride);
  }

  get byteLength() {
    return this.count * this.byteStride;
  }

  // Get the vertex attribute type for accessors that are
  // used as vertex attributes
  get vertexType() {
    return GLTFUtils.gltfVertexType(this.componentType, this.gltfType);
  }

  getArray(): Float32Array | Uint16Array | Int16Array | Uint32Array | Int32Array | Int8Array | Uint8Array {
    const buffer = this.view.view.buffer;
    const byteOffset = this.view.view.byteOffset + (this.byteOffset || 0);
    const numComponents = GLTFUtils.gltfTypeNumComponents(this.gltfType);
    const length = this.count * numComponents;
    switch (this.componentType) {
      case 5126: // FLOAT
        return new Float32Array(buffer, byteOffset, length);
      case 5123: // UNSIGNED_SHORT
        return new Uint16Array(buffer, byteOffset, length);
      case 5122: // SHORT
        return new Int16Array(buffer, byteOffset, length);
      case 5125: // UNSIGNED_INT
        return new Uint32Array(buffer, byteOffset, length);
      case 5124: // INT
        return new Int32Array(buffer, byteOffset, length);
      case 5120: // BYTE
        return new Int8Array(buffer, byteOffset, length);
      case 5121: // UNSIGNED_BYTE
        return new Uint8Array(buffer, byteOffset, length);
      default:
        throw new Error("Unsupported componentType: " + this.componentType);
    }
  }

}
