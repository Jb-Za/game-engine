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
import { InputManager } from "../input/InputManager";
import { ShadowRenderPipeline } from "../render_pipelines/ShadowRenderPipeline";
import { ShadowCamera } from "../camera/ShadowCamera";
import { RectCollider } from "../collider/RectCollider";
import { Quaternion } from "../math/Quaternion";

export class Paddle{
    public pipeline: RenderPipeline;
    private shadowPipeline: ShadowRenderPipeline;
    private transformBuffer: UniformBuffer;
    private normalMatrixBuffer: UniformBuffer;
    public rotation = new Quaternion();
    

    private transform =  Mat4x4.identity();

    public scale = new Vec3(1,5,1);
    public position = new Vec3(0,0,0);

    public color = new Color(1,1,1,1);

    private speed = 0.2;
    public playerOne = false;

    public collider = new RectCollider();

    constructor(device: GPUDevice, private inputmanager: InputManager, camera: Camera, shadowCamera: ShadowCamera, ambientLight: AmbientLight, directionalLight: DirectionalLight, pointLights: PointLightsCollection){
        this.transformBuffer = new UniformBuffer(device, this.transform, "Paddle Transform");

        this.normalMatrixBuffer = new UniformBuffer(device, 16 * Float32Array.BYTES_PER_ELEMENT, "Paddle Normal Matrix");
        this.pipeline = new RenderPipeline(device, camera, shadowCamera, this.transformBuffer, this.normalMatrixBuffer, ambientLight, directionalLight, pointLights);
    
        this.pipeline.shininess = 128;

        this.shadowPipeline = new ShadowRenderPipeline(device, shadowCamera, this.transformBuffer);
    }

    public update(){

        let dirY = 0.0;

        if(this.playerOne){
            if(this.inputmanager.isKeyDown('w')){
                dirY = 1;
            }
            if(this.inputmanager.isKeyDown('s')){
                dirY = -1;
            }
        }
        else{
            if(this.inputmanager.isKeyDown('ArrowUp')){
                dirY = 1;
            }
            if(this.inputmanager.isKeyDown('ArrowDown')){
                dirY = -1;
            }
        }

        this.position.y += dirY * this.speed;
        if(this.position.y > 5)
            this.position.y = 5
        if(this.position.y < -5)
            this.position.y = -5

        const scale = Mat4x4.scale(this.scale.x, this.scale.y, this.scale.z);
        const translate = Mat4x4.translation(this.position.x, this.position.y, this.position.z);
        
        this.transform = Mat4x4.multiply(translate, scale);

        let normalMatrix = Mat3x3.fromMat4x4(this.transform);
        normalMatrix = Mat3x3.transpose(normalMatrix);
        normalMatrix = Mat3x3.inverse(normalMatrix);
        this.normalMatrixBuffer.update(Mat3x3.to16AlignedMat3x3(normalMatrix));

        this.transformBuffer.update(this.transform);

        this.collider.x = this.position.x - this.scale.x / 2;
        this.collider.y = this.position.y - this.scale.y / 2;
        this.collider.width = this.scale.x;
        this.collider.height = this.scale.y;
    }

    public draw(renderPassEncoder: GPURenderPassEncoder){
        this.pipeline.diffuseColor = this.color;
        this.pipeline.draw(renderPassEncoder, GeometryBuffersCollection.cubeBuffers);
    }

    public drawShadows(renderPassEncoder: GPURenderPassEncoder){
        this.shadowPipeline.draw(renderPassEncoder, GeometryBuffersCollection.cubeBuffers);
    }
}