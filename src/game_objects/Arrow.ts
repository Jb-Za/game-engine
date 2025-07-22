import { GameObject } from "./ObjectMap";
import { GeometryBuffersCollection } from "../attribute_buffers/GeometryBuffersCollection";
import { Color } from "../math/Color";
import { Mat4x4 } from "../math/Mat4x4";
import { Vec3 } from "../math/Vec3";
import { UniformBuffer } from "../uniform_buffers/UniformBuffer";
import { RenderPipeline } from "../render_pipelines/RenderPipeline";
import { AmbientLight } from "../lights/AmbientLight";
import { DirectionalLight } from "../lights/DirectionalLight";
import { Mat3x3 } from "../math/Mat3x3";
import { PointLightsCollection } from "../lights/PointLight";
import { ShadowRenderPipeline } from "../render_pipelines/ShadowRenderPipeline";
import { ShadowCamera } from "../camera/ShadowCamera";
import { RectCollider } from "../collider/RectCollider";
import { Camera } from "../camera/Camera";
import { Quaternion } from "../math/Quaternion";

export class Arrow implements GameObject {
    public scale = new Vec3(0.5, 0.5, 0.5); // Cylindrical shape: thin width/height, long length
    public position = new Vec3(0, 0, 0);
    public rotation = new Quaternion(); // Arrow points in Y direction by default (up)
    public pipeline: RenderPipeline;
    public color = new Color(1, 0.2, 0.2, 1); // Red arrow color
    public collider = new RectCollider();
    public direction = new Vec3(0, 0, 1); // Default direction along Z axis

    private shadowPipeline: ShadowRenderPipeline;
    private transformBuffer: UniformBuffer;
    private transform = Mat4x4.identity();
    private normalMatrixBuffer: UniformBuffer;

    constructor(device: GPUDevice, camera: Camera, shadowCamera: ShadowCamera, ambientLight: AmbientLight, directionalLight: DirectionalLight, pointLights: PointLightsCollection) {
        this.transformBuffer = new UniformBuffer(device, this.transform, "Arrow Transform");
        this.normalMatrixBuffer = new UniformBuffer(device, 16 * Float32Array.BYTES_PER_ELEMENT, "Arrow Normal Matrix");
        this.pipeline = new RenderPipeline(device, camera, shadowCamera, this.transformBuffer, this.normalMatrixBuffer, ambientLight, directionalLight, pointLights);
        this.shadowPipeline = new ShadowRenderPipeline(device, shadowCamera, this.transformBuffer);
    }

    public update(): void {
        // Create transformation matrix with rotation based on quaternion
        const scale = Mat4x4.scale(this.scale.x, this.scale.y, this.scale.z);
        const rotationMatrix = Mat4x4.fromQuaternion(this.rotation);
        const translate = Mat4x4.translation(this.position.x, this.position.y, this.position.z);
        // Apply transformations: translate * rotate * scale
        this.transform = Mat4x4.multiply(Mat4x4.multiply(translate, rotationMatrix), scale);
        this.transformBuffer.update(this.transform);
        // Update normal matrix
        let normalMatrix = Mat3x3.fromMat4x4(this.transform);
        normalMatrix = Mat3x3.transpose(normalMatrix);
        normalMatrix = Mat3x3.inverse(normalMatrix);
        this.normalMatrixBuffer.update(Mat3x3.to16AlignedMat3x3(normalMatrix));
    }

    public draw(renderPassEncoder: GPURenderPassEncoder): void {
        this.pipeline.diffuseColor = this.color;
        this.pipeline.draw(renderPassEncoder, GeometryBuffersCollection.arrowBuffers);
    }

    public drawShadows(renderPassEncoder: GPURenderPassEncoder): void {
        this.shadowPipeline.draw(renderPassEncoder, GeometryBuffersCollection.arrowBuffers);
    }

    /**
     * Sets the arrow's rotation so its Y axis points in the given direction.
     * @param direction The target direction vector.
     */
    public setDirection(direction: Vec3): void {
        // Compute quaternion that rotates (0,1,0) to direction
        const up = new Vec3(0, 1, 0);
        const dir = Vec3.normalize(direction);
        const dot = Vec3.dot(up, dir);
        if (dot > 0.9999) {
            this.rotation = new Quaternion(); // No rotation needed
        } else if (dot < -0.9999) {
            // 180 degree rotation around any perpendicular axis
            this.rotation = Quaternion.fromAxisAngle(new Vec3(1, 0, 0), Math.PI);
        } else {
            const axis = Vec3.normalize(Vec3.cross(up, dir));
            const angle = Math.acos(dot);
            this.rotation = Quaternion.fromAxisAngle(axis, angle);
        }
    }
}
