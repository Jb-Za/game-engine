import { gltfElementSize, gltfVertexType, parseGltfDataStructureType } from "./GLTFUtils.ts";
import { GLTFBufferView } from "./GLTFBufferView";
import { GLTFDataComponentType, GLTFDataStructureType, Accessor } from "./Interfaces.ts";

//most of this implementation is based on the gltf-skinning example from the webgpu samples repo
//https://webgpu.github.io/webgpu-samples/.
// I have adapted it to fit my project with an attempt to build upon its features

export class GLTFAccessor {
  count: number;
  componentType: GLTFDataComponentType;
  structureType: GLTFDataStructureType;
  view: GLTFBufferView;
  byteOffset: number;
  constructor(view: GLTFBufferView, accessor: Accessor) {
    this.count = accessor["count"];
    this.componentType = accessor["componentType"];
    this.structureType = parseGltfDataStructureType(accessor["type"]);
    this.view = view;
    this.byteOffset = 0;
    if (accessor["byteOffset"] !== undefined) {
      this.byteOffset = accessor["byteOffset"];
    }
  }

  get byteStride() {
    const elementSize = gltfElementSize(this.componentType, this.structureType);
    return Math.max(elementSize, this.view.byteStride);
  }

  get byteLength() {
    return this.count * this.byteStride;
  }

  // Get the vertex attribute type for accessors that are used as vertex attributes
  get vertexType() {
    return gltfVertexType(this.componentType, this.structureType);
  }
  // Get the data as a Float32Array, converting if necessary
  getFloat32Array(): Float32Array {
    const componentsPerElement = this.getComponentsPerElement();

    // If already float data, just create a view into the buffer
    if (this.componentType === GLTFDataComponentType.FLOAT) {
      return new Float32Array(this.view.view.buffer, this.view.view.byteOffset + this.byteOffset, this.count * componentsPerElement);
    }

    // Otherwise, get the native typed array and convert only if needed
    const sourceView = this.getTypedArray();
    const result = new Float32Array(sourceView.length);
    for (let i = 0; i < sourceView.length; i++) {
      result[i] = Number(sourceView[i]);
    }
    return result;
  }

  // Returns the correct typed array for the accessor's component type
  getTypedArray():
    | Float32Array
    | Int8Array
    | Uint8Array
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array {
    const components = this.getComponentsPerElement();
    const offset = this.view.view.byteOffset + this.byteOffset;
    const length = this.count * components;
    switch (this.componentType) {
      case GLTFDataComponentType.FLOAT:
        return new Float32Array(this.view.view.buffer, offset, length);
      case GLTFDataComponentType.BYTE:
        return new Int8Array(this.view.view.buffer, offset, length);
      case GLTFDataComponentType.UNSIGNED_BYTE:
        return new Uint8Array(this.view.view.buffer, offset, length);
      case GLTFDataComponentType.SHORT:
        return new Int16Array(this.view.view.buffer, offset, length);
      case GLTFDataComponentType.UNSIGNED_SHORT:
        return new Uint16Array(this.view.view.buffer, offset, length);
      case GLTFDataComponentType.INT:
        return new Int32Array(this.view.view.buffer, offset, length);
      case GLTFDataComponentType.UNSIGNED_INT:
        return new Uint32Array(this.view.view.buffer, offset, length);
      default:
        throw new Error(`Unsupported component type: ${this.componentType}`);
    }
  }

  getComponentsPerElement(): number {
    switch (this.structureType) {
      case GLTFDataStructureType.SCALAR:
        return 1;
      case GLTFDataStructureType.VEC2:
        return 2;
      case GLTFDataStructureType.VEC3:
        return 3;
      case GLTFDataStructureType.VEC4:
        return 4;
      case GLTFDataStructureType.MAT2:
        return 4;
      case GLTFDataStructureType.MAT3:
        return 9;
      case GLTFDataStructureType.MAT4:
        return 16;
      default:
        throw new Error(`Unknown structure type: ${this.structureType}`);
    }
  }
}
