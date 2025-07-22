import { Mat4x4 } from "../math/Mat4x4";
import { Color } from "../math/Color";
import { PhysicsWorld, PhysicsObject } from "./PhysicsWorld";
import { RigidBodyType } from "./RigidBody";
import { ColliderType, BoxCollider, SphereCollider } from "./Collider";

export class PhysicsDebugRenderer {
    private device: GPUDevice;
    private bindGroupLayout!: GPUBindGroupLayout;
    private pipeline!: GPURenderPipeline;

    // Separate buffers for cubes and spheres
    private cubeVertexBuffer!: GPUBuffer;
    private cubeIndexBuffer!: GPUBuffer;
    private sphereVertexBuffer!: GPUBuffer;
    private sphereIndexBuffer!: GPUBuffer;

    // Wireframe sphere and cube geometry
    private sphereVertices!: Float32Array;
    private sphereIndices!: Uint16Array;
    private cubeVertices!: Float32Array;
    private cubeIndices!: Uint16Array;

    // Uniform buffer pool for reuse
    private uniformBufferPool: GPUBuffer[] = [];
    private bindGroupPool: GPUBindGroup[] = [];
    private maxPoolSize: number = 256;
    private poolIndex: number = 0;

    public showStatic: boolean = true;
    public showDynamic: boolean = true;
    public showKinematic: boolean = true;

    constructor(device: GPUDevice) {
        this.device = device;
        this.initializeGeometry();
        this.createBuffers();
        this.createPipeline();
        this.initializeBufferPool();
    }

    private initializeBufferPool(): void {
        // Pre-allocate uniform buffers and bind groups for reuse
        const uniformSize = 20 * Float32Array.BYTES_PER_ELEMENT; // 16 for matrix + 4 for color

        for (let i = 0; i < this.maxPoolSize; i++) {
            const uniformBuffer = this.device.createBuffer({
                size: uniformSize,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });

            const bindGroup = this.device.createBindGroup({
                layout: this.bindGroupLayout,
                entries: [{
                    binding: 0,
                    resource: { buffer: uniformBuffer }
                }]
            });

            this.uniformBufferPool.push(uniformBuffer);
            this.bindGroupPool.push(bindGroup);
        }
    }

    private getNextBufferFromPool(): { buffer: GPUBuffer, bindGroup: GPUBindGroup } {
        const buffer = this.uniformBufferPool[this.poolIndex];
        const bindGroup = this.bindGroupPool[this.poolIndex];

        this.poolIndex = (this.poolIndex + 1) % this.maxPoolSize;

        return { buffer, bindGroup };
    }

    private initializeGeometry(): void {
        // Create wireframe cube
        this.cubeVertices = new Float32Array([
            // Front face
            -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1,
            // Back face
            -1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1
        ]);

        this.cubeIndices = new Uint16Array([
            // Front face edges
            0, 1, 1, 2, 2, 3, 3, 0,
            // Back face edges
            4, 5, 5, 6, 6, 7, 7, 4,
            // Connecting edges
            0, 4, 1, 5, 2, 6, 3, 7
        ]);

        // Create wireframe sphere with multiple rings and meridians for better visibility
        const segments = 16; // Number of segments per circle
        const sphereVerts: number[] = [];
        const sphereIndices: number[] = [];

        // Create multiple latitude rings (horizontal circles)
        const latitudes = 6; // Number of horizontal rings
        for (let lat = 0; lat < latitudes; lat++) {
            const phi = (lat * Math.PI) / (latitudes - 1); // From 0 to PI
            const y = Math.cos(phi);
            const radius = Math.sin(phi);

            const startIdx = sphereVerts.length / 3;

            // Create vertices for this latitude ring
            for (let i = 0; i <= segments; i++) {
                const theta = (i * 2 * Math.PI) / segments;
                const x = radius * Math.cos(theta);
                const z = radius * Math.sin(theta);
                sphereVerts.push(x, y, z);
            }

            // Create indices for this ring
            for (let i = 0; i < segments; i++) {
                sphereIndices.push(startIdx + i, startIdx + i + 1);
            }
        }

        // Create longitude lines (vertical meridians)
        const longitudes = 8; // Number of vertical lines
        for (let lon = 0; lon < longitudes; lon++) {
            const theta = (lon * 2 * Math.PI) / longitudes;
            const cosTheta = Math.cos(theta);
            const sinTheta = Math.sin(theta);

            const startIdx = sphereVerts.length / 3;

            // Create vertices for this meridian
            for (let i = 0; i <= segments; i++) {
                const phi = (i * Math.PI) / segments; // From 0 to PI
                const y = Math.cos(phi);
                const radius = Math.sin(phi);
                const x = radius * cosTheta;
                const z = radius * sinTheta;
                sphereVerts.push(x, y, z);
            }

            // Create indices for this meridian
            for (let i = 0; i < segments; i++) {
                sphereIndices.push(startIdx + i, startIdx + i + 1);
            }
        }

        this.sphereVertices = new Float32Array(sphereVerts);
        this.sphereIndices = new Uint16Array(sphereIndices);
    }

    private createBuffers(): void {
        // Create separate vertex buffers for cubes and spheres
        this.cubeVertexBuffer = this.device.createBuffer({
            size: this.cubeVertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        this.cubeIndexBuffer = this.device.createBuffer({
            size: this.cubeIndices.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        });

        this.sphereVertexBuffer = this.device.createBuffer({
            size: this.sphereVertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        this.sphereIndexBuffer = this.device.createBuffer({
            size: this.sphereIndices.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        });

        // Upload geometry data once
        this.device.queue.writeBuffer(this.cubeVertexBuffer, 0, this.cubeVertices);
        this.device.queue.writeBuffer(this.cubeIndexBuffer, 0, this.cubeIndices);
        this.device.queue.writeBuffer(this.sphereVertexBuffer, 0, this.sphereVertices);
        this.device.queue.writeBuffer(this.sphereIndexBuffer, 0, this.sphereIndices);
    }

    public toggleStatic(): void {
        this.showStatic = !this.showStatic;
    }

    public toggleDynamic(): void {
        this.showDynamic = !this.showDynamic;
    }

    public toggleKinematic(): void {
        this.showKinematic = !this.showKinematic;
    }

    public showAll(): void {
        this.showStatic = true;
        this.showDynamic = true;
        this.showKinematic = true;
    }

    public hideAll(): void {
        this.showStatic = false;
        this.showDynamic = false;
        this.showKinematic = false;
    }

    private createPipeline(): void {
        const shaderModule = this.device.createShaderModule({
            code: `
                struct Uniforms {
                    mvpMatrix: mat4x4<f32>,
                    color: vec4<f32>,
                }
                
                @group(0) @binding(0) var<uniform> uniforms: Uniforms;
                
                struct VertexOutput {
                    @builtin(position) position: vec4<f32>,
                }
                
                @vertex
                fn vs_main(@location(0) position: vec3<f32>) -> VertexOutput {
                    var output: VertexOutput;
                    output.position = uniforms.mvpMatrix * vec4<f32>(position, 1.0);
                    return output;
                }
                
                @fragment
                fn fs_main() -> @location(0) vec4<f32> {
                    return uniforms.color;
                }
            `
        });

        this.bindGroupLayout = this.device.createBindGroupLayout({
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: { type: 'uniform' }
            }]
        });

        this.pipeline = this.device.createRenderPipeline({
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [this.bindGroupLayout]
            }),
            vertex: {
                module: shaderModule,
                entryPoint: 'vs_main',
                buffers: [{
                    arrayStride: 12, // 3 floats * 4 bytes
                    attributes: [{
                        format: 'float32x3',
                        offset: 0,
                        shaderLocation: 0,
                    }]
                }]
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_main',
                targets: [{
                    format: 'bgra8unorm',
                    blend: {
                        color: {
                            srcFactor: 'src-alpha',
                            dstFactor: 'one-minus-src-alpha',
                        },
                        alpha: {
                            srcFactor: 'one',
                            dstFactor: 'zero',
                        }
                    }
                }]
            },
            primitive: {
                topology: 'line-list',
                cullMode: 'none',
            },
            depthStencil: {
                depthWriteEnabled: false,
                depthCompare: 'always', // Always render wireframes regardless of depth
                format: 'depth32float',
            }
        });
    }

    public render(
        renderPass: GPURenderPassEncoder,
        physicsWorld: PhysicsWorld,
        viewMatrix: Mat4x4,
        projectionMatrix: Mat4x4
    ): void {
        renderPass.setPipeline(this.pipeline);

        const viewProjectionMatrix = Mat4x4.multiply(projectionMatrix, viewMatrix);
        const objects = physicsWorld.getAllObjects();
        console.log(objects)
        for (const obj of objects) {
            if (!obj.isActive) continue;

            const rigidBodyType = obj.rigidBody.type;
            if (rigidBodyType === RigidBodyType.STATIC && !this.showStatic) continue;
            if (rigidBodyType === RigidBodyType.DYNAMIC && !this.showDynamic) continue;
            if (rigidBodyType === RigidBodyType.KINEMATIC && !this.showKinematic) continue;

            this.renderCollider(renderPass, obj, viewProjectionMatrix);
        }
    }

    private renderCollider(
        renderPass: GPURenderPassEncoder,
        physicsObject: PhysicsObject,
        viewProjectionMatrix: Mat4x4
    ): void {
        const collider = physicsObject.collider;
        const rigidBody = physicsObject.rigidBody;

        // Choose color based on rigid body type
        let color: Color;
        if (rigidBody.type === RigidBodyType.STATIC) {
            color = new Color(0, 1, 0, 1.0); // Green for static
        } else if (rigidBody.type === RigidBodyType.KINEMATIC) {
            color = new Color(0, 0, 1, 1.0); // Blue for kinematic
        } else {
            color = new Color(1, 0, 0, 1.0); // Red for dynamic
        }

        // Create transform matrix
        let modelMatrix = Mat4x4.translation(collider.position.x, collider.position.y, collider.position.z);

        if (collider.type === ColliderType.BOX) {
            const boxCollider = collider as BoxCollider;

            // Apply rotation
            const rotationMatrix = Mat4x4.fromQuaternion(collider.rotation);
            modelMatrix = Mat4x4.multiply(modelMatrix, rotationMatrix);

            const scaleMatrix = Mat4x4.scale(boxCollider.size.x, boxCollider.size.y, boxCollider.size.z);
            modelMatrix = Mat4x4.multiply(modelMatrix, scaleMatrix);

            // Use pooled uniform buffer
            const mvpMatrix = Mat4x4.multiply(viewProjectionMatrix, modelMatrix);
            const uniformData = new Float32Array(20); // 16 for matrix + 4 for color
            uniformData.set(mvpMatrix, 0);
            uniformData.set([color.r, color.g, color.b, color.a], 16);

            const { buffer: uniformBuffer, bindGroup } = this.getNextBufferFromPool();
            this.device.queue.writeBuffer(uniformBuffer, 0, uniformData);

            // Set buffers and draw for box
            renderPass.setBindGroup(0, bindGroup);
            renderPass.setVertexBuffer(0, this.cubeVertexBuffer);
            renderPass.setIndexBuffer(this.cubeIndexBuffer, 'uint16');
            renderPass.drawIndexed(this.cubeIndices.length);

        } else if (collider.type === ColliderType.SPHERE) {
            const sphereCollider = collider as SphereCollider;
            const scaleMatrix = Mat4x4.scale(sphereCollider.radius, sphereCollider.radius, sphereCollider.radius);
            modelMatrix = Mat4x4.multiply(modelMatrix, scaleMatrix);

            // Use pooled uniform buffer
            const mvpMatrix = Mat4x4.multiply(viewProjectionMatrix, modelMatrix);
            const uniformData = new Float32Array(20); // 16 for matrix + 4 for color
            uniformData.set(mvpMatrix, 0);
            uniformData.set([color.r, color.g, color.b, color.a], 16);

            const { buffer: uniformBuffer, bindGroup } = this.getNextBufferFromPool();
            this.device.queue.writeBuffer(uniformBuffer, 0, uniformData);

            // Set buffers and draw for sphere
            renderPass.setBindGroup(0, bindGroup);
            renderPass.setVertexBuffer(0, this.sphereVertexBuffer);
            renderPass.setIndexBuffer(this.sphereIndexBuffer, 'uint16');
            renderPass.drawIndexed(this.sphereIndices.length);
        }
    }

    public destroy(): void {
        this.cubeVertexBuffer?.destroy();
        this.cubeIndexBuffer?.destroy();
        this.sphereVertexBuffer?.destroy();
        this.sphereIndexBuffer?.destroy();

        // Clean up buffer pool
        for (const buffer of this.uniformBufferPool) {
            buffer.destroy();
        }
        this.uniformBufferPool = [];
        this.bindGroupPool = [];
    }
}
