import { Camera } from "../../camera/Camera";
import { GeometryBuffersCollection } from "../../attribute_buffers/GeometryBuffersCollection";
import { Color } from "../../math/Color";
import { Mat4x4 } from "../../math/Mat4x4";
import { Vec3 } from "../../math/Vec3";
import { UniformBuffer } from "../../uniform_buffers/UniformBuffer";
import { Simple2DRenderPipeline } from "../../render_pipelines/Simple2DRenderPipeline";
import { AmbientLight } from "../../lights/AmbientLight";
import { Mat3x3 } from "../../math/Mat3x3";
import { PointLightsCollection } from "../../lights/PointLight";
import { Quaternion } from "../../math/Quaternion";
import { GeometryBuilder } from "../../geometry/GeometryBuilder";
import { GeometryBuffers } from "../../attribute_buffers/GeometryBuffers";

export class Circle2D {
    public pipeline: Simple2DRenderPipeline;
    public scale = new Vec3(1, 1, 1);
    public position = new Vec3(0, 0, 0);
    public color = new Color(1, 0, 0, 1);
    public rotation = new Quaternion();
    public visible: boolean = true;
    public isOutline: boolean;
    
    // Add outline properties
    public outlineThickness: number = 0.05;
    public useConstantLineWidth: boolean = true;
    
    private transformBuffer: UniformBuffer;
    private transform = Mat4x4.identity();
    private normalMatrixBuffer: UniformBuffer;
    private device: GPUDevice;
    private lastScale: Vec3 = new Vec3(1, 1, 1);
    private outlineBuffers: GeometryBuffers | null = null;

    constructor(device: GPUDevice, camera: Camera, ambientLight: AmbientLight, pointLights: PointLightsCollection, isOutline: boolean = false) {
        this.isOutline = isOutline;
        this.device = device;
        this.transformBuffer = new UniformBuffer(device, this.transform, "Circle2D Transform");
        this.normalMatrixBuffer = new UniformBuffer(device, 16 * Float32Array.BYTES_PER_ELEMENT, "Circle2D Normal Matrix");
        
        this.pipeline = new Simple2DRenderPipeline(
            device, 
            camera, 
            this.transformBuffer, 
            this.normalMatrixBuffer, 
            ambientLight, 
            pointLights
        );
        
        if (isOutline) {
            this.updateOutlineGeometry();
        }
    }

    private updateOutlineGeometry(): void {
        if (!this.isOutline) return;
        
        const geometryBuilder = new GeometryBuilder();
        const scaleCompensation = this.useConstantLineWidth ? this.scale.x : 1.0;
        
        const geometry = geometryBuilder.createCircleOutlineGeometry(
            1.0, // Base radius of 1, will be scaled by transform
            32, // Segments
            this.outlineThickness,
            scaleCompensation
        );
        
        // Create new vertex buffers with updated geometry
        if (this.outlineBuffers) {
            // Clean up old buffers if needed
            this.outlineBuffers = null;
        }
        
        this.outlineBuffers = new GeometryBuffers(this.device, geometry);
    }

    public update(): void {
        // Check if scale changed and we need to update outline geometry
        if (this.isOutline && this.useConstantLineWidth && 
            (this.scale.x !== this.lastScale.x || this.scale.y !== this.lastScale.y)) {
            this.updateOutlineGeometry();
            this.lastScale = new Vec3(this.scale.x, this.scale.y, this.scale.z);
        }
        
        const scale = Mat4x4.scale(this.scale.x, this.scale.y, this.scale.z);
        const rotation = this.rotation.toMatrix();
        const translate = Mat4x4.translation(this.position.x, this.position.y, this.position.z);
        
        // Apply transformations in order: Scale -> Rotate -> Translate
        let transform = Mat4x4.multiply(rotation, scale);
        this.transform = Mat4x4.multiply(translate, transform);
        this.transformBuffer.update(this.transform);

        let normalMatrix = Mat3x3.fromMat4x4(this.transform);
        normalMatrix = Mat3x3.transpose(normalMatrix);
        normalMatrix = Mat3x3.inverse(normalMatrix);
        this.normalMatrixBuffer.update(Mat3x3.to16AlignedMat3x3(normalMatrix));
    }    
    
    public draw(renderPassEncoder: GPURenderPassEncoder): void {
        if (!this.visible) return;
        this.pipeline.diffuseColor = this.color;
        
        if (this.isOutline && this.outlineBuffers) {
            // Draw custom outline geometry
            this.pipeline.draw(renderPassEncoder, this.outlineBuffers);
        } else {
            // Draw as filled circle
            this.pipeline.draw(renderPassEncoder, GeometryBuffersCollection.circleBuffers);
        }
    }
}