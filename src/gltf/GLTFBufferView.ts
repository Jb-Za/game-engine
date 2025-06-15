import { alignTo } from "./GLTFUtils";
import { BufferView } from "./Interfaces";
import { GLTFBuffer } from "./GLTFBuffer";

export class GLTFBufferView {
  byteLength: number;
  byteStride: number;
  view: Uint8Array;
  needsUpload: boolean;
  gpuBuffer: GPUBuffer | undefined;
  usage: number;
  constructor(buffer: GLTFBuffer, view: BufferView) {
    this.byteLength = view['byteLength'];
    this.byteStride = 0;
    if (view['byteStride'] !== undefined) {
      this.byteStride = view['byteStride'];
    }
    // Create the buffer view. Note that subarray creates a new typed
    // view over the same array buffer, we do not make a copy here.
    let viewOffset = 0;
    if (view['byteOffset'] !== undefined) {
      viewOffset = view['byteOffset'];
    }
    // NOTE: This creates a uint8array view into the buffer!
    // When we call .buffer on this view, it will give us back the original array buffer
    // Accordingly, when converting our buffer from a uint8array to a float32array representation
    // we need to apply the byte offset of our view when creating our buffer
    // ie new Float32Array(this.view.buffer, this.view.byteOffset, this.view.byteLength)
    this.view = buffer.buffer.subarray(
      viewOffset,
      viewOffset + this.byteLength
    );

    this.needsUpload = false;
    this.gpuBuffer = undefined;
    this.usage = 0;
  }

  addUsage(usage: number) {
    this.usage = this.usage | usage;
  }

  upload(device: GPUDevice) {
    // Note: must align to 4 byte size when mapped at creation is true
    const buf: GPUBuffer = device.createBuffer({
      size: alignTo(this.view.byteLength, 4),
      usage: this.usage,
      mappedAtCreation: true,
    });
    new Uint8Array(buf.getMappedRange()).set(this.view);
    buf.unmap();
    this.gpuBuffer = buf;
    this.needsUpload = false;
  }
}