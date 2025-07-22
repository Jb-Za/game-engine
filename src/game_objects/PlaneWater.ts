import { Camera } from "../camera/Camera";
import { GeometryBuffersCollection } from "../attribute_buffers/GeometryBuffersCollection";
import { Color } from "../math/Color";
import { Mat4x4 } from "../math/Mat4x4";
import { Vec3 } from "../math/Vec3";
import { Vec2 } from "../math/Vec2";
import { Vec4 } from "../math/Vec4";
import { UniformBuffer } from "../uniform_buffers/UniformBuffer";
import { AmbientLight } from "../lights/AmbientLight";
import { DirectionalLight } from "../lights/DirectionalLight";
import { Mat3x3 } from "../math/Mat3x3";
import { PointLightsCollection } from "../lights/PointLight";
import { ShadowRenderPipeline } from "../render_pipelines/ShadowRenderPipeline";
import { ShadowCamera } from "../camera/ShadowCamera";
import { Quaternion } from "../math/Quaternion";
import { WaterRenderPipeline } from "../render_pipelines/WaterRenderPipeline";
import { GameObject } from "../game_objects/ObjectMap";

export interface WaterParameters {
    waveSpeed?: number;
    waveHeight?: number;
    waveFrequency?: number;
    transparency?: number;
    reflectivity?: number;
    waterLevel?: number;
}

export class PlaneWater implements GameObject {
    public pipeline: WaterRenderPipeline;
    public scale = new Vec3(1, 1, 1);
    public position = new Vec3(0, 0, 0);
    public color = new Color(0.2, 0.6, 1.0, 0.7); // Default water blue with transparency
    public rotation = new Quaternion();

    // Water-specific properties
    public waveSpeed: number;
    public waveHeight: number;
    public waveFrequency: number;
    public transparency: number;
    public reflectivity: number;
    public waterLevel: number;
    
    private time: number = 0;
    private waveOffset = new Vec2(0, 0);

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

    constructor(
        device: GPUDevice, 
        camera: Camera, 
        shadowCamera: ShadowCamera, 
        ambientLight: AmbientLight, 
        directionalLight: DirectionalLight, 
        pointLights: PointLightsCollection,
        waterParams?: WaterParameters
    ) {
        // Initialize water parameters with defaults
        this.waveSpeed = waterParams?.waveSpeed ?? 1.0;
        this.waveHeight = waterParams?.waveHeight ?? 0.5;
        this.waveFrequency = waterParams?.waveFrequency ?? 2.0;
        this.transparency = waterParams?.transparency ?? 0.7;
        this.reflectivity = waterParams?.reflectivity ?? 0.5;
        this.waterLevel = waterParams?.waterLevel ?? 0.0;

        // Set initial position to water level
        this.position.y = this.waterLevel;

        // Initialize buffers and pipelines
        this.transformBuffer = new UniformBuffer(device, this.transform, "PlaneWater Transform");
        this.normalMatrixBuffer = new UniformBuffer(device, 16 * Float32Array.BYTES_PER_ELEMENT, "PlaneWater Normal Matrix");
        this.pipeline = new WaterRenderPipeline(device, camera, shadowCamera, this.transformBuffer, this.normalMatrixBuffer, ambientLight, directionalLight, pointLights);
        this.shadowPipeline = new ShadowRenderPipeline(device, shadowCamera, this.transformBuffer);

        // Set texture tiling for water animation
        this.pipeline.textureTiling = new Vec2(4, 4); // Tile the texture for better wave effect
    }

    public update(deltaTime?: number) {
        // Update time for wave animation
        if (deltaTime) {
            this.time += deltaTime;
        } else {
            this.time += 0.016; // Default ~60fps
        }

        // Update water pipeline with current time
        this.pipeline.time = this.time;

        // Update wave parameters
        const waveParams = new Vec4(this.waveSpeed, this.waveHeight, this.waveFrequency, 1.0);
        this.pipeline.waveParams = waveParams;

        // Animate wave offset for texture scrolling effect (kept for potential future use)
        this.waveOffset.x = Math.sin(this.time * this.waveSpeed) * 0.1;
        this.waveOffset.y = Math.cos(this.time * this.waveSpeed * 0.7) * 0.1;

        // Update transform matrix
        const scale = Mat4x4.scale(this.scale.x, this.scale.y, this.scale.z);
        const rotation = this.rotation.toMatrix();
        const translate = Mat4x4.translation(this.position.x, this.position.y, this.position.z);
        let transform = Mat4x4.multiply(rotation, scale);
        this.transform = Mat4x4.multiply(translate, transform);

        // Update uniform buffers
        this.transformBuffer.update(this.transform);
        
        // Calculate and update normal matrix
        const normalMatrix = Mat3x3.fromMat4x4(Mat4x4.transpose(Mat4x4.inverse(this.transform)));
        this.normalMatrixBuffer.update(normalMatrix);

        // Update pipeline color with water properties
        this.pipeline.diffuseColor = this.color;
    }

    public draw(renderPass: GPURenderPassEncoder) {
        // Use the same grid plane geometry as other grid-based objects
        this.pipeline.diffuseColor = this.color;
        this.pipeline.draw(renderPass, GeometryBuffersCollection.gridPlaneBuffers);
    }

    public drawShadows(renderPass: GPURenderPassEncoder) {
        // Water typically doesn't cast strong shadows, but we'll support it
        this.shadowPipeline.draw(renderPass, GeometryBuffersCollection.gridPlaneBuffers);
    }

    // Utility methods for water effects
    public setWaveParameters(speed: number, height: number, frequency: number) {
        this.waveSpeed = speed;
        this.waveHeight = height;
        this.waveFrequency = frequency;
    }

    public setTransparency(transparency: number) {
        this.transparency = Math.max(0, Math.min(1, transparency));
        this.color.a = this.transparency;
    }

    public setWaterLevel(level: number) {
        this.waterLevel = level;
        this.position.y = level;
    }

    // Create a large water plane that covers an area
    public static createLakeWater(
        device: GPUDevice,
        camera: Camera,
        shadowCamera: ShadowCamera,
        ambientLight: AmbientLight,
        directionalLight: DirectionalLight,
        pointLights: PointLightsCollection,
        size: number = 100,
        level: number = -2
    ): PlaneWater {
        const waterParams: WaterParameters = {
            waveSpeed: 0.5,
            waveHeight: 0.2,
            waveFrequency: 3.0,
            transparency: 0.6,
            reflectivity: 0.8,
            waterLevel: level
        };

        const water = new PlaneWater(device, camera, shadowCamera, ambientLight, directionalLight, pointLights, waterParams);
        water.scale = new Vec3(size, 1, size);
        water.color = new Color(0.1, 0.4, 0.8, 0.6); // Deep water blue
        
        return water;
    }

    // Create a shallow water plane
    public static createShallowWater(
        device: GPUDevice,
        camera: Camera,
        shadowCamera: ShadowCamera,
        ambientLight: AmbientLight,
        directionalLight: DirectionalLight,
        pointLights: PointLightsCollection,
        size: number = 50,
        level: number = 0
    ): PlaneWater {
        const waterParams: WaterParameters = {
            waveSpeed: 1.0,
            waveHeight: 0.1,
            waveFrequency: 4.0,
            transparency: 0.8,
            reflectivity: 0.3,
            waterLevel: level
        };

        const water = new PlaneWater(device, camera, shadowCamera, ambientLight, directionalLight, pointLights, waterParams);
        water.scale = new Vec3(size, 1, size);
        water.color = new Color(0.3, 0.7, 1.0, 0.8); // Lighter water blue
        
        return water;
    }
}
