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
import { Vec2 } from "../math/Vec2";
import { RectCollider } from "../collider/RectCollider";
import { Paddle } from "./Paddle";

export class Ball{
    public pipeline: RenderPipeline;
    private shadowPipeline: ShadowRenderPipeline;
    
    private transformBuffer: UniformBuffer;

    private transform =  Mat4x4.identity();
    private normalMatrixBuffer: UniformBuffer;

    public scale = new Vec3(1,1,1);
    public position = new Vec3(0,0,1);

    public color = new Color(1,1,1,1);
    private direction = new Vec2(10, 1);
    private speed = 0.05;

    public collider = new RectCollider();

    constructor(device: GPUDevice, camera: Camera, shadowCamera: ShadowCamera, ambientLight: AmbientLight, directionalLight: DirectionalLight,  pointLights: PointLightsCollection){
        this.transformBuffer = new UniformBuffer(device, this.transform, "Paddle Transform");

        this.normalMatrixBuffer = new UniformBuffer(device, 16 * Float32Array.BYTES_PER_ELEMENT, "Paddle Normal Matrix");
        this.pipeline = new RenderPipeline(device, camera, shadowCamera, this.transformBuffer, this.normalMatrixBuffer, ambientLight, directionalLight, pointLights);
        this.shadowPipeline = new ShadowRenderPipeline(device, shadowCamera, this.transformBuffer);
    }

    public update(){
        this.direction.nomalize();
        this.position.x += this.direction.x * this.speed;
        this.position.y += this.direction.y * this.speed;

        if(this.position.y > 5 || this.position.y < -5 ){
            this.direction.y *= -1;
        }

        const scale = Mat4x4.scale(this.scale.x, this.scale.y, this.scale.z);
        const translate = Mat4x4.translation(this.position.x, this.position.y, this.position.z);
        this.transform = Mat4x4.multiply(translate, scale);
        this.transformBuffer.update(this.transform);

        let normalMatrix = Mat3x3.fromMat4x4(this.transform);
        normalMatrix = Mat3x3.transpose(normalMatrix);
        normalMatrix = Mat3x3.inverse(normalMatrix);
        this.normalMatrixBuffer.update(Mat3x3.to16AlignedMat3x3(normalMatrix));

        this.collider.x = this.position.x - this.scale.x / 2;
        this.collider.y = this.position.y - this.scale.y / 2;
        this.collider.width = this.scale.x;
        this.collider.height = this.scale.y;
      
    }

    public draw(renderPassEncoder: GPURenderPassEncoder){
        this.pipeline.diffuseColor = this.color;
        this.pipeline.draw(renderPassEncoder, GeometryBuffersCollection.sphereBuffers);
    }

    public drawShadows(renderPassEncoder: GPURenderPassEncoder){
        this.shadowPipeline.draw(renderPassEncoder, GeometryBuffersCollection.sphereBuffers);
    }

    
    public collidesPaddle(paddle: Paddle): void{
        if(this.collider.intersects(paddle.collider)){
         this.direction.x *= -1;   
        }
    }

}