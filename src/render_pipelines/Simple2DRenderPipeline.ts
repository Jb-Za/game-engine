import { GeometryBuffers } from "../attribute_buffers/GeometryBuffers";
import { Camera } from "../camera/Camera";
import { AmbientLight } from "../lights/AmbientLight";
import { PointLightsCollection } from "../lights/PointLight";
import { Color } from "../math/Color";
import { UniformBuffer } from "../uniform_buffers/UniformBuffer";

export class Simple2DRenderPipeline {
    private device: GPUDevice;
    private renderPipeline!: GPURenderPipeline;
    private cameraBindGroup!: GPUBindGroup;
    private transformBindGroup!: GPUBindGroup;
    private lightingBindGroup!: GPUBindGroup;
    private materialBindGroup!: GPUBindGroup;
    private materialBuffer!: GPUBuffer; // Store reference to material buffer
    
    private camera: Camera;
    private transformBuffer: UniformBuffer;
    private normalMatrixBuffer: UniformBuffer;
    private ambientLight: AmbientLight;
    private pointLights: PointLightsCollection;
    
    public diffuseColor: Color = new Color(1, 1, 1, 1);

    constructor(
        device: GPUDevice, 
        camera: Camera, 
        transformBuffer: UniformBuffer,
        normalMatrixBuffer: UniformBuffer,
        ambientLight: AmbientLight,
        pointLights: PointLightsCollection
    ) {
        this.device = device;
        this.camera = camera;
        this.transformBuffer = transformBuffer;
        this.normalMatrixBuffer = normalMatrixBuffer;
        this.ambientLight = ambientLight;
        this.pointLights = pointLights;
        
        this.createPipeline();
        this.createBindGroups();
    }

    private createPipeline() {        const shaderCode = `
            struct VertexInput {
                @location(0) position: vec3<f32>,
                @location(1) color: vec4<f32>,
                @location(2) texCoords: vec2<f32>,
                @location(3) normal: vec3<f32>,
            }

            struct VertexOutput {
                @builtin(position) position: vec4<f32>,
                @location(0) worldPosition: vec3<f32>,
                @location(1) normal: vec3<f32>,
                @location(2) color: vec4<f32>,
            }

            struct Camera {
                viewProjectionMatrix: mat4x4<f32>,
            }

            struct Transform {
                modelMatrix: mat4x4<f32>,
            }

            struct NormalMatrix {
                normalMatrix: mat4x4<f32>,
            }

            struct AmbientLight {
                color: vec3<f32>,
                intensity: f32,
            }

            struct PointLight {
                @location(0) color: vec3<f32>, 
                @location(1) intensity: f32, 
                @location(2) position: vec3<f32>, 
                @location(3) attenConst: f32, 
                @location(4) attenLin: f32, 
                @location(5) attenQuad: f32, 
                @location(6) _discard: vec2<f32>, 
                @location(7) specularColor: vec3<f32>, 
                @location(8) specularIntensity: f32, 
            }

            struct Material {
                diffuseColor: vec4<f32>,
            }

            @group(0) @binding(0) var<uniform> camera: Camera;
            @group(1) @binding(0) var<uniform> transform: Transform;
            @group(1) @binding(1) var<uniform> normalMatrix: NormalMatrix;
            @group(2) @binding(0) var<uniform> ambientLight: AmbientLight;
            @group(2) @binding(1) var<uniform> positionalLight: array<PointLight, 3>;
            @group(3) @binding(0) var<uniform> material: Material;

            @vertex
            fn vs_main(input: VertexInput) -> VertexOutput {
                var output: VertexOutput;
                
                let worldPosition = transform.modelMatrix * vec4<f32>(input.position, 1.0);
                output.position = camera.viewProjectionMatrix * worldPosition;
                output.worldPosition = worldPosition.xyz;
                
                // Transform normal to world space
                let normalMatrix3x3 = mat3x3<f32>(
                    normalMatrix.normalMatrix[0].xyz,
                    normalMatrix.normalMatrix[1].xyz,
                    normalMatrix.normalMatrix[2].xyz
                );
                output.normal = normalize(normalMatrix3x3 * input.normal);
                output.color = input.color;
                
                return output;
            }            @fragment
            fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
                let baseColor = material.diffuseColor;
                
                // Ambient lighting
                var finalColor = ambientLight.color * ambientLight.intensity * baseColor.rgb;
                
                // Point light contributions (using MaterialShader structure)
                for (var i: u32 = 0u; i < 3u; i++) {
                    let light = positionalLight[i];
                    let lightDir = normalize(light.position - input.worldPosition);
                    let distance = length(light.position - input.worldPosition);
                    
                    // Attenuation using MaterialShader formula
                    let attenuation = light.attenConst + 
                                     light.attenLin * distance + 
                                     light.attenQuad * distance * distance;
                    let attenuationFactor = 1.0 / attenuation;
                    
                    // Diffuse lighting (simplified for 2D)
                    let facing = max(dot(input.normal, lightDir), 0.0);
                    let diffuse = light.color * light.intensity * facing * attenuationFactor;
                    
                    finalColor += diffuse * baseColor.rgb;
                }
                
                return vec4<f32>(finalColor, baseColor.a);
            }
        `;

        const shaderModule = this.device.createShaderModule({
            code: shaderCode,
        });

        this.renderPipeline = this.device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module: shaderModule,
                entryPoint: "vs_main",
                buffers: [
                    {
                        arrayStride: 12, // position: 3 floats
                        attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }],
                    },
                    {
                        arrayStride: 16, // color: 4 floats
                        attributes: [{ shaderLocation: 1, offset: 0, format: "float32x4" }],
                    },
                    {
                        arrayStride: 8, // texCoords: 2 floats
                        attributes: [{ shaderLocation: 2, offset: 0, format: "float32x2" }],
                    },
                    {
                        arrayStride: 12, // normal: 3 floats
                        attributes: [{ shaderLocation: 3, offset: 0, format: "float32x3" }],
                    },
                ],
            },
            fragment: {
                module: shaderModule,
                entryPoint: "fs_main",
                targets: [{ format: "bgra8unorm" }],
            },
            primitive: {
                topology: "triangle-list",
            },            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: "less",
                format: "depth32float",
            },
        });
    }

    private createBindGroups() {
        // Camera bind group (group 0)
        this.cameraBindGroup = this.device.createBindGroup({
            layout: this.renderPipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.camera.buffer.buffer,
                    },
                },
            ],
        });

        // Transform bind group (group 1)
        this.transformBindGroup = this.device.createBindGroup({
            layout: this.renderPipeline.getBindGroupLayout(1),
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.transformBuffer.buffer,
                    },
                },
                {
                    binding: 1,
                    resource: {
                        buffer: this.normalMatrixBuffer.buffer,
                    },
                },
            ],
        });

        // Lighting bind group (group 2)
        this.lightingBindGroup = this.device.createBindGroup({
            layout: this.renderPipeline.getBindGroupLayout(2),
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.ambientLight.buffer.buffer,
                    },
                },
                {
                    binding: 1,
                    resource: {
                        buffer: this.pointLights.buffer.buffer,
                    },
                },
            ],
        });        // Material bind group (group 3)
        this.materialBuffer = this.device.createBuffer({
            size: 16, // vec4<f32> for diffuse color
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.materialBindGroup = this.device.createBindGroup({
            layout: this.renderPipeline.getBindGroupLayout(3),
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.materialBuffer,
                    },
                },
            ],
        });

        // Update material buffer with initial color
        this.updateMaterial();
    }    private updateMaterial() {
        this.device.queue.writeBuffer(
            this.materialBuffer,
            0,
            new Float32Array([
                this.diffuseColor.r,
                this.diffuseColor.g,
                this.diffuseColor.b,
                this.diffuseColor.a
            ])
        );
    }    public draw(renderPassEncoder: GPURenderPassEncoder, geometryBuffers: GeometryBuffers) {
        // Update material color
        this.updateMaterial();

        renderPassEncoder.setPipeline(this.renderPipeline);
        renderPassEncoder.setBindGroup(0, this.cameraBindGroup);
        renderPassEncoder.setBindGroup(1, this.transformBindGroup);
        renderPassEncoder.setBindGroup(2, this.lightingBindGroup);
        renderPassEncoder.setBindGroup(3, this.materialBindGroup);

        renderPassEncoder.setVertexBuffer(0, geometryBuffers.positionsBuffer);
        renderPassEncoder.setVertexBuffer(1, geometryBuffers.colorsBuffer);
        renderPassEncoder.setVertexBuffer(2, geometryBuffers.texCoordsBuffer);
        renderPassEncoder.setVertexBuffer(3, geometryBuffers.normalsBuffer);

        if (geometryBuffers.indicesBuffer) {
            renderPassEncoder.setIndexBuffer(geometryBuffers.indicesBuffer, "uint16");
            renderPassEncoder.drawIndexed(geometryBuffers.indexCount!);
        } else {
            renderPassEncoder.draw(geometryBuffers.vertexCount);
        }
    }
}
