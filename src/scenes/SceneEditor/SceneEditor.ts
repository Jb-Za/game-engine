import { GeometryBuffersCollection } from "../../attribute_buffers/GeometryBuffersCollection";
import { Texture2D } from "../../texture/Texture2D";
import { InputManager } from "../../input/InputManager";
import { Scene } from "../../sceneEditor/Scene";
import sceneDataJson from "./scene.json";

let scene: Scene;
let animationFrameId: number | null = null;

async function init(
    canvas: HTMLCanvasElement,
    device: GPUDevice,
    gpuContext: GPUCanvasContext,
    presentationFormat: GPUTextureFormat,
    infoElem: HTMLPreElement
) {
    canvas?.addEventListener("click", async () => {
        await canvas?.requestPointerLock();
    });

    if (presentationFormat) { } // lazy linting

    const sceneData = sceneDataJson as any;

    // Input Manager
    const inputManager = new InputManager(canvas);
    GeometryBuffersCollection.initialize(device);

    // DEPTH TEXTURE
    const depthTexture = Texture2D.createDepthTexture(device, canvas.width, canvas.height);
    const shadowTexture = Texture2D.createShadowTexture(device, 2048, 2048);

    scene = new Scene(sceneData, device, canvas.width / canvas.height, inputManager, shadowTexture);
    const sceneObjects = scene.getSceneObjects();
    const camera = scene.getCamera();
    const ambientLight = scene.getAmbientLight();
    const directionalLight = scene.getDirectionalLight();
    const pointLights = scene.getPointLights();
    const shadowCamera = scene.getShadowCamera();

    // === GAME FUNCTIONS ===
    function handleInput(): void {
        // Add some basic input handling
        if (inputManager.isKeyDown('r') || inputManager.isKeyDown('R')) {
            
        }
    }

    // === RENDER LOOP ===
    let lastTime = performance.now();
    function renderLoop(currentTime: number) {
        const deltaTime = (currentTime - lastTime) / 1000;
        lastTime = currentTime;

        if (infoElem != null) {
            infoElem.textContent = `fps: ${(1 / deltaTime).toFixed(1)}\n`
        }

        handleInput();
        camera.update();
        ambientLight.update();
        directionalLight.update();
        pointLights.update();
        shadowCamera.update();

        // Update game objects
        sceneObjects.objects.forEach(obj => {
            if (obj && typeof obj.update === 'function') {
                obj.update(deltaTime);
            }
        });

        // === SHADOW PASS ===
        const shadowCommandEncoder = device.createCommandEncoder();
        const shadowRenderPass = shadowCommandEncoder.beginRenderPass({
            colorAttachments: [],
            depthStencilAttachment: {
                view: shadowTexture.texture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store'
            }
        });

        sceneObjects.objects.forEach(obj => {
            if (obj && typeof obj.drawShadows === 'function') {
                obj.drawShadows(shadowRenderPass);
            }
        });
        shadowRenderPass.end();
        device.queue.submit([shadowCommandEncoder.finish()]);

        // === MAIN RENDER PASS ===
        const commandEncoder = device.createCommandEncoder();
        const textureView = gpuContext.getCurrentTexture().createView();
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0.2, g: 0.2, b: 0.25, a: 1.0 },
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

        // Render game objects
        sceneObjects.objects.forEach(obj => {
            if (obj && typeof obj.draw === 'function' && obj.visible !== false) {
                obj.draw(renderPass);
            }
        });


        renderPass.end();
        device.queue.submit([commandEncoder.finish()]);
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

// Export the main init function and related scene functions
export { init, getScene, addObject, removeObject };

// Function to get the current scene instance
function getScene(): Scene {
    return scene;
}

// Function to add a new object to the scene
function addObject(type: 'cube' | 'sphere' | 'light' | 'camera'): Scene | null {
    if (!scene) {
        console.error('Scene not initialized');
        return null;
    }
    return scene.addNewObject(type);
}

// Function to remove an object from the scene
function removeObject(id: string): void {
    if (!scene) {
        console.error('Scene not initialized');
        return;
    }
    scene.deleteSceneObject(id);
}
