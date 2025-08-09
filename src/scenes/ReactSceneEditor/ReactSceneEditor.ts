import { Camera } from "../../camera/Camera";
import { GeometryBuffersCollection } from "../../attribute_buffers/GeometryBuffersCollection";
import { AmbientLight } from "../../lights/AmbientLight";
import { Color } from "../../math/Color";
import { Vec3 } from "../../math/Vec3";
import { Texture2D } from "../../texture/Texture2D";
import { DirectionalLight } from "../../lights/DirectionalLight";
import { PointLightsCollection } from "../../lights/PointLight";
import { InputManager } from "../../input/InputManager";
import { ShadowCamera } from "../../camera/ShadowCamera";
import { ObjectMap } from "../../game_objects/ObjectMap";
import { setSceneObjects } from "../../sceneEditor/sceneState";
import type { SceneObjects } from "../../sceneEditor/Interfaces";

// Import scene editor functions 
import * as sceneState from "../../sceneEditor/sceneState";
import * as objectManager from "../../sceneEditor/objectManager";
import * as fileManager from "../../sceneEditor/fileManager";

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

    // Input Manager
    const inputManager = new InputManager(canvas);
    GeometryBuffersCollection.initialize(device);
    const objectMap = new ObjectMap();

    // DEPTH TEXTURE
    const depthTexture = Texture2D.createDepthTexture(device, canvas.width, canvas.height);
    const shadowTexture = Texture2D.createShadowTexture(device, 2048, 2048);

    // LIGHTS
    const ambientLight = new AmbientLight(device);
    ambientLight.color = new Color(1, 1, 1, 1);
    ambientLight.intensity = 0.3;

    const directionalLight = new DirectionalLight(device);
    directionalLight.color = new Color(1, 1, 1, 1);
    directionalLight.intensity = 0.7;

    const pointLights = new PointLightsCollection(device, 3);
    pointLights.lights[0].intensity = 0;
    pointLights.lights[1].intensity = 0;
    pointLights.lights[2].intensity = 0;

    // CAMERA
    const camera = new Camera(device, canvas.width / canvas.height, inputManager);
    camera.eye = new Vec3(0, 5, 10);
    camera.target = new Vec3(0, 0, 0);

    const shadowCamera = new ShadowCamera(device);
    shadowCamera.eye = new Vec3(10, 10, 10);
    shadowCamera.target = new Vec3(0, 0, 0);
    shadowCamera.far = 50;

    directionalLight.direction = new Vec3(shadowCamera.target.x - shadowCamera.eye.x,
        shadowCamera.target.y - shadowCamera.eye.y, shadowCamera.target.z - shadowCamera.eye.z)

    // Arrays to store game objects
    const gameObjects: any[] = [];
    const objectDataMap = new Map<string, any>();

    // Store scene objects globally for React controls
    const sceneObjects: SceneObjects = {
        objectMap,
        device,
        camera,
        shadowCamera,
        ambientLight,
        directionalLight,
        pointLights,
        shadowTexture,
        gameObjects,
        objectDataMap,
        selectedObjectId: null
    };

    // Set global scene objects reference
    setSceneObjects(sceneObjects);

    // === GAME FUNCTIONS ===
    function handleInput(): void {
        // Add some basic input handling
        if (inputManager.isKeyDown('r') || inputManager.isKeyDown('R')) {
            // Reset camera
            camera.eye = new Vec3(0, 5, 10);
            camera.target = new Vec3(0, 0, 0);
        }
    }

    // === RENDER LOOP ===
    let lastTime = performance.now();
    function renderLoop(currentTime: number) {
        const deltaTime = (currentTime - lastTime) / 1000;
        lastTime = currentTime;

        if (infoElem != null) {
            infoElem.textContent = `fps: ${(1 / deltaTime).toFixed(1)}\n` +
                `Objects: ${gameObjects.length}\n` +
                `Selected: ${sceneObjects?.selectedObjectId || 'None'}\n` +
                `Mouse - Look Around\n` +
                `WASD - Move Camera\n` +
                `R - Reset Camera\n` +
                `camera.eye: ${sceneObjects?.camera.eye.toString()}\n` +
                `camera.target: ${sceneObjects?.camera.target.toString()}\n`;
        }

        handleInput();

        // Update game objects
        gameObjects.forEach(obj => {
            if (obj && typeof obj.update === 'function') {
                obj.update(deltaTime);
            }
        });

        // Update lights
        ambientLight.update();
        directionalLight.update();
        pointLights.update();

        // Update cameras
        camera.update();
        shadowCamera.update();

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
        gameObjects.forEach(obj => {
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
        gameObjects.forEach(obj => {
            if (obj && typeof obj.draw === 'function' && obj.visible !== false) {
                obj.draw(renderPass);
            }
        });

        // Highlight selected object (optional)
        if (sceneObjects?.selectedObjectId) {
            const selectedGameObject = sceneObjects.objectDataMap.get(sceneObjects.selectedObjectId);
            if (selectedGameObject && typeof selectedGameObject.draw === 'function') {
                // You could add a wireframe or highlight effect here
            }
        }

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
    setSceneObjects(null as any);
}

// Export the main init function
export { init };

// Export scene editor functions for use by WebGPUScene using namespace imports
export const updateSceneState = sceneState.updateSceneState;
export const selectObject = sceneState.selectObject;
export const addObject = objectManager.addObject;
export const removeObject = objectManager.removeObject;
export const saveScene = fileManager.saveScene;
export const loadScene = fileManager.loadScene;
