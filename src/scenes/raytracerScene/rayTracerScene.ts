import { GeometryBuffersCollection } from "../../attribute_buffers/GeometryBuffersCollection";
import { Vec3 } from "../../math/Vec3";
import { Vec2 } from "../../math/Vec2";
import { InputManager } from "../../input/InputManager";
import { RayTracedPlane, RayTracedSphere, RaytracerMaterial } from "../../raytracing/Interface";

import { RayTracingRenderPipeline } from "../../render_pipelines/RayTracingRenderPipeline";
import { Camera } from "../../camera/Camera";

let animationFrameId: number | null = null;

async function init(canvas: HTMLCanvasElement, device: GPUDevice, gpuContext: GPUCanvasContext, presentationFormat: GPUTextureFormat, infoElem: HTMLPreElement) {
    canvas!.addEventListener("click", async () => {
        await canvas!.requestPointerLock();
    });

    if (presentationFormat) { } // lazy linting

    // Input Manager
    const inputManager = new InputManager(canvas);
    GeometryBuffersCollection.initialize(device);

    // CAMERA
    const camera = new Camera(device, canvas.width / canvas.height, inputManager);
    camera.eye = (new Vec3(-0.2, 1.36, 2.59));
    camera.target = (new Vec3(-0.59, 1.0, 1.73 ));

    const rayTracingPipeline = new RayTracingRenderPipeline(
        device,
        camera,
        canvas.width,
        canvas.height
    );

    const spheres: RayTracedSphere[] = [];
    const planes: RayTracedPlane[] = [];

    addSphere(new Vec3(-5, -2, 0.5), 1.0, { color: new Vec3(1, 1, 1), roughness: 0, emissionStrength: 20, emissionColor: new Vec3(1, 1, 1) }); // white sphere - far back
    //addSphere(new Vec3(-100, -100, -100), 20.0, { color: new Vec3(1, 1, 1), roughness: 0, emissionStrength: 20, emissionColor: new Vec3(1, 1, 1) }); // white sphere - far back

    addSphere(new Vec3(-1, 0.5, 0), 0.5, { color: new Vec3(0.2, 1, 0.2), roughness: 0, emissionStrength: 0 }); // green sphere - left
    //addSphere(new Vec3(2, -2, -2), 0.5, { color: new Vec3(1.0, 0.0, 1.0), roughness: 0 , emissionStrength: 1, emissionColor: new Vec3(1, 0, 1) }); // pink sphere - right
    addSphere(new Vec3(0, 6, -3), 6, { color: new Vec3(0.8, 0.5, 0.5), roughness: 1, emissionStrength: 0 }); //  sphere - center
    
    
    addPlane(new Vec3(0, -1, 0), new Vec3(0, 1, 0), { color: new Vec3(0.5, 0.5, 0.5), roughness: 1, emissionStrength: 0 }, new Vec2(10, 10)); // Gray floor (10x10 units)

    function addSphere(position: Vec3, radius: number, material: RaytracerMaterial) {
        spheres.push({ center: position, radius, material });
    }

    function addPlane(position: Vec3, normal: Vec3, material: RaytracerMaterial, size: Vec2) {
        planes.push({ position, normal, material, size });
    }

    function handleInput(): void {
        // Reset camera position with R key
        if (inputManager.isKeyDown('r') || inputManager.isKeyDown('R')) {
            camera.eye = (new Vec3(0, 2, 5));
            camera.target = (new Vec3(0, 0, 0));
        }
    }

    // Animation variables
    let time = 0;

    // === RENDER LOOP ===
    let lastTime = performance.now();

    function renderLoop(currentTime: number) {
        const deltaTime = (currentTime - lastTime) / 1000;
        lastTime = currentTime;
        time += deltaTime;
        const jsStart = performance.now();

        handleInput();

        // Update camera
        camera.update();
        rayTracingPipeline.updateSpheres(spheres);
        rayTracingPipeline.updatePlanes(planes);
        
        // === RAY TRACING RENDER ===
        const commandEncoder = device.createCommandEncoder();

         // Run compute shader for raytracing
        rayTracingPipeline.compute(commandEncoder);
        // Submit commands
        const textureView = gpuContext.getCurrentTexture().createView();
        // Create render pass for ray tracing
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: textureView,
                    loadOp: "clear",
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                    storeOp: "store",
                },
            ],
        });
        rayTracingPipeline.draw(renderPass);
        renderPass.end();
        device.queue.submit([commandEncoder.finish()]);

        const jsTime = performance.now() - jsStart;
        // Update info display
        if (infoElem) {
            const pos = camera.eye;
            const forward = camera.target;
            infoElem.textContent =
                `Ray Tracing Demo\n` +
                `FPS: ${(1 / deltaTime).toFixed(1)}\n` +
                `JS: ${jsTime.toFixed(1)}ms\n` +
                `\nControls:\n` +
                `Mouse - Look Around\n` +
                `WASD - Move Camera\n` +
                `R - Reset Camera Position\n` +
                `\nCamera: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})\n` +
                `Forward: (${forward.x.toFixed(2)}, ${forward.y.toFixed(2)}, ${forward.z.toFixed(2)})\n` +
                `Spheres: ${spheres.length}, Planes: ${planes.length}`
        }

        animationFrameId = requestAnimationFrame(renderLoop);
    }

    renderLoop(performance.now());
}

export function dispose() {
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

export { init };