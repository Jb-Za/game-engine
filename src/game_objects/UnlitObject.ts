import { Camera } from "../camera/Camera";
import { GeometryBuffersCollection } from "../attribute_buffers/GeometryBuffersCollection";
import { Color } from "../math/Color";
import { Mat4x4 } from "../math/Mat4x4";
import { Vec3 } from "../math/Vec3";
import { Vec2 } from "../math/Vec2";
import { Quaternion } from "../math/Quaternion";
import { UniformBuffer } from "../uniform_buffers/UniformBuffer";
import { UnlitRenderPipeline } from "../render_pipelines/UnlitRenderPipeline";
import { Texture2D } from "../texture/Texture2D";

export class UnlitObject {
    public scale = new Vec3(1, 1, 1);
    public position = new Vec3(0, 0, 0);
    public rotation = new Quaternion();
    public color = new Color(1, 1, 1, 1);
    
    private pipeline: UnlitRenderPipeline;
    private transformBuffer: UniformBuffer;
    private transform = Mat4x4.identity();
    private geometryType: 'sphere' | 'cube';

    constructor(
        device: GPUDevice, 
        camera: Camera, 
        geometryType: 'sphere' | 'cube' = 'cube',
        diffuseTexture?: Texture2D
    ) {
        this.geometryType = geometryType;
        this.transformBuffer = new UniformBuffer(device, this.transform, "Unlit Object Transform");
        this.pipeline = new UnlitRenderPipeline(device, camera, this.transformBuffer);
        
        // Set default texture if none provided
        if (diffuseTexture) {
            this.pipeline.diffuseTexture = diffuseTexture;
        }
        
        // Set default properties
        this.pipeline.diffuseColor = this.color;
        this.pipeline.textureTiling = new Vec2(1, 1);
    }

    public setTexture(texture: Texture2D): void {
        this.pipeline.diffuseTexture = texture;
    }

    public setTextureTiling(tiling: Vec2): void {
        this.pipeline.textureTiling = tiling;
    }

    public update(): void {
        // Create transformation matrix from position, rotation and scale
        const translationMatrix = Mat4x4.translation(this.position.x, this.position.y, this.position.z);
        const rotationMatrix = this.rotation.toMatrix();
        const scaleMatrix = Mat4x4.scale(this.scale.x, this.scale.y, this.scale.z);
        
        // Combine transforms: Translation * Rotation * Scale
        this.transform = Mat4x4.multiply(translationMatrix, Mat4x4.multiply(rotationMatrix, scaleMatrix));
        this.transformBuffer.update(this.transform);
        
        // Update color
        this.pipeline.diffuseColor = this.color;
    }

    public draw(renderPassEncoder: GPURenderPassEncoder): void {
        const buffers = this.geometryType === 'sphere' 
            ? GeometryBuffersCollection.sphereBuffers 
            : GeometryBuffersCollection.cubeBuffers;
            
        this.pipeline.draw(renderPassEncoder, buffers);
    }

    // Dummy methods to satisfy GameObject interface
    public drawShadows(_renderPassEncoder: GPURenderPassEncoder): void {
        // Unlit objects don't cast shadows in this simple implementation
    }
}