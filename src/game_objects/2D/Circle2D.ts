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

export class Circle2D {
    public pipeline: Simple2DRenderPipeline;
    public scale = new Vec3(1, 1, 1);
    public position = new Vec3(0, 0, 0);
    public color = new Color(1, 0, 0, 1);
    public rotation = new Quaternion();
    public visible: boolean = true;

    private transformBuffer: UniformBuffer;
    private transform = Mat4x4.identity();
    private normalMatrixBuffer: UniformBuffer;

    constructor(device: GPUDevice, camera: Camera, ambientLight: AmbientLight, pointLights: PointLightsCollection) {
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
    }

    public update(){
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
    
    public draw(renderPassEncoder: GPURenderPassEncoder) {
        if (!this.visible) return;
        this.pipeline.diffuseColor = this.color;
        this.pipeline.draw(renderPassEncoder, GeometryBuffersCollection.circleBuffers);
    }
}