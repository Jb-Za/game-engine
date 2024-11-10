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
// import { Vec2 } from "../math/Vec2";
import { Vec4 } from "../math/Vec4";
// import { RectCollider } from "../collider/RectCollider";

export class Cube{
    public pipeline: RenderPipeline;
    public scale = new Vec3(1,1,1);
    public position = new Vec3(0,0,0);
    public color = new Color(1,0,0,1);

    public orbit: boolean = false;
    public orbitPoint: Vec3 = new Vec3(0,0,0);
    public orbitSpeed: number = 0.55;
    public orbitDistance: number = 0;
    public orthogonalVector: Vec3 = new Vec3(0,0,0);
    public orbitAxis: Vec3 = new Vec3(0,0,0);
    public orbitDirection: number = 1;
    public orbitInitialPosition: Vec3 = new Vec3(0,0,0);

    private shadowPipeline: ShadowRenderPipeline;
    private transformBuffer: UniformBuffer;
    private transform =  Mat4x4.identity();
    private normalMatrixBuffer: UniformBuffer;
    // public collider = new RectCollider();

    constructor(device: GPUDevice, camera: Camera, shadowCamera: ShadowCamera, ambientLight: AmbientLight, directionalLight: DirectionalLight,  pointLights: PointLightsCollection){
        this.transformBuffer = new UniformBuffer(device, this.transform, "Cube Transform");

        this.normalMatrixBuffer = new UniformBuffer(device, 16 * Float32Array.BYTES_PER_ELEMENT, "Cube Normal Matrix");
        this.pipeline = new RenderPipeline(device, camera, shadowCamera, this.transformBuffer, this.normalMatrixBuffer, ambientLight, directionalLight, pointLights);
        this.shadowPipeline = new ShadowRenderPipeline(device, shadowCamera, this.transformBuffer);
    }

    public update(){
        
        if(this.orbit === true){
            this._orbitPoint();
        }

        const scale = Mat4x4.scale(this.scale.x, this.scale.y, this.scale.z);
        const translate = Mat4x4.translation(this.position.x, this.position.y, this.position.z);
        this.transform = Mat4x4.multiply(translate, scale);
        this.transformBuffer.update(this.transform);

        let normalMatrix = Mat3x3.fromMat4x4(this.transform);
        normalMatrix = Mat3x3.transpose(normalMatrix);
        normalMatrix = Mat3x3.inverse(normalMatrix);
        this.normalMatrixBuffer.update(Mat3x3.to16AlignedMat3x3(normalMatrix));
    }

    public draw(renderPassEncoder: GPURenderPassEncoder){
        this.pipeline.diffuseColor = this.color;
        this.pipeline.draw(renderPassEncoder, GeometryBuffersCollection.cubeBuffers);
    }

    public drawShadows(renderPassEncoder: GPURenderPassEncoder){
        this.shadowPipeline.draw(renderPassEncoder, GeometryBuffersCollection.cubeBuffers);
    }

    private _orbitPoint() : void{
        const angle = this.orbitSpeed * performance.now() / 1000 * this.orbitDirection; // Use the current time to calculate the angle
        const axis = Vec3.normalize(this.orbitAxis); // Normalize the orbit axis
    
        const rotationMatrix = Mat4x4.rotationAxis(axis, angle); // Create a rotation matrix around the axis
        const translationMatrix = Mat4x4.translation(this.orbitPoint.x, this.orbitPoint.y, this.orbitPoint.z); // Create a translation matrix to the orbit point
        const orbitMatrix = Mat4x4.multiply(translationMatrix, rotationMatrix); // Combine the translation and rotation matrices
    
        const positionVector = new Vec4(this.orbitInitialPosition.x, this.orbitInitialPosition.y, this.orbitInitialPosition.z, 1); // Create a position vector representing the orbit distance
        const newPosition = Mat4x4.transformVec4(orbitMatrix, positionVector); // Apply the orbit matrix to the position vector
    
        this.position.x = newPosition.x;
        this.position.y = newPosition.y;
        this.position.z = newPosition.z;
    }
}