import { GLTFBufferView } from "./GLTFBufferView";
import { GTLFUtils } from "./GTLFUtils";

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
  private view: GLTFBufferView;
  private byteOffset: number;

  constructor(view: GLTFBufferView, accessor: Accessor) {
    this.count = accessor["count"];
    this.componentType = accessor["componentType"];
    this.gltfType = GTLFUtils.parseGltfType(accessor["type"]);
    this.view = view;
    this.byteOffset = 0;
    if (accessor["byteOffset"] !== undefined) {
      this.byteOffset = accessor["byteOffset"];
    }
  }

  get byteStride() {
    var elementSize = GTLFUtils.gltfTypeSize(this.componentType, this.gltfType);
    return Math.max(elementSize, this.view.byteStride);
  }

  get byteLength() {
    return this.count * this.byteStride;
  }

  // Get the vertex attribute type for accessors that are
  // used as vertex attributes
  get vertexType() {
    return GTLFUtils.gltfVertexType(this.componentType, this.gltfType);
  }


}
