import { Mat4x4 } from "../math/Mat4x4";
import { Vec2 } from "../math/Vec2";
import { Color } from "../math/Color";

export class UniformBuffer 
{
    public readonly buffer: GPUBuffer;   

    constructor(private device: GPUDevice, dataOrLength: Float32Array | number | Vec2 | Color | any, label: string = "Uniform Buffer")
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
            // Convert data to Float32Array first
            const arrayData = this.convertToFloat32Array(dataOrLength);
            this.buffer = device.createBuffer({
                label: label,
                size: arrayData.byteLength,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });
            this.update(arrayData);
        }
    }

    private convertToFloat32Array(data: any): Float32Array {
        if (data instanceof Float32Array) {
            return data;
        } else if (typeof data === 'number') {
            return new Float32Array([data]);
        } else if (data instanceof Vec2) {
            return new Float32Array([data.x, data.y]);
        } else if (data instanceof Color) {
            return new Float32Array([data.r, data.g, data.b, data.a]);
        } else if (Array.isArray(data)) {
            return new Float32Array(data);
        } else {
            // Fallback for other objects, try to extract numeric properties
            const values: number[] = [];
            for (const key in data) {
                if (typeof data[key] === 'number') {
                    values.push(data[key]);
                }
            }
            return new Float32Array(values);
        }
    }

    public update(data: Float32Array | number | Vec2 | Color | any, bufferOffset: number = 0)
    {
        const arrayData = this.convertToFloat32Array(data);
        this.device.queue.writeBuffer(this.buffer, bufferOffset, arrayData.buffer);
    }

    
    public updateFace(matrix: Mat4x4, faceIndex: number) {
        const offset = faceIndex * 16 * Float32Array.BYTES_PER_ELEMENT; // Calculate byte offset for the face

        // Convert matrix to Float32Array in column-major order if needed (if not already in column-major)
        const matrixData = Mat4x4.toFloat32Array(matrix); // Assuming this method returns a column-major Float32 array

        // Upload the matrix to the appropriate location in the buffer
        this.device.queue.writeBuffer(this.buffer, offset, matrixData);
    }
}