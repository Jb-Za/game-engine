import { Camera } from "../camera/Camera";
import { GeometryBuffersCollection } from "../attribute_buffers/GeometryBuffersCollection";
import { AmbientLight } from "../lights/AmbientLight";
import { Color } from "../math/Color";
import { Mat4x4 } from "../math/Mat4x4";
import { Vec3 } from "../math/Vec3";
import { RenderPipeline } from "../render_pipelines/RenderPipeline";
//import { UnlitRenderPipeline } from "../render_pipelines/UnlitRenderPipeline";
import { UniformBuffer } from "../uniform_buffers/UniformBuffer";
import { DirectionalLight } from "../lights/DirectionalLight";
import { Mat3x3 } from "../math/Mat3x3";
import { PointLightsCollection } from "../lights/PointLight";
import { ShadowCamera } from "../camera/ShadowCamera";

export class Floor{
    public pipeline: RenderPipeline;
    private transformBuffer: UniformBuffer;
    private normalMatrixBuffer: UniformBuffer;
    public rotation : Vec3 = new Vec3(0.5,0.5,0.5);
    public visible: boolean = true;

    private transform =  Mat4x4.identity();

    public scale = new Vec3(1,1,1);
    public position = new Vec3(0,0,4);

    public color = new Color(0.2,0.2,0.2,1);

    private angle = 0;
    constructor(device: GPUDevice, camera: Camera, shadowCamera: ShadowCamera, ambientLight: AmbientLight, directionalLight: DirectionalLight, pointLights: PointLightsCollection, multipleRenderTargets: boolean = false){
        this.transformBuffer = new UniformBuffer(device, this.transform, "Paddle Transform");

        this.normalMatrixBuffer = new UniformBuffer(device, 16 * Float32Array.BYTES_PER_ELEMENT, "Paddle Normal Matrix");
        this.pipeline = new RenderPipeline(device, camera, shadowCamera, this.transformBuffer, this.normalMatrixBuffer, ambientLight, directionalLight, pointLights, multipleRenderTargets);
    }

    public update(){
        const scale = Mat4x4.scale(this.scale.x, this.scale.y, this.scale.z);
        const translate = Mat4x4.translation(this.position.x, this.position.y, this.position.z);
        
        // const rotationX = Mat4x4.rotationX(this.rotation.x * 360);
        // const rotationY = Mat4x4.rotationY(this.rotation.y * 360);
        // const rotationZ = Mat4x4.rotationZ(this.rotation.z * 360);
        // const rotationMultiplied = Mat4x4.multiply(Mat4x4.multiply(rotationX, rotationY), rotationZ);
        this.transform = Mat4x4.multiply(translate, scale);
        this.transform = Mat4x4.multiply(this.transform, Mat4x4.rotationZ(this.angle));
        let normalMatrix = Mat3x3.fromMat4x4(this.transform);
        normalMatrix = Mat3x3.transpose(normalMatrix);
        normalMatrix = Mat3x3.inverse(normalMatrix);
        this.normalMatrixBuffer.update(Mat3x3.to16AlignedMat3x3(normalMatrix));

        this.transformBuffer.update(this.transform);
    }

    public draw(renderPassEncoder: GPURenderPassEncoder){
        if(!this.visible) return;
        this.pipeline.diffuseColor = this.color;
        this.pipeline.draw(renderPassEncoder, GeometryBuffersCollection.cubeBuffers);
    }
}