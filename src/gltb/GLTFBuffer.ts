export class GLTFBuffer {
    buffer: Uint8Array;
    constructor(buffer: ArrayBuffer, offset: number, size: number) {
        this.buffer = new Uint8Array(buffer, offset, size);
    }
}