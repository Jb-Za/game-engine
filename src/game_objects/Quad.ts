import { Camera } from "../camera/Camera";
import { GeometryBuffersCollection } from "../attribute_buffers/GeometryBuffersCollection";
import { Color } from "../math/Color";
import { Mat4x4 } from "../math/Mat4x4";
import { Vec3 } from "../math/Vec3";
//import { UnlitRenderPipeline } from "../render_pipelines/UnlitRenderPipeline";
import { UniformBuffer } from "../uniform_buffers/UniformBuffer";
import { RenderPipeline } from "../render_pipelines/RenderPipeline";
import { AmbientLight } from "../lights/AmbientLight";
import { DirectionalLight } from "../lights/DirectionalLight";
import { Mat3x3 } from "../math/Mat3x3";
import { PointLightsCollection } from "../lights/PointLight";
import { ShadowRenderPipeline } from "../render_pipelines/ShadowRenderPipeline";
import { ShadowCamera } from "../camera/ShadowCamera";
import { Quaternion } from "../math/Quaternion";
// import { Vec2 } from "../math/Vec2";
//import { Vec4 } from "../math/Vec4";
// import { RectCollider } from "../collider/RectCollider";

export class Quad{
    public pipeline: RenderPipeline;
    public scale = new Vec3(1,1,1);
    public position = new Vec3(0,-1,0);
    public color = new Color(1,0,0,1);
    public rotation = new Quaternion();
    public visible: boolean = true;

    private shadowPipeline: ShadowRenderPipeline;
    private transformBuffer: UniformBuffer;
    private transform =  Mat4x4.identity();
    private normalMatrixBuffer: UniformBuffer;
    // public collider = new RectCollider();

    constructor(device: GPUDevice, camera: Camera, shadowCamera: ShadowCamera, ambientLight: AmbientLight, directionalLight: DirectionalLight,  pointLights: PointLightsCollection, multipleRenderTargets: boolean = false){
        this.transformBuffer = new UniformBuffer(device, this.transform, "Quad Transform");

        this.normalMatrixBuffer = new UniformBuffer(device, 16 * Float32Array.BYTES_PER_ELEMENT, "Quad Normal Matrix");
        this.pipeline = new RenderPipeline(device, camera, shadowCamera, this.transformBuffer, this.normalMatrixBuffer, ambientLight, directionalLight, pointLights, multipleRenderTargets);
        this.shadowPipeline = new ShadowRenderPipeline(device, shadowCamera, this.transformBuffer);
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

    public draw(renderPassEncoder: GPURenderPassEncoder){
        if(!this.visible) return;
        this.pipeline.diffuseColor = this.color;
        this.pipeline.draw(renderPassEncoder, GeometryBuffersCollection.quadBuffers);
    }

    public drawShadows(renderPassEncoder: GPURenderPassEncoder){
        if(!this.visible) return;
        this.shadowPipeline.draw(renderPassEncoder, GeometryBuffersCollection.quadBuffers);
    }

}