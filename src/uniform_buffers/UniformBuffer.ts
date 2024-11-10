import { Mat4x4 } from "../math/Mat4x4";

export class UniformBuffer 
{
    public readonly buffer: GPUBuffer;   

    constructor(private device: GPUDevice, dataOrLength: Float32Array | number, label: string = "Uniform Buffer")
    {

        // if number we assume byteSize
        if(typeof dataOrLength === "number"){
            this.buffer = device.createBuffer({
                label: label,
                size: dataOrLength,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
        }
        else{
            this.buffer = device.createBuffer({
                label: label,
                size: dataOrLength.byteLength,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
            this.update(dataOrLength);
        }
    }

    public update(data: Float32Array, bufferOffset: number = 0)
    {
        this.device.queue.writeBuffer(this.buffer, bufferOffset, data.buffer);
    }

    
    public updateFace(matrix: Mat4x4, faceIndex: number) {
        const offset = faceIndex * 16 * Float32Array.BYTES_PER_ELEMENT; // Calculate byte offset for the face

        // Convert matrix to Float32Array in column-major order if needed (if not already in column-major)
        const matrixData = Mat4x4.toFloat32Array(matrix); // Assuming this method returns a column-major Float32 array

        // Upload the matrix to the appropriate location in the buffer
        this.device.queue.writeBuffer(this.buffer, offset, matrixData);
    }
}