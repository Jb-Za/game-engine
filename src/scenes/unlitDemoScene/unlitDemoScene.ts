import { Camera } from "../../camera/Camera";
import { GeometryBuffersCollection } from "../../attribute_buffers/GeometryBuffersCollection";
import { Color } from "../../math/Color";
import { Vec3 } from "../../math/Vec3";
import { Vec2 } from "../../math/Vec2";
import { Texture2D } from "../../texture/Texture2D";
import { InputManager } from "../../input/InputManager";
import { UnlitObject } from "../../game_objects/UnlitObject";

let animationFrameId: number | null = null;

async function init(canvas: HTMLCanvasElement, device: GPUDevice, gpuContext: GPUCanvasContext, presentationFormat: GPUTextureFormat, infoElem: HTMLPreElement) {
    canvas!.addEventListener("click", async () => {
        await canvas!.requestPointerLock();
    });

    if (presentationFormat) {} // lazy linting

    // Input Manager
    const inputManager = new InputManager(canvas);
    GeometryBuffersCollection.initialize(device);

    // DEPTH TEXTURE
    const depthTexture = Texture2D.createDepthTexture(device, canvas.width, canvas.height);

    // CAMERA
    const camera = new Camera(device, canvas.width / canvas.height, inputManager);
    camera.eye = new Vec3(0, 2, 5);
    camera.target = new Vec3(0, 0, 0);

    // Create a simple white texture
    const whiteTexture = Texture2D.createEmpty(device, true);

    // Create objects using the UnlitRenderPipeline
    const objects: UnlitObject[] = [];

    // Create floor (cube scaled to be flat)
    const floor = new UnlitObject(device, camera, 'cube', whiteTexture);
    floor.position = new Vec3(0, -1, 0);
    floor.scale = new Vec3(10, 0.1, 10);
    floor.color = new Color(0.5, 0.5, 0.5, 1); // Gray floor
    floor.setTextureTiling(new Vec2(10, 10)); // Tile the texture
    objects.push(floor);

    const sphere = new UnlitObject(device, camera, 'sphere', whiteTexture);
    sphere.position = new Vec3(0, 0.5, 0);
    sphere.scale = new Vec3(0.7, 0.7, 0.7);
    sphere.color = new Color(1, 1, 0.3, 1); // Yellow sphere
    objects.push(sphere);

    function handleInput(): void {
        // Reset camera position with R key
        if (inputManager.isKeyDown('r') || inputManager.isKeyDown('R')) {
            camera.eye = new Vec3(0, 2, 5);
            camera.target = new Vec3(0, 0, 0);
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

        handleInput();

        // Update objects
        objects.forEach(obj => obj.update());
        
        // Update camera
        camera.update();

        // === MAIN RENDER PASS ===
        const commandEncoder = device.createCommandEncoder();
        const textureView = gpuContext.getCurrentTexture().createView();
        
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0.2, g: 0.4, b: 0.8, a: 1.0 }, // Sky blue background
                loadOp: 'clear',
                storeOp: 'store'
            }],
            depthStencilAttachment: {
                view: depthTexture.texture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store'
            }
        });

        // Render all objects
        objects.forEach(obj => obj.draw(renderPass));

        renderPass.end();
        device.queue.submit([commandEncoder.finish()]);

        // Update info display
        if (infoElem) {
            infoElem.textContent = 
                `Unlit Render Pipeline Demo\n` +
                `This scene demonstrates the UnlitRenderPipeline with simple objects.\n` +
                `\nControls:\n` +
                `Mouse - Look Around\n` +
                `R - Reset Camera Position\n` +
                `\nFeatures:\n` +
                `- UnlitRenderPipeline (no lighting calculations)\n` +
                `- Depth testing enabled\n` +
                `- Texture tiling on floor\n` +
                `- Simple animations`;
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