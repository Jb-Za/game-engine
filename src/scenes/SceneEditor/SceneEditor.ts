import { GeometryBuffersCollection } from "../../attribute_buffers/GeometryBuffersCollection";
import { Texture2D } from "../../texture/Texture2D";
import { InputManager } from "../../input/InputManager";
import { Scene } from "../../sceneEditor/Scene";
import sceneDataJson from "./scene.json";
import { Camera } from "../../camera/Camera";
import { AmbientLight } from "../../lights/AmbientLight";
import { DirectionalLight } from "../../lights/DirectionalLight";
import { PointLightsCollection } from "../../lights/PointLight";
import { ShadowCamera } from "../../camera/ShadowCamera";

let scene: Scene | null = null;
let animationFrameId: number | null = null;

// Module-level resources so loadScene can be called at any time
let _device: GPUDevice | null = null;
let _gpuContext: GPUCanvasContext | null = null;
let _presentationFormat: GPUTextureFormat | null = null;
let _canvas: HTMLCanvasElement | null = null;
let _infoElem: HTMLPreElement | null = null;
let _inputManager: InputManager | null = null;
let _depthTexture: Texture2D | null = null;
let _shadowTexture: Texture2D | null = null;

let camera: Camera | null = null;
let ambientLight: AmbientLight | null = null;
let directionalLight: DirectionalLight | null = null;
let pointLights: PointLightsCollection | null = null;
let shadowCamera: ShadowCamera | null = null;

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

    // Store module-level references for later use
    _canvas = canvas;
    _device = device;
    _gpuContext = gpuContext;
    _presentationFormat = presentationFormat;
    _infoElem = infoElem;

    // Input Manager
    _inputManager = new InputManager(canvas);
    GeometryBuffersCollection.initialize(device);

    // Create shared depth and shadow textures once
    _depthTexture = Texture2D.createDepthTexture(device, canvas.width, canvas.height);
    _shadowTexture = Texture2D.createShadowTexture(device, 4096, 4096);

    // Create the initial scene (uses the module-level resources)
    loadScene(sceneData);

    // === GAME FUNCTIONS ===
    function handleInput(): void {
        // Add some basic input handling
        if (_inputManager && (_inputManager.isKeyDown('r') || _inputManager.isKeyDown('R'))) {
            // placeholder for future
        }
    }

    // === RENDER LOOP ===
    let lastTime = performance.now();
    function renderLoop(currentTime: number) {
        const deltaTime = (currentTime - lastTime) / 1000;
        lastTime = currentTime;

        if (_infoElem != null) {
            _infoElem.textContent = `fps: ${(1 / deltaTime).toFixed(1)}\n`
        }

        handleInput();

        if (!scene) {
            // No scene to update/render yet
            animationFrameId = requestAnimationFrame(renderLoop);
            return;
        }

        // Query scene-local components each frame so loadScene can swap them at runtime
        const sceneObjects = scene.getSceneObjects();
        camera = scene.getCamera();
        ambientLight = scene.getAmbientLight();
        directionalLight = scene.getDirectionalLight();
        pointLights = scene.getPointLights();
        shadowCamera = scene.getShadowCamera();

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
                view: _shadowTexture!.texture.createView(),
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
                view: _depthTexture!.texture.createView(),
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
export { init, getScene, addObject, removeObject, saveScene, loadScene };

// Function to get the current scene instance
function getScene(): Scene | null {
    return scene;
}

// Function to add a new object to the scene
function addObject(type: 'cube' | 'sphere' | 'light' | 'camera' | 'gltf', data?: any): Scene | null {
    if (!scene) {
        console.error('Scene not initialized');
        return null;
    }
    return scene.addNewObject(type, data);
}

// Function to remove an object from the scene
function removeObject(id: string): void {
    if (!scene) {
        console.error('Scene not initialized');
        return;
    }
    scene.deleteSceneObject(id);
}

function disposeScene(): void{
    camera = null;
    ambientLight = null;
    directionalLight = null;
    pointLights = null;
    shadowCamera = null;
}

function loadScene(sceneJson: any): void {
    disposeScene();

    // Create/replace the scene instance
    try {
        scene = new Scene(sceneJson, _device!, _canvas!.width / _canvas!.height, _inputManager!, _shadowTexture!, _presentationFormat!, _depthTexture!.texture);
        console.log('Scene loaded');
    } catch (e) {
        console.error('Failed to load scene:', e);
    }
}

function saveScene(): void {
    if (!scene) {
        console.error('Scene not initialized');
        return;
    }  
    scene.saveScene();
}
