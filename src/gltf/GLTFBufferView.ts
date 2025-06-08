import { GLTFBuffer } from "./GLTFBuffer";

export class GLTFBufferView {
    public view: Uint8Array; //TODO: do these need to be public?
    public length: any;
    public byteStride: number;
    public needsUpload: boolean;
    public gpuBuffer: GPUBuffer | null;
    public usage: number;
    constructor(buffer: GLTFBuffer, view: any) {
        this.length = view["byteLength"];
        this.byteStride = 0;
        if (view["byteStride"] !== undefined) {
            this.byteStride = view["byteStride"];
        }

        // Create the buffer view. Note that subarray creates a new typed
        // view over the same array buffer, we do not make a copy here.
        var viewOffset = 0;
        if (view["byteOffset"] !== undefined) {
            viewOffset = view["byteOffset"];
        }
        this.view = buffer.buffer.subarray(viewOffset, viewOffset + this.length);

        this.needsUpload = false;
        this.gpuBuffer = null;
        this.usage = 0;
    }

    // When this buffer is referenced as vertex data or index data we
    // add the corresponding usage flag here so that the GPU buffer can
    // be created properly.
    addUsage(usage: number) {
        this.usage = this.usage | usage;
    }

    // Upload the buffer view to a GPU buffer
    upload(device: GPUDevice) {
        // Note: must align to 4 byte size when mapped at creation is true
        var buf = device.createBuffer({
            size: this.alignTo(this.view.byteLength, 4),
            usage: this.usage,
            mappedAtCreation: true
        });
        //@ts-ignore
        new (this.view.constructor)(buf.getMappedRange()).set(this.view);
        buf.unmap();
        this.gpuBuffer = buf;
        this.needsUpload = false;
    }

    private alignTo(val: number, align: number) {
        return Math.floor((val + align - 1) / align) * align;
    }
}