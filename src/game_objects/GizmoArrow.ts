import { GameObject } from "./ObjectMap";
import { GeometryBuffersCollection } from "../attribute_buffers/GeometryBuffersCollection";
import { Color } from "../math/Color";
import { Mat4x4 } from "../math/Mat4x4";
import { Vec3 } from "../math/Vec3";
import { UniformBuffer } from "../uniform_buffers/UniformBuffer";
import { Mat3x3 } from "../math/Mat3x3";
import { ShadowRenderPipeline } from "../render_pipelines/ShadowRenderPipeline";
import { ShadowCamera } from "../camera/ShadowCamera";
import { RectCollider } from "../collider/RectCollider";
import { Camera } from "../camera/Camera";
import { Quaternion } from "../math/Quaternion";
import { GizmoRenderPipeline } from "../render_pipelines/GizmoRenderPipeline";

export class GizmoArrow implements GameObject {
    public scale = new Vec3(0.5, 0.5, 0.5);
    public position = new Vec3(0, 0, 0);
    public rotation = new Quaternion();
    public pipeline: GizmoRenderPipeline;
    public color = new Color(1, 0.2, 0.2, 1);
    public collider = new RectCollider();
    public direction = new Vec3(0, 0, 1);
    public visible: boolean = true;

    private shadowPipeline: ShadowRenderPipeline;
    private transformBuffer: UniformBuffer;
    private transform = Mat4x4.identity();    private normalMatrixBuffer: UniformBuffer;
    private camera: Camera;

    constructor(
        device: GPUDevice,
        camera: Camera,
        shadowCamera: ShadowCamera
    ) {
        this.camera = camera;
        this.transformBuffer = new UniformBuffer(device, this.transform, "GizmoArrow Transform");
        this.normalMatrixBuffer = new UniformBuffer(device, 16 * Float32Array.BYTES_PER_ELEMENT, "GizmoArrow Normal Matrix");
          // Use the simplified GizmoRenderPipeline for always-visible rendering
        this.pipeline = new GizmoRenderPipeline(
            device, 
            this.transformBuffer
        );
        
        this.shadowPipeline = new ShadowRenderPipeline(device, shadowCamera, this.transformBuffer);
    }    public update(): void {
        const scale = Mat4x4.scale(this.scale.x, this.scale.y, this.scale.z);
        const rotationMatrix = Mat4x4.fromQuaternion(this.rotation);
        const translate = Mat4x4.translation(this.position.x, this.position.y, this.position.z);
        const modelMatrix = Mat4x4.multiply(Mat4x4.multiply(translate, rotationMatrix), scale);
        
        // Calculate MVP matrix by combining camera's projection and view matrices with model matrix
        const projectionView = Mat4x4.multiply(this.camera.projection, this.camera.view);
        const mvpMatrix = Mat4x4.multiply(projectionView, modelMatrix);
        this.transformBuffer.update(mvpMatrix);

        let normalMatrix = Mat3x3.fromMat4x4(modelMatrix);
        normalMatrix = Mat3x3.transpose(normalMatrix);
        normalMatrix = Mat3x3.inverse(normalMatrix);
        this.normalMatrixBuffer.update(Mat3x3.to16AlignedMat3x3(normalMatrix));
    }

    public draw(renderPassEncoder: GPURenderPassEncoder): void {
        if (!this.visible) return;
        this.pipeline.diffuseColor = this.color;
        this.pipeline.draw(renderPassEncoder, GeometryBuffersCollection.arrowBuffers);
    }

    public drawShadows(renderPassEncoder: GPURenderPassEncoder): void {
        if (!this.visible) return;
        this.shadowPipeline.draw(renderPassEncoder, GeometryBuffersCollection.arrowBuffers);
    }

    public setDirection(direction: Vec3): void {
        const up = new Vec3(0, 1, 0);
        const dir = Vec3.normalize(direction);
        const dot = Vec3.dot(up, dir);
        if (dot > 0.9999) {
            this.rotation = new Quaternion();
        } else if (dot < -0.9999) {
            this.rotation = Quaternion.fromAxisAngle(new Vec3(1, 0, 0), Math.PI);
        } else {
            const axis = Vec3.normalize(Vec3.cross(up, dir));
            const angle = Math.acos(dot);
            this.rotation = Quaternion.fromAxisAngle(axis, angle);
        }
    }
}
