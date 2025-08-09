import { Camera } from "../camera/Camera";
import { Vec3 } from "../math/Vec3";
import { RayTracingRenderPipeline } from "../render_pipelines/RayTracingRenderPipeline";

// Example usage of the RayTracing Render Pipeline
export class RaytracingExample {
    private rayTracingPipeline!: RayTracingRenderPipeline;
    private camera!: Camera;

    constructor(private device: GPUDevice, private canvas: HTMLCanvasElement, private context: GPUCanvasContext) {
        this.initializeCamera();
        this.initializeRenderPipeline();
        this.setupScene();
    }

    private initializeCamera() {
        const aspectRatio = this.canvas.width / this.canvas.height;
        this.camera = new Camera(this.device, aspectRatio);
        
        // Position camera to see the scene
        this.camera.eye = new Vec3(0, 2, 5);
        this.camera.target = new Vec3(0, 0, 0);
    }

    private initializeRenderPipeline() {
        this.rayTracingPipeline = new RayTracingRenderPipeline(
            this.device, 
            this.camera, 
            this.canvas.width, 
            this.canvas.height
        );
    }

    private setupScene() {
        // Example spheres
        const spheres = [
            {
                center: new Vec3(0, 0, 0),
                radius: 1.0,
                material: {
                    color: new Vec3(1.0, 0.2, 0.2), // Red
                    roughness: 0.1,
                    emission: new Vec3(0, 0, 0) // No emission
                }
            },
            {
                center: new Vec3(-2, 0, -1),
                radius: 0.5,
                material: {
                    color: new Vec3(0.2, 1.0, 0.2), // Green
                    roughness: 0.8,
                    emission: new Vec3(0, 0, 0)
                }
            },
            {
                center: new Vec3(2, 0, -1),
                radius: 0.5,
                material: {
                    color: new Vec3(0.2, 0.2, 1.0), // Blue
                    roughness: 0.0, // Mirror
                    emission: new Vec3(0, 0, 0)
                }
            }
        ];

        // Example planes
        const planes = [
            {
                position: new Vec3(0, -1, 0),
                normal: new Vec3(0, 1, 0), // Up
                size: { width: 10, height: 10 },
                material: {
                    color: new Vec3(0.8, 0.8, 0.8), // Light gray
                    roughness: 0.9,
                    emission: new Vec3(0, 0, 0)
                }
            }
        ];

        // Update the render pipeline with scene data
        this.rayTracingPipeline.updateSpheres(spheres);
        this.rayTracingPipeline.updatePlanes(planes);
    }

    public render() {
        // Update camera if needed
        this.camera.update();

        // Create command encoder
        const commandEncoder = this.device.createCommandEncoder();

        // Run compute shader for raytracing
        this.rayTracingPipeline.compute(commandEncoder);

        // Render the result to screen
        const textureView = this.context.getCurrentTexture().createView();
        const renderPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [
                {
                    view: textureView,
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    loadOp: "clear",
                    storeOp: "store",
                },
            ],
        };

        const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
        this.rayTracingPipeline.draw(renderPass);
        renderPass.end();

        // Submit commands
        this.device.queue.submit([commandEncoder.finish()]);
    }

    public destroy() {
        this.rayTracingPipeline.destroy();
    }
}
