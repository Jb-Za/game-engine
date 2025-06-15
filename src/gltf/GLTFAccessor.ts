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

  
}