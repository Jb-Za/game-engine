import { gltfElementSize, gltfVertexType, parseGltfDataStructureType } from "./GLTFUtils.ts";
import { GLTFBufferView } from "./GLTFBufferView";
import { GLTFDataComponentType, GLTFDataStructureType, Accessor } from "./Interfaces.ts";

export class GLTFAccessor {
  count: number;
  componentType: GLTFDataComponentType;
  structureType: GLTFDataStructureType;
  view: GLTFBufferView;
  byteOffset: number;
  constructor(view: GLTFBufferView, accessor: Accessor) {
    this.count = accessor['count'];
    this.componentType = accessor['componentType'];
    this.structureType = parseGltfDataStructureType(accessor['type']);
    this.view = view;
    this.byteOffset = 0;
    if (accessor['byteOffset'] !== undefined) {
      this.byteOffset = accessor['byteOffset'];
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
    const componentsPerElement = (() => {
      switch (this.structureType) {
        case GLTFDataStructureType.SCALAR: return 1;
        case GLTFDataStructureType.VEC2: return 2;
        case GLTFDataStructureType.VEC3: return 3;
        case GLTFDataStructureType.VEC4: return 4;
        case GLTFDataStructureType.MAT2: return 4;
        case GLTFDataStructureType.MAT3: return 9;
        case GLTFDataStructureType.MAT4: return 16;
        default: throw new Error(`Unknown structure type: ${this.structureType}`);
      }
    })();
    
    // If already float data, just create a view into the buffer
    if (this.componentType === GLTFDataComponentType.FLOAT) {
      return new Float32Array(
        this.view.view.buffer,
        this.view.view.byteOffset + this.byteOffset,
        this.count * componentsPerElement
      );
    }
    
    // Otherwise, need to convert the data
    const result = new Float32Array(this.count * componentsPerElement);
    
    // Get a view of the appropriate type for the source data
    let sourceView;
    switch (this.componentType) {
      case GLTFDataComponentType.BYTE:
        sourceView = new Int8Array(
          this.view.view.buffer,
          this.view.view.byteOffset + this.byteOffset,
          this.count * componentsPerElement
        );
        break;
      case GLTFDataComponentType.UNSIGNED_BYTE:
        sourceView = new Uint8Array(
          this.view.view.buffer,
          this.view.view.byteOffset + this.byteOffset,
          this.count * componentsPerElement
        );
        break;
      case GLTFDataComponentType.SHORT:
        sourceView = new Int16Array(
          this.view.view.buffer,
          this.view.view.byteOffset + this.byteOffset,
          this.count * componentsPerElement
        );
        break;
      case GLTFDataComponentType.UNSIGNED_SHORT:
        sourceView = new Uint16Array(
          this.view.view.buffer,
          this.view.view.byteOffset + this.byteOffset,
          this.count * componentsPerElement
        );
        break;
      case GLTFDataComponentType.INT:
        sourceView = new Int32Array(
          this.view.view.buffer,
          this.view.view.byteOffset + this.byteOffset,
          this.count * componentsPerElement
        );
        break;
      case GLTFDataComponentType.UNSIGNED_INT:
        sourceView = new Uint32Array(
          this.view.view.buffer,
          this.view.view.byteOffset + this.byteOffset,
          this.count * componentsPerElement
        );
        break;
      default:
        throw new Error(`Unsupported component type: ${this.componentType}`);
    }
    
    // Convert to float values
    for (let i = 0; i < sourceView.length; i++) {
      result[i] = Number(sourceView[i]);
    }
    
    return result;
  }
}