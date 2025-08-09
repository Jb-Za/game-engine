import { GeometryBuffersCollection } from "../../attribute_buffers/GeometryBuffersCollection";
import { InputManager } from "../../input/InputManager";
import { RayTracingRenderPipeline } from "../../render_pipelines/RayTracingRenderPipeline";
import { RayTracingScene } from "../../raytracingScene/RayTracingScene";

let scene: RayTracingScene;
let animationFrameId: number | null = null;

async function init(canvas: HTMLCanvasElement, device: GPUDevice, gpuContext: GPUCanvasContext, presentationFormat: GPUTextureFormat, infoElem: HTMLPreElement) {
    canvas!.addEventListener("click", async () => {
        await canvas!.requestPointerLock();
    });

    if (presentationFormat) { } // lazy linting

    // Input Manager
    const inputManager = new InputManager(canvas);
    GeometryBuffersCollection.initialize(device);

    // Create scene
    scene = new RayTracingScene(device, canvas.width / canvas.height, inputManager);
    const camera = scene.getCamera();

    const rayTracingPipeline = new RayTracingRenderPipeline(
        device,
        camera,
        canvas.width,
        canvas.height
    );

    function handleInput(): void {
        // Reset camera position with R key
        if (inputManager.isKeyDown('r') || inputManager.isKeyDown('R')) {
            camera.eye.x = -0.2;
            camera.eye.y = 1.36;
            camera.eye.z = 2.59;
            camera.target.x = -0.59;
            camera.target.y = 1.0;
            camera.target.z = 1.73;
        }
    }

    // === RENDER LOOP ===
    let lastTime = performance.now();

    function renderLoop(currentTime: number) {
        const deltaTime = (currentTime - lastTime) / 1000;
        lastTime = currentTime;
        const jsStart = performance.now();

        handleInput();

        // Update camera
        camera.update();
        
        // Update raytracing pipeline with current scene data
        rayTracingPipeline.updateSpheres(scene.getSpheresForRendering());
        rayTracingPipeline.updatePlanes(scene.getPlanesForRendering());
        
        // === RAY TRACING RENDER ===
        const commandEncoder = device.createCommandEncoder();

         // Run compute shader for raytracing
        rayTracingPipeline.compute(commandEncoder);
        const textureView = gpuContext.getCurrentTexture().createView();
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
                `Ray Tracing Scene Editor\n` +
                `FPS: ${(1 / deltaTime).toFixed(1)}\n` +
                `JS: ${jsTime.toFixed(1)}ms\n` +
                `\nControls:\n` +
                `Mouse - Look Around\n` +
                `WASD - Move Camera\n` +
                `R - Reset Camera Position\n` +
                `\nCamera: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})\n` +
                `Forward: (${forward.x.toFixed(2)}, ${forward.y.toFixed(2)}, ${forward.z.toFixed(2)})\n`
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

// Export functions for scene editing
export function getScene(): RayTracingScene {
    return scene;
}

export function addObject(type: 'sphere' | 'light'): RayTracingScene | null {
    if (!scene) {
        console.error('RayTracingScene not initialized');
        return null;
    }
    return scene.addNewObject(type);
}

export function removeObject(id: string): void {
    if (!scene) {
        console.error('RayTracingScene not initialized');
        return;
    }
    scene.deleteObject(id);
}

export { init };
