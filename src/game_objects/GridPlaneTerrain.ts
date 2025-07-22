import { Camera } from "../camera/Camera";
import { GeometryBuffers } from "../attribute_buffers/GeometryBuffers";
import { GeometryBuilder } from "../geometry/GeometryBuilder";
import { Color } from "../math/Color";
import { Mat4x4 } from "../math/Mat4x4";
import { Vec3 } from "../math/Vec3";
import { UniformBuffer } from "../uniform_buffers/UniformBuffer";
import { TerrainRenderPipeline } from "../render_pipelines/TerrainRenderPipeline";
import { AmbientLight } from "../lights/AmbientLight";
import { DirectionalLight } from "../lights/DirectionalLight";
import { Mat3x3 } from "../math/Mat3x3";
import { PointLightsCollection } from "../lights/PointLight";
import { ShadowRenderPipeline } from "../render_pipelines/ShadowRenderPipeline";
import { ShadowCamera } from "../camera/ShadowCamera";
import { Quaternion } from "../math/Quaternion";

export interface TerrainParameters {
    seed?: number;
    size?: number;
    scale?: number;
    offset?: { x: number, y: number };
    heightMultiplier?: number;
    octaves?: number;
    persistence?: number;
    lacunarity?: number;
    position?: Vec3;
}

export class GridPlaneTerrain {
    public pipeline: TerrainRenderPipeline;
    public scale = new Vec3(1,1,1);
    public position = new Vec3(0,0,0);
    public color = new Color(1,1,1,1);
    public rotation = new Quaternion();
    
    private geometryBuffers: GeometryBuffers;

    public set wireframeMode(value: boolean) {
        this.pipeline.wireframeMode = value;
    }

    public get wireframeMode(): boolean {
        return this.pipeline.wireframeMode;
    }

    private shadowPipeline: ShadowRenderPipeline;
    private transformBuffer: UniformBuffer;
    private transform = Mat4x4.identity();
    private normalMatrixBuffer: UniformBuffer;

    constructor(device: GPUDevice, camera: Camera, shadowCamera: ShadowCamera, ambientLight: AmbientLight, directionalLight: DirectionalLight, pointLights: PointLightsCollection, terrainParams?: TerrainParameters) {
        // Generate unique terrain geometry for this instance
        const geometryBuilder = new GeometryBuilder();
        const terrainGeometry = geometryBuilder.createTerrainGeometry(128, 64, terrainParams);
        this.geometryBuffers = new GeometryBuffers(device, terrainGeometry);
        
        this.transformBuffer = new UniformBuffer(device, this.transform, "GridPlaneTerrain Transform");
        this.normalMatrixBuffer = new UniformBuffer(device, 16 * Float32Array.BYTES_PER_ELEMENT, "GridPlaneTerrain Normal Matrix");
        this.pipeline = new TerrainRenderPipeline(device, camera, shadowCamera, this.transformBuffer, this.normalMatrixBuffer, ambientLight, directionalLight, pointLights);
        this.shadowPipeline = new ShadowRenderPipeline(device, shadowCamera, this.transformBuffer);
    }

    public update() {
        // TODO: Update transform and normal matrix for GridPlane
        const scale = Mat4x4.scale(this.scale.x, this.scale.y, this.scale.z);
        const rotation = this.rotation.toMatrix();
        const translate = Mat4x4.translation(this.position.x, this.position.y, this.position.z);
        let transform = Mat4x4.multiply(rotation, scale);
        this.transform = Mat4x4.multiply(translate, transform);
        this.transformBuffer.update(this.transform);

        let normalMatrix = Mat3x3.fromMat4x4(this.transform);
        normalMatrix = Mat3x3.transpose(normalMatrix);
        normalMatrix = Mat3x3.inverse(normalMatrix);
        this.normalMatrixBuffer.update(Mat3x3.to16AlignedMat3x3(normalMatrix));
    }

    public draw(renderPassEncoder: GPURenderPassEncoder) {
        // Draw using this instance's unique geometry buffers
        this.pipeline.diffuseColor = this.color;
        this.pipeline.draw(renderPassEncoder, this.geometryBuffers);
    }

    public drawShadows(renderPassEncoder: GPURenderPassEncoder) {
        // Draw shadows using this instance's unique geometry buffers
        this.shadowPipeline.draw(renderPassEncoder, this.geometryBuffers);
    }
}
