import { Geometry } from "../geometry/Geometry";

export class GLTFBuffers
{
    public readonly positionsBuffer: GPUBuffer;
    public readonly indicesBuffer?: GPUBuffer;
    public readonly colorsBuffer: GPUBuffer;
    public readonly texCoordsBuffer: GPUBuffer;
    public readonly normalsBuffer: GPUBuffer;

    public readonly vertexCount: number;
    public readonly indexCount?: number;

    constructor(device: GPUDevice, geometry: Geometry) 
    {

        // Convert the view object to a Uint16Array
        let data = geometry.positions.view;
        let buffer = new ArrayBuffer(data.view.length);
        let view = new Uint8Array(buffer);

        let byteOffset = data.byteOffset;
        let gltfType = data.gltfType;
        
        Object.keys(data.view).forEach(key => {
            view[parseInt(key)] = data.view[key];
        });

        // POSITIONS
        this.positionsBuffer = device.createBuffer({
            label: "Positions Buffer",
            size: view.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST 
        });

        device.queue.writeBuffer(this.positionsBuffer, 0, view.buffer, byteOffset, view.byteLength);

        this.vertexCount = data.length / 3; // (xyz)
        
        
        
        
        
        
        
        
        //... ignore below
        // INDICES
        if (geometry.indices.view.length > 0) 
        {
            data = geometry.indices.view;
            buffer = new ArrayBuffer(data.view.length);
            view = new Uint8Array(buffer);
            byteOffset = data.byteOffset;
            Object.keys(data.view).forEach(key => {
                view[parseInt(key)] = data.view[key];
            });
    
            this.indicesBuffer = device.createBuffer({
                size: view.byteLength,
                usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
            });
    
            device.queue.writeBuffer(this.indicesBuffer, 0, view.buffer, byteOffset, view.byteLength);
            

            this.indexCount = geometry.indices.view.length / 2;
        }
    
        // COLORS
        this.colorsBuffer = device.createBuffer({
            label: "Colors Buffer",
            size: geometry.colors.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });

        device.queue.writeBuffer(this.colorsBuffer,
            0,
            geometry.colors.buffer,
            0,
            geometry.colors.byteLength);

        // TEXCOORDS
        this.texCoordsBuffer = device.createBuffer({
            label: "TexCoords Buffer",
            size: geometry.texCoords.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });

        device.queue.writeBuffer(this.texCoordsBuffer,
            0,
            geometry.texCoords.buffer,
            0,
            geometry.texCoords.byteLength);

        // TEXCOORDS
        this.normalsBuffer = device.createBuffer({
            label: "Normals Buffer",
            size: geometry.normals.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });

        device.queue.writeBuffer(this.normalsBuffer,
            0,
            geometry.normals.buffer,
            0,
            geometry.normals.byteLength);    
    
    }
}